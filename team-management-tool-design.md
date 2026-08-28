# Team Management Tool — Design Document

## 1. Purpose

A single tool for an engineering manager covering two connected halves of the job:

**Allocation.** Who is working on what, at what percentage, as of any date: past, present, or planned future. Surfaces under- and over-allocation on both sides (people and apps).

**People.** 1:1 records, career progression, and feedback per report, with continuity across months.

The two are connected by design. When preparing a 1:1, the manager should see what that person is actually allocated to alongside their goals and recent conversations — allocation reality is usually half the substance of a 1:1.

Both halves are in scope for v1. The people side has stricter data-handling requirements, specified in Section 9 as build requirements, not caveats.

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
- Any cloud sync or AI API call touching people-records content

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

## 4. Allocation

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

## 5. People

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
- Their current allocation, and any allocation change since the last 1:1

That last item is the reason the two halves live in one app. "You moved from App X to App Y three weeks ago — how's that going?" is a better opening than "so, how are things?"

### 5.3 Retention

People records are a working tool, not a permanent record. See Section 9.5 — records older than a configurable retention window are surfaced for review and deletion rather than accumulating indefinitely.

---

## 6. Screens

### 6.1 Dashboard (default view)
Date control at the top drives every allocation panel below it.

- **Date picker / timeline slider** — defaults to today
- **People panel** — active users with a visual allocation bar, sorted ascending so underallocated float to the top. Colour-coded under / full / over. Each row also shows days since last 1:1
- **Apps panel** — `current allocation / required_capacity`, sorted by shortfall descending, same colour coding
- **Team filter** — multi-select, filters both panels
- **Summary strip** — counts: underallocated people, under-resourced apps, unallocated people, overdue 1:1s, open action items
- **Overdue is 30 days.** A person is overdue when their most recent 1:1 is more than 30 days old, *or* when no 1:1 has ever been recorded for them — someone never spoken to is the most overdue there is, not an absent row. The same threshold highlights the "days since last 1:1" figure in the people panel. There is no per-person cadence: one interval applies to everyone, and the count is derived at read time, never stored

### 6.2 People index and person view

**People index** — every active person as a card: allocation total, status colour, and days since last 1:1. Unlike the dashboard it has no date control; it is always as of today, and exists as the way into a person rather than as an analysis screen.

**Person view** — one screen per report, tabbed. This is the screen used most.

- **Overview tab** — current allocations, active goals, open action items, days since last 1:1
- **1:1s tab** — reverse-chronological session list; opening a new one loads the prep panel from 5.2
- **Goals tab** — active and past goals with their update history
- **Feedback tab** — feedback log, filterable by direction and category, with unshared items highlighted
- **Allocation tab** — Gantt-style timeline of their app assignments over time, past and future

### 6.3 Apps index and app detail

**Apps index** — every active app as a card with its allocation against `required_capacity`, as of today, with no date control. The way into an app.

**App detail**
- App fields, `required_capacity`, teams
- Who is allocated, at what %, over what period — timeline view
- Staffing-over-time chart: total allocation vs. required capacity, making trends visible
- Change history from `AllocationChange`

### 6.4 Allocation editor
Modal or page. User, App, Percentage, Start date, End date, Note.
- Live validation: overlap conflicts blocking, >100% total as a warning
- When changing an existing allocation, **"end current and create new"** is the default action; plain edit is available but visually secondary. This nudges toward preserving history
- **Entry points — both sides of the relationship.** Allocating is reached from an app ("this app is short-staffed, who can I put on it") *and* from a person ("she is at 40%, what else can she take"). Both are real starting points and neither is primary, so App detail offers **Allocate someone** with the app fixed, and the person's Allocation tab offers **Add allocation** with the person fixed. Editing an existing row is reached from the row itself, on either screen

### 6.5 1:1 editor
- Date, manager notes, their topics
- Inline action-item creation with owner assignment
- Prep panel (5.2) visible alongside while writing
- Quick link to create a goal or log feedback without leaving the screen

### 6.6 Admin
CRUD for Users, Teams, Apps. **Deactivate rather than delete** on the allocation side to preserve historical allocation integrity. Deletion of people records is a separate hard-delete path — see 9.5.

---

## 7. Technical guidance

