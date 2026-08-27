# Team Management Tool — Design Document

## 1. Purpose

A single tool for an engineering manager covering two connected halves of the job:

**Module A — Allocation.** Who is working on what, at what percentage, as of any date: past, present, or planned future. Surfaces under- and over-allocation on both sides (people and apps).

**Module B — People.** 1:1 records, career progression, and feedback per report, with continuity across months.

The two are connected by design. When preparing a 1:1, the manager should see what that person is actually allocated to alongside their goals and recent conversations — allocation reality is usually half the substance of a 1:1.

Both modules are in scope for v1. Module B has stricter data-handling requirements, specified in Section 9 as build requirements, not caveats.

---

## 2. Scope

### In scope (v1)
- CRUD for users, teams, apps
- Allocation of users to apps with a percentage, effective-dated
- Time-travel: view allocation state as of any date
- Future-dated allocations for planning
- Under/over-allocation flagging for both users and apps
- Team-based filtering and rollups
- 1:1 records per report, with agenda carry-over between sessions
- Goals and career-progression tracking per report
- Feedback log (given and received)
- Pre-1:1 prep view combining allocation + open items + goals

### Out of scope (v1)
- Multi-user access, authentication, roles — this is a single-user tool
- Integration with Jira, HRIS, calendar, or any external system
- Notifications, email, scheduled reports
- Any cloud sync or AI API call touching Module B content

---

## 3. Domain model — shared entities

**User** — a developer (direct or indirect report)
```
id            PK
name          string, required
title         string, optional
start_date    date, optional          -- when they joined the team
active        boolean, default true   -- soft-delete / left the team
```

**Team** — existing org structure, for navigation and grouping only. Does *not* constrain allocation.
```
id            PK
name          string, required
active        boolean, default true
```

**App** — a product or application the team delivers
```
id                  PK
name                string, required
required_capacity   decimal, required   -- target total allocation %, e.g. 200 = 2 FTE
active              boolean, default true
notes               text, optional
```

**UserTeam** — junction; a user may belong to multiple teams
```
user_id       FK -> User
team_id       FK -> Team
PRIMARY KEY (user_id, team_id)
```

**AppTeam** — junction; an app may belong to multiple teams
```
app_id        FK -> App
team_id       FK -> Team
PRIMARY KEY (app_id, team_id)
```

---

## 4. Module A — Allocation

### 4.1 Core table

**Allocation** — one row = one user on one app at one percentage for one continuous period.
```
id            PK
user_id       FK -> User, required
app_id        FK -> App, required
percentage    decimal, required, > 0 and <= 100
start_date    date, required
end_date      date, nullable          -- NULL = ongoing
created_at    timestamp
```

**AllocationChange** — audit trail; answers "why did this change" months later
```
id              PK
allocation_id   FK -> Allocation
changed_at      timestamp
change_type     enum: created | modified | ended
note            text, optional
```

### 4.2 Temporal model

Allocation rows are **effective-dated and not mutated in place**. This is what makes time travel work.

**Rule:** when an allocation changes (e.g. 50% → 70%), do not update the row. Instead:
1. Set `end_date` on the existing row to the date the change takes effect
2. Insert a new row with the new percentage, `start_date` = that same date, `end_date` = NULL
3. Write `AllocationChange` records for both

In-place editing is reserved for **correcting mistakes** (a mistyped percentage), and still writes an `AllocationChange` with `change_type = modified`.

**Core query — state as of date D:**
```sql
SELECT *
FROM Allocation
WHERE start_date <= :D
  AND (end_date IS NULL OR end_date > :D)
```

Every allocation view is this query with a different date. "Today" is just the default.

**Future planning** needs no extra machinery: `start_date` may be in the future, and such rows simply don't appear in queries for earlier dates.

### 4.3 Validation rules

- **No overlapping ranges** for the same `(user_id, app_id)` pair — blocking error
- `end_date` must be `> start_date` when not NULL — blocking error
- `percentage` must be `> 0` and `<= 100` — blocking error
- **Sum ≤ 100% per user is a WARNING, not a constraint.** Real allocation legitimately exceeds 100% during crunch. Flag it visually; never block the save
- The 100% check evaluates **per point in time** across the affected range, not just for today

### 4.4 Derived metrics

Computed at query time, never stored.