### Suggested stack
- **Frontend**: React + TypeScript
- **Data**: SQLite, file-based, backed up as a single file
- **ORM**: Prisma or Drizzle — both handle junction tables and date-range queries cleanly
- **Runtime**: Next.js for a single deployable, or Vite + thin Node/Express API

### Hard technical requirements
- **Runs locally. No cloud sync, no telemetry, no external network calls carrying app data.**
- **No AI API calls processing people-records content.** If AI assistance is wanted later (e.g. summarising notes), it must run against a local model or not at all. Note content does not leave the machine.
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

## 9. Data handling requirements — people records

People records hold personal data about identifiable people, recorded in an employment context. That is a categorically different kind of data from anything on the allocation side, and it carries obligations that allocation data does not: under data-protection law wherever the tool is run, and under whatever additional regime the operating organisation is subject to. Both are stricter for employment records than for most other data, and stricter again in regulated industries.

The following are build requirements, not suggestions.

### 9.1 Local only
Storage is a local SQLite file on an encrypted disk. No cloud backup service, no sync, no third-party processing of note content. This is what makes a self-built tool defensible where a hosted one would not be.

### 9.2 Separation
Separate database files, separate screens, separate export paths. Allocation must be fully usable and shareable with `people.db` absent.

### 9.3 What gets recorded
Suitable: development goals, skill growth areas, project ownership interests, delivery observations, factual summaries of what was discussed.

Not suitable, and should never be entered: health information, personal or family circumstances, verbatim transcripts, disciplinary matters, compensation discussions, anything about a person other than the report themselves.

Anything that could become part of a formal HR or legal process belongs in the sanctioned system, not here. A useful test before typing: *would I be comfortable if this person read this exact sentence?* If not, either it shouldn't be written down, or it belongs in a formal channel.

Implementation: the 1:1 editor shows this guidance as persistent helper text, not a dismissible one-time notice.

### 9.4 Not a system of record
This tool is a personal working aid. It is not, and must not present itself as, a system of record.

Where a sanctioned HR system exists, that system is authoritative for anything formal — performance management, disciplinary matters, compensation — and this tool defers to it rather than duplicating it. §9.3 draws the same line at the level of individual notes; this is the same rule stated about the tool as a whole.

The architecture is built so that an organisation's answer about keeping people-management records outside a sanctioned system can be honoured either way: people records live in a separate database that can be omitted entirely, leaving allocation fully functional (§9.2). Allocation planning does not depend on any of this.

### 9.5 Deletion and retention
- **Hard delete per user** — a single action that removes all people records for one person, permanently. Not a soft-delete flag. Build this in step 7, not as an afterthought
- **Retention review** — a screen listing records older than a configurable window (default 24 months) with bulk delete. The default posture is that old 1:1 notes get deleted, not archived
- **Leavers** — when a user is deactivated on the allocation side, prompt to hard-delete their people records. Their allocation history stays for capacity analysis; their personal notes do not need to

---

## 10. Technical architecture

Section 7 offered options. This section decides them. Where the two differ, **Section 10 wins** — the deltas are called out inline. Everything here was verified against the installed toolchain and the current Next.js release rather than assumed.

### 10.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16.3.3** — App Router, Turbopack | Single deployable, per §7. Server and client in one TypeScript project |
| Rendering | **Server Components**, rendered per request | No cache layer at all — see §10.5 |
| UI | **React 19.2**, **TypeScript 5.x** `strict` | |
| Styling | **Tailwind CSS v4.3** + **shadcn/ui** | shadcn components copied into the repo, not a runtime dependency |
| Charts | **Recharts**, via shadcn's `chart` component | §6.3 staffing-over-time |
| Database | **SQLite** via **better-sqlite3 13.0.3** | Two files, per §7. No server, no daemon, no Docker |
| ORM | **Drizzle ORM 0.45.2** + **drizzle-kit 0.31.10** | §7 named Prisma or Drizzle; Drizzle has zero runtime dependencies and no codegen step |
| Validation | **Zod** | One schema shared by client form and server action |
| Unit tests | **`node --test`** — no dependencies | Node 26 runs `.ts` test files natively via type-stripping |
| E2E | **Playwright**, optional | Deferred until after build step 7 (§8); not required by the architecture |
| Runtime | **Node v26.7.0** (fnm), **npm** | |

**Verified on this machine, not assumed:**

- `better-sqlite3` ships a prebuilt N-API binary inside its npm tarball. There is no compiler on this machine and none is needed. The binary loads on Node 26.7.0 and reports SQLite 3.53.4.
- That binary links only against `libc`, `libstdc++`, `libm` and `libgcc`. It has **zero** undefined network or DNS symbols — no `socket`, no `connect`, no `getaddrinfo` — no embedded URLs, and no install script. It is structurally incapable of opening a network connection, which is the strongest possible form of the §7 guarantee.
- It is compiled with **FTS5**, so local full-text search across notes is available at no extra cost if wanted later.
- `drizzle-orm` declares **zero runtime dependencies**. Its long `peerDependencies` list is optional driver bindings; only `better-sqlite3` is installed.

### 10.2 Repository layout

```
team-management-tool/
├── team-management-tool-design.md
├── next.config.ts
├── components.json                    shadcn config
├── drizzle.config.allocation.ts
├── drizzle.config.people.ts
├── data/                              [gitignored]
│   ├── allocation.db
│   └── people.db
├── drizzle/
│   ├── allocation/                    migrations  [committed]
│   └── people/                        migrations  [committed]
└── src/
    ├── app/
    │   ├── layout.tsx                 root shell — nav, theme
    │   ├── page.tsx                   §6.1 dashboard
    │   ├── people/[userId]/
    │   │   ├── layout.tsx             person header + tab links
    │   │   ├── page.tsx               overview
    │   │   ├── one-on-ones/
    │   │   ├── goals/
    │   │   ├── feedback/
    │   │   └── allocation/
    │   ├── apps/[appId]/page.tsx      §6.3
    │   └── admin/                     §6.6
    │       ├── layout.tsx             section heading + tabs
    │       ├── page.tsx               users, teams, apps
    │       └── retention/page.tsx     §9.5
    ├── components/
    │   ├── ui/                        shadcn primitives
    │   ├── allocation/                allocation components
    │   └── people/                    people-records components
    ├── db/
    │   ├── allocation/{schema.ts,client.ts}
    │   └── people/{schema.ts,client.ts}
    ├── data/                          read layer
    │   ├── allocation.ts
    │   ├── entities.ts                cached
    │   └── people.ts                  force-dynamic — see §10.6
    ├── actions/                       "use server" mutations
    ├── domain/                        pure logic + colocated .test.ts
    │   ├── intervals.ts
    │   ├── metrics.ts
    │   ├── points-in-time.ts
    │   └── schemas.ts                 Zod
    └── lib/
```

The `db → data → app` direction is one-way. Route files never import from `src/db` directly; they go through `src/data`. That is what makes the caching rule in §10.6 auditable by looking at a single directory.

### 10.3 Two databases, enforced rather than intended

Implements §7 and §9.2.

- **Separate everything.** Two Drizzle instances, two connections, two migration folders, two `drizzle.config` files. Nothing is shared but the `user_id` value.
- **No SQLite `ATTACH`.** §7 requires the join to happen in application code. A consequence worth stating plainly: the people tables store `user_id` as a plain `integer` with **no foreign key**, because a cross-file foreign key is impossible. That is not a compromise — it is the mechanism.
- **`people.db` opens lazily and is allowed to be absent.**

```ts
// src/db/people/client.ts
let cached: PeopleDb | null | undefined

export function getPeopleDb(): PeopleDb | null {
  if (cached !== undefined) return cached
  if (!existsSync(PEOPLE_DB_PATH)) return (cached = null)
  cached = drizzle(new Database(PEOPLE_DB_PATH), { schema })
  return cached
}

export const peopleDbAvailable = () => getPeopleDb() !== null
```

Every people-records read returns an explicit "unavailable" result when the file is missing, rather than throwing. Those routes render an unavailable state; the dashboard drops its people-records columns (§10.5). This turns §9.2 from a claim into something with an acceptance test: **move `people.db` aside and the whole of allocation still works.**

- **Import guard.** ESLint `no-restricted-imports` prevents anything under `src/db/allocation/`, `src/data/allocation.ts` or `src/data/entities.ts` from importing `src/db/people` or `src/data/people`. The separation cannot erode by accident during a refactor.