**User total allocation (as of D):** `SUM(percentage)` for that user's active rows.
`< 100%` underallocated · `= 100%` full · `> 100%` overcommitted.

**App total allocation (as of D):** `SUM(percentage)` for that app's active rows, compared against `App.required_capacity`.
Below → under-resourced · at → correctly staffed · above → over-resourced.

**Team rollup (as of D):** join through `UserTeam` / `AppTeam` to aggregate. Navigation aid only.

**Unallocated users:** zero active allocations as of D. Should be visually prominent — the most actionable signal in the app.

---

## 5. Module B — People

### 5.1 Tables

**OneOnOne** — a single 1:1 session
```
id              PK
user_id         FK -> User, required
date            date, required
manager_notes   text        -- what the manager recorded
their_topics    text        -- what the report raised
created_at      timestamp
updated_at      timestamp
```

**ActionItem** — commitments from a 1:1, by either side. Drives agenda carry-over.
```
id              PK
user_id         FK -> User, required
one_on_one_id   FK -> OneOnOne, nullable   -- which session it came from
description     text, required
owner           enum: manager | report
status          enum: open | done | dropped
due_date        date, optional
created_at      timestamp
closed_at       timestamp, nullable
```

**Goal** — career or development objective
```
id              PK
user_id         FK -> User, required
title           string, required
detail          text, optional
category        enum: technical | leadership | delivery | other
status          enum: active | achieved | paused | dropped
target_date     date, optional
created_at      timestamp
updated_at      timestamp
```

**GoalUpdate** — progress log against a goal, so trajectory is visible rather than just current state
```
id          PK
goal_id     FK -> Goal, required
date        date, required
note        text, required
```

**Feedback** — feedback given to or received about a report
```
id          PK
user_id     FK -> User, required
date        date, required
direction   enum: given | received       -- received = from peers/stakeholders about them
source      string, optional             -- who it came from, for 'received'
category    enum: praise | constructive | other
content     text, required
shared      boolean, default false       -- has this been relayed to the person yet
```

### 5.2 Agenda carry-over

The mechanism that makes 1:1s continuous rather than a series of disconnected conversations:

When opening a new 1:1 for a user, the app pre-populates a prep panel with:
- All `ActionItem` rows for that user with `status = open`
- Any `Feedback` rows with `shared = false` — things to pass on
- `Goal` rows with `status = active` and no `GoalUpdate` in the last 60 days — quietly stalling
- Their current allocation from Module A, and any allocation change since the last 1:1

That last item is the reason the two modules live in one app. "You moved from App X to App Y three weeks ago — how's that going?" is a better opening than "so, how are things?"

### 5.3 Retention

Module B is a working tool, not a permanent record. See Section 9.5 — records older than a configurable retention window are surfaced for review and deletion rather than accumulating indefinitely.

---

## 6. Screens

### 6.1 Dashboard (default view)
Date control at the top drives every allocation panel below it.

- **Date picker / timeline slider** — defaults to today
- **People panel** — active users with a visual allocation bar, sorted ascending so underallocated float to the top. Colour-coded under / full / over. Each row also shows days since last 1:1
- **Apps panel** — `current allocation / required_capacity`, sorted by shortfall descending, same colour coding
- **Team filter** — multi-select, filters both panels
- **Summary strip** — counts: underallocated people, under-resourced apps, unallocated people, overdue 1:1s, open action items

### 6.2 Person view
One screen per report, tabbed. This is the screen used most.

- **Overview tab** — current allocations, active goals, open action items, days since last 1:1
- **1:1s tab** — reverse-chronological session list; opening a new one loads the prep panel from 5.2
- **Goals tab** — active and past goals with their update history
- **Feedback tab** — feedback log, filterable by direction and category, with unshared items highlighted
- **Allocation tab** — Gantt-style timeline of their app assignments over time, past and future

### 6.3 App detail
- App fields, `required_capacity`, teams
- Who is allocated, at what %, over what period — timeline view
- Staffing-over-time chart: total allocation vs. required capacity, making trends visible
- Change history from `AllocationChange`

### 6.4 Allocation editor
Modal or page. User, App, Percentage, Start date, End date, Note.
- Live validation: overlap conflicts blocking, >100% total as a warning
- When changing an existing allocation, **"end current and create new"** is the default action; plain edit is available but visually secondary. This nudges toward preserving history