### 10.4 Schema conventions

| Concern | Decision |
|---|---|
| Dates | `text` holding `YYYY-MM-DD`, branded as `IsoDate` |
| Timestamps | `integer({ mode: 'timestamp_ms' })` |
| Enums | `text({ enum: [...] })` — Drizzle infers a TS union |
| Percentage | `real`, with a DB-level `CHECK` |
| Intervals | Half-open `[start_date, end_date)` per §7 |

**Why text dates.** ISO-8601 sorts lexicographically, so §4.2's core query works directly against `text` columns with plain `<` and `>=` comparisons and no conversion. It honours §7's "store dates as `DATE`, not `DATETIME`" — SQLite has no real date type, and this is the representation that behaves like one. The branded `IsoDate` type stops a raw `string` being passed where a date is expected.

**§4.3's blocking rules live in the schema**, not only in application code:

```ts
export const allocation = sqliteTable('allocation', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  userId:     integer('user_id').notNull().references(() => users.id),
  appId:      integer('app_id').notNull().references(() => apps.id),
  percentage: real('percentage').notNull(),
  startDate:  text('start_date').$type<IsoDate>().notNull(),
  endDate:    text('end_date').$type<IsoDate>(),          // NULL = ongoing
  createdAt:  integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (t) => [
  check('pct_range',       sql`${t.percentage} > 0 AND ${t.percentage} <= 100`),
  check('end_after_start', sql`${t.endDate} IS NULL OR ${t.endDate} > ${t.startDate}`),
  index('alloc_user_range').on(t.userId, t.startDate, t.endDate),
  index('alloc_app_range').on(t.appId, t.startDate, t.endDate),
])
```

The two `CHECK` constraints cover the first and third blocking rules in §4.3. The **overlap** rule cannot be expressed as a `CHECK`; it is enforced inside the write transaction (§10.7).

**Connection PRAGMAs**, set on open for both databases:

```
journal_mode = WAL        foreign_keys = ON
busy_timeout = 5000       synchronous  = NORMAL
```

### 10.5 Rendering and data flow

Server Components read `src/data/*` directly. **There is no cache layer**, and that is a decision rather than an omission.

An earlier draft of this section was built on Next.js 16.3's Instant Navigations (`cacheComponents` + `partialPrefetching`). It was removed. The reasoning is recorded here so it is not reintroduced by reflex:

- That feature exists to hide **server and network latency** — a round trip to a datacentre, a query against a remote database, a cold serverless function. This app has none of those. It runs on loopback against a SQLite file opened in the same process, where reading the entire allocation table costs well under a millisecond. The latency it removes is latency this app never had.
- The cost was real: a cache-tag taxonomy to keep correct, an `updateTag`-versus-`revalidateTag` judgement on every mutation, a dev-overlay validation loop to satisfy on every route, and — worst — a caching layer that actively wanted to write note content into `.next/cache`, which then needed a carve-out to keep §9.2 true.
- Removing it deletes that entire class of problem. Navigation stays fast, because the work it was hiding was already fast.

What the framework configuration now contains is close to nothing — but one line is load-bearing and must not be lost:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],   // native module — never bundle it
  async headers() { /* production CSP — see §10.9 */ },
}
```

`serverExternalPackages` keeps Turbopack from attempting to bundle the prebuilt `.node` binary. Without it the build fails at the point the driver is first imported.

**Rendering model.**

- Every route is server-rendered per request. Allocation routes are dynamic by nature — they read `searchParams` or `params` and query the database on each request — and `revalidatePath` after a mutation keeps them honest. People-records routes additionally declare `export const dynamic = 'force-dynamic'`, for the reason given in §10.6.
- **`loading.tsx` at each route segment** gives an immediate skeleton on navigation. `<Link>`'s default `prefetch` behaviour for a dynamic route is to fetch the partial route down to the nearest `loading.tsx` boundary, so the skeleton is already in the client when you click. This is the ordinary App Router pattern and needs no configuration.
- **Prefetching only runs in production builds.** `next dev` does not prefetch at all, so navigation will feel slower while developing than it does in use. This is a property of the dev server, not of the app — do not "fix" it. It is also the reason daily use should be `npm run build && npm run start` rather than leaving `next dev` running (§10.10).
- `<Suspense>` is used *inside* a page where one panel is meaningfully slower than its siblings, so the fast panels are not held up waiting. Here it is a layout tool, chosen where it helps, not an obligation imposed by a framework flag.

**The date control (§6.1) becomes ordinary.** `?date=YYYY-MM-DD` is read at the top of the page with `await searchParams` — there is no App Shell rule to work around and no promise to thread down through boundaries:

```tsx
export default async function Dashboard({ searchParams }: PageProps<'/'>) {
  const { date = today(), teams } = await searchParams
  const [people, apps] = await Promise.all([
    getPeopleAllocationAsOf(date, teams),
    getAppsAllocationAsOf(date, teams),
  ])
  return <>{/* summary strip, people panel, apps panel */}</>
}
```

The prev/next period arrows are plain `<Link>`s; the free-form picker uses `router.replace()` with `useTransition()` for a pending state.

**Person view (§6.2) still uses one route per tab** under a shared `layout.tsx`. The justification is no longer prefetching — it is that a tab should be linkable, survive a refresh, and appear in browser history. That reason stands on its own and is the reason the decision survives the simplification.

**Dashboard rows carry people-records data**, which is where §10.3 and §10.5 meet. "Days since last 1:1" per person, and the overdue-1:1 and open-action-item counts in the summary strip, all read `people.db`. They sit in their own `<Suspense>` boundary so that the allocation panels never wait on them, never fail because of them, and simply render without those columns when `people.db` is absent.

**After a mutation**, the server action calls `revalidatePath` for the affected routes (§10.7). With no data cache in play, this does one job only: clearing the client-side Router Cache so a back-navigation cannot show a payload that predates the edit.

### 10.6 Keeping people-records content out of the build output

§9.2 requires that `allocation.db` can be handed over, demoed or screenshotted with `people.db` simply absent. That holds only if note text lives in `people.db` and nowhere else.

Dropping the cache layer (§10.5) removes the main threat outright: with no `'use cache'`, nothing is written to `.next/cache` at all. One residual path remains — **build-time prerendering**, which would bake rendered note content into `.next/server/app/`. It is closed explicitly rather than left to inference about what Next.js will decide to prerender:

```ts
// every people-records route segment
export const dynamic = 'force-dynamic'
```

Rules that follow:

- No `'use cache'`, no `unstable_cache`, and no `generateStaticParams` under `src/data/people.ts`, `src/components/people/`, or any people-records route. An ESLint `no-restricted-syntax` rule enforces this, so it cannot arrive later as a well-meaning performance tweak.
- The §9.5 hard-delete is genuinely complete: deleting the rows from `people.db` deletes the data, with no cache entry and no prerendered artefact left to sweep up afterwards.
- Note content never appears in a build output that could be committed, copied or shared.
- **§9.5's leaver flow crosses the boundary between the two, so it is specified here.** Deactivating a user is an allocation write and must never cascade into the people records automatically: allocation history is retained for capacity analysis, while personal notes are not. `deactivateUser()` therefore writes only to `allocation.db`, then — if `peopleDbAvailable()` — returns a flag that prompts a *separate, explicitly confirmed* hard delete of that user's people records. Two actions, two confirmations, never one cascading write.

**The §5.2 prep panel is where the separation gets tested.** That panel is the whole reason the two halves share an application, and it deliberately mixes them: current allocation and recent allocation changes come from `allocation.db`, while open action items, unshared feedback and stalling goals come from `people.db`. It is assembled from two independent reads in the component tree, never from one function that queries both databases. That keeps the allocation half rendering normally when `people.db` is absent, and keeps a single failure on the people side from taking the panel down.

**§9.3's guidance is a component, not a notice.** The requirement is persistent helper text in the 1:1 editor, explicitly *not* a dismissible one-time notice. It is implemented as a static, always-rendered panel in the editor layout with no dismiss control and no persisted "seen" state — there is nothing to dismiss and nothing to remember. It is part of the page, so it is present before any note content loads.

### 10.7 Mutations and validation

All writes are `"use server"` actions in `src/actions/`. Zod schemas live in `src/domain/schemas.ts` and are parsed **inside the action**, which is the only validation that is ever a guarantee.

Forms are plain controlled React state submitted through `useTransition()`, calling the server action directly. `react-hook-form` and `zodResolver` are deliberately **not** installed: the action already returns typed `FieldError[]`, so a second client-side copy of the schema would be one more dependency and one more thing to keep in sync, for a single-user local tool where the round trip is a few milliseconds. The forms render `result.errors` returned by the action, and per-field errors are matched by the `field` key.

**The return type is what makes §4.3 implementable.** That section requires overlap and range errors to *block*, while over-100% allocation only *warns* and must never prevent the save. A boolean success flag cannot express that, so actions return:

```ts
type ActionResult<T> =
  | { ok: true;  data: T; warnings: Warning[] }   // saved, with caveats to display
  | { ok: false; errors: FieldError[] }           // rejected