### 6.5 1:1 editor
- Date, manager notes, their topics
- Inline action-item creation with owner assignment
- Prep panel (5.2) visible alongside while writing
- Quick link to create a goal or log feedback without leaving the screen

### 6.6 Admin
CRUD for Users, Teams, Apps. **Deactivate rather than delete** in Module A to preserve historical allocation integrity. Module B deletion is a separate hard-delete path — see 9.5.

---

## 7. Technical guidance

### Suggested stack
- **Frontend**: React + TypeScript
- **Data**: SQLite, file-based, backed up as a single file
- **ORM**: Prisma or Drizzle — both handle junction tables and date-range queries cleanly
- **Runtime**: Next.js for a single deployable, or Vite + thin Node/Express API

### Hard technical requirements
- **Runs locally. No cloud sync, no telemetry, no external network calls carrying app data.**
- **No AI API calls processing Module B content.** If AI assistance is wanted later (e.g. summarising notes), it must run against a local model or not at all. Module B content does not leave the machine.
- **Two separate SQLite files**: `allocation.db` and `people.db`. The app opens both; they join in application code on `user_id`, not across a shared database file. This means the allocation database can be demoed, screenshotted, or shared without the people data being present at all.

### Implementation notes
- Store dates as `DATE`, not `DATETIME` — allocations change on day boundaries and timezone handling only adds bugs here
- Use half-open intervals `[start_date, end_date)` — end date exclusive. Avoids off-by-one gaps and overlaps when one allocation ends and another begins the same day
- Seed with realistic dummy data during development so visual states (under / full / over) can be checked without hand-entering rows. **Seed data must use fictional names** — no real colleagues in the repo
- If the repo is ever pushed anywhere, `people.db` and any export files must be gitignored. Add this to `.gitignore` in step 1, not later

---

## 8. Build order

1. Schema, migrations, seed data — both databases
2. Entity CRUD (Users, Teams, Apps)
3. Allocation create/edit with validation rules
4. The "as of date D" query and derived metrics
5. Dashboard with the date control
6. Person view — Overview and Allocation tabs
7. 1:1 records with action items and the carry-over prep panel
8. Goals and feedback
9. App detail with staffing-over-time chart
10. Audit trail surfacing, retention review screen, polish

Steps 1–7 constitute a genuinely useful daily tool. Everything after is refinement.

---

## 9. Data handling requirements — Module B

Module B holds personal data about identifiable employees, processed in an employment context, in the EU, at a regulated financial-services employer. The following are build requirements, not suggestions.

### 9.1 Local only
Storage is a local SQLite file on an encrypted disk. No cloud backup service, no sync, no third-party processing of note content. This is what makes a self-built tool defensible where a hosted one would not be.

### 9.2 Separation
Separate database files, separate screens, separate export paths. Module A must be fully usable and shareable with `people.db` absent.

### 9.3 What gets recorded
Suitable: development goals, skill growth areas, project ownership interests, delivery observations, factual summaries of what was discussed.

Not suitable, and should never be entered: health information, personal or family circumstances, verbatim transcripts, disciplinary matters, compensation discussions, anything about a person other than the report themselves.

Anything that could become part of a formal HR or legal process belongs in the sanctioned system, not here. A useful test before typing: *would I be comfortable if this person read this exact sentence?* If not, either it shouldn't be written down, or it belongs in a formal channel.

Implementation: the 1:1 editor shows this guidance as persistent helper text, not a dismissible one-time notice.

### 9.4 Employer policy
Confirm with the employer whether managers may keep people-management records outside the sanctioned HR system, and align with whatever answer comes back. If the employer provides a sanctioned system for this, that system wins for anything formal, and this tool stays explicitly a personal working aid.

### 9.5 Deletion and retention
- **Hard delete per user** — a single action that removes all Module B records for one person, permanently. Not a soft-delete flag. Build this in step 7, not as an afterthought
- **Retention review** — a screen listing records older than a configurable window (default 24 months) with bulk delete. The default posture is that old 1:1 notes get deleted, not archived
- **Leavers** — when a user is deactivated in Module A, prompt to hard-delete their Module B records. Their allocation history stays for capacity analysis; their personal notes do not need to