```

An over-allocated save returns `ok: true` *and* a warning, which the editor renders as a non-blocking banner. The row is written.

**`changeAllocation()` is one synchronous transaction.** §4.2 defines a four-part sequence that must be atomic — a crash between steps 2 and 3 would silently delete someone's allocation:

```ts
export async function changeAllocation(input: ChangeInput): Promise<ActionResult<Allocation>> {
  const parsed = changeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) }

  const result = db.transaction((tx) => {
    const conflicts = findOverlaps(tx, input.userId, input.appId, input.startDate, input.endDate)
    if (conflicts.length) throw new OverlapError(conflicts)      // rolls back

    tx.update(allocation).set({ endDate: input.effectiveDate }).where(eq(allocation.id, input.id)).run()
    const created = tx.insert(allocation).values({ ...next }).returning().get()
    tx.insert(allocationChange).values([
      { allocationId: input.id,  changeType: 'ended',   note: input.note, changedAt: new Date() },
      { allocationId: created.id, changeType: 'created', note: input.note, changedAt: new Date() },
    ]).run()
    return created
  })

  revalidatePath('/')                                   // dashboard
  revalidatePath(`/people/${input.userId}`, 'layout')   // person view, all tabs
  revalidatePath(`/apps/${input.appId}`)
  return { ok: true, data: result, warnings: overAllocationWarnings(...) }
}
```

better-sqlite3 is synchronous, so `db.transaction()` is a real transaction with no interleaving and no await points inside it. **This is the single strongest reason for choosing it** over the alternatives considered: the audit trail in §4.2 is only trustworthy if it cannot half-happen.

The §4.3 overlap check runs *inside* the transaction rather than before it, so it cannot be invalidated between check and write.

**One dialog, three modes.** `AllocationDialog` takes `mode: 'create' | 'change' | 'correct'` and renders the same fields against a different action, because the three are the same form with different history semantics and splitting them would let the three drift apart. `create` and `change` are what §6.4 nudges toward; `correct` is the escape hatch for a typo, and is the only one that mutates a row in place rather than adding to the trail.

`create` is the only mode that needs the user and app lists, since `change` and `correct` operate on a row whose user and app are already fixed and not editable. The lists are read on the server and passed to the trigger button, so a page that only ever edits existing rows does not query them:

```tsx
// app detail — the app is fixed and already loaded, so only the free side is queried
<NewAllocationButton
  label="Allocate someone"
  users={await getAllUsers()}
  apps={[{ id: app.id, name: app.name }]}
  defaultAppId={app.id}
/>
```

The dialog prefills whichever side is fixed by the screen it was opened from (`defaultAppId` on app detail, `defaultUserId` on the person's Allocation tab) and locks that field, so the entry point cannot be contradicted by the form.

### 10.8 Domain layer

`src/domain/` holds pure functions — no database, no React, no I/O — each with a colocated `.test.ts` run by `node --test`. Node 26 strips TypeScript types natively, so unit testing adds **zero dependencies**.

- **`intervals.ts`** — half-open overlap, containment, splitting. The boundary case §7 exists to prevent is pinned by a test: an allocation ending `2026-02-01` and one starting `2026-02-01` do **not** overlap.
- **`metrics.ts`** — §4.4: user totals, app total against `required_capacity`, the under/full/over classification, unallocated detection.
- **`points-in-time.ts`** — the subtlest rule in the document. §4.3 requires the 100% check to evaluate **per point in time across the affected range**, not just for today: a change can be fine on its start date and push someone to 130% six weeks later when another allocation begins. The algorithm collects every boundary date in the affected window, evaluates the sum at each, and returns the intervals that breach. This gets the heaviest test coverage of anything in the codebase.

Putting these in a pure layer means the hardest logic in the app is testable without a database, a browser, or a running server.

### 10.9 Local-only posture, machine-enforced

§7 and §9.1 state that no app data leaves the machine. Rather than treat that as a promise, the architecture makes it enforced:

| Requirement | Mechanism |
|---|---|
| No external network calls | **Production CSP** via `next.config.ts` `headers()`: `default-src 'self'; connect-src 'self'; img-src 'self' data:`. The browser blocks any outbound request the app could make. Dev is exempt — HMR needs `unsafe-eval` |
| No telemetry | Next.js telemetry is **on by default**. `NEXT_TELEMETRY_DISABLED=1` in `.env`, plus `npx next telemetry disable`. Verify with `npx next telemetry status` |
| Not reachable off-box | `--hostname 127.0.0.1` on both `dev` and `start`. Loopback only, never `0.0.0.0` |
| No build-time fetches | No `next/font/google` — system font stack. No remote images |
| No remote cache | There is no cache layer (§10.5). No `'use cache'`, no remote cache handler, nothing written to `.next/cache` |
| No third-party DB UI | `drizzle-kit studio` is **not installed**. Its browser UI is served from `local.drizzle.studio`; the data connection stays on localhost, but a third-party page that can talk to `people.db` is not a risk worth taking for convenience |
| No AI on people records | §7's rule stands. No API client is present in the dependency tree to make it possible |

Seed data uses fictional names only, per §7.

### 10.10 Scripts and build order

```jsonc
"dev":       "next dev --hostname 127.0.0.1",
"build":     "next build",
"start":     "next start --hostname 127.0.0.1",
"test":      "node --test src/domain/*.test.ts",
"lint":      "eslint .",
"db:generate:allocation": "drizzle-kit generate --config=drizzle.config.allocation.ts",
"db:migrate:allocation":  "drizzle-kit migrate  --config=drizzle.config.allocation.ts",
"db:generate:people":     "drizzle-kit generate --config=drizzle.config.people.ts",
"db:migrate:people":      "drizzle-kit migrate  --config=drizzle.config.people.ts",
"db:seed":   "node scripts/seed.ts"
```

Mapping §8's build order onto this architecture:

| §8 step | Lands in | Notes |
|---|---|---|
| 1. Schema, migrations, seed | `src/db/**`, `drizzle/**`, `scripts/seed.ts` | Both databases. Fictional names |
| 2. Entity CRUD | `src/actions/entities.ts`, `src/app/admin/` | Reads live in `src/data/allocation.ts` — users, teams and apps are allocation tables. Deactivate, never delete (§6.6) |
| 3. Allocation create/edit | `src/actions/allocation.ts`, `src/domain/intervals.ts` | The §10.7 transaction |
| 4. "As of D" + metrics | `src/data/allocation.ts`, `src/domain/metrics.ts` | The §4.2 core query |
| 5. Dashboard | `src/app/page.tsx` | The §10.5 Suspense split |
| 6. Person view | `src/app/people/[userId]/` | Overview + Allocation tabs |
| 7. 1:1s + carry-over | `src/data/people.ts`, `src/app/people/[userId]/one-on-ones/` | §10.6 applies from the first line. Hard-delete (§9.5) built here, not later |
| 8. Goals and feedback | `src/components/people/` | |
| 9. App detail + chart | `src/app/apps/[appId]/` | shadcn `chart` |
| 10. Audit, retention, polish | `src/app/admin/retention/`, `src/components/allocation/change-history.tsx`, `src/app/**/loading.tsx` | §9.5 retention review; §4.2 audit trail surfaced on the person and app views |

**Acceptance checks for the development phase:**

- `npx next telemetry status` reports disabled
- `node --test` passes — especially the half-open boundary and per-point-in-time cases
- Every route has a `loading.tsx`, and navigation shows that skeleton rather than a blank or frozen page
- `mv data/people.db /tmp && npm run dev` — **allocation remains fully usable with people data absent.** This is the §9.2 acceptance test, and it should be run whenever the people side is touched
