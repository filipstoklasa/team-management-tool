# Team Management Tool

Local-first allocation tracking and 1:1 management for engineering managers.

The tool covers two halves of the job that are normally split across unrelated
systems. **Allocation** answers who is working on what, at what percentage, as of
any date — past, present or planned. **People** holds 1:1 records, goals and
feedback per report. The connection between them is the point: preparing a 1:1
surfaces what that person is actually allocated to, next to their goals and open
action items.

Everything runs on localhost against two SQLite files. No accounts, no cloud
services, no telemetry, and no outbound request carrying application data.

![Dashboard](docs/screenshots/dashboard.jpg)

## Table of contents

- [Features](#features)
- [Getting started](#getting-started)
- [Architecture](#architecture)
- [Data handling](#data-handling)
- [Backup and restore](#backup-and-restore)
- [Development](#development)
- [Documentation](#documentation)

## Features

### Temporal allocation model

An allocation is never edited in place. Changing a percentage closes the current
record and opens a successor, so history remains queryable rather than being
overwritten. Every screen runs the same "as of date D" query with a different D,
which means a past quarter and a planned future state render through the same
path as today.

![Time travel](docs/screenshots/time-travel.jpg)

*The dashboard three months forward. Risk Data Pipeline reaches full staffing
once a planned allocation begins.*

### Capacity warnings that do not block

Overlapping date ranges and out-of-range percentages are rejected. Exceeding
100% allocation is not: it is flagged in the person's row and as a banner on
save, but the write always succeeds, because over-allocation is a condition to
observe rather than an error to prevent.

The check evaluates each point in time across the modified range, so a breach
beginning three months out is reported today, and shortening an allocation that
ends a breach clears the warning.

### Overdue 1:1s

A 1:1 is overdue 30 days after the last one, and someone with no 1:1 recorded at
all counts as overdue rather than as missing data — they are the easiest people
to lose track of. The interval is fixed for everyone; there is no per-person
cadence to configure. The dashboard counts them and the people panel highlights
the figure at the same threshold.

### 1:1 preparation

Opening a 1:1 assembles what changed since the previous one: open action items,
feedback recorded but not yet delivered, goals that have stalled, and allocation
changes made since the last conversation.

![1:1 prep panel](docs/screenshots/one-on-one-prep.jpg)

*The prep panel sits alongside the notes. The guidance card is part of the
data-handling design — it states what belongs in these records and what does
not.*

### Screens

| Screen | Contents |
|---|---|
| Dashboard | People and apps as of any date, ordered so problems surface first. Team filter and summary counts. |
| People | Every active person with allocation and days since last 1:1, as of today. The way into a person. |
| Person | Overview, 1:1s, goals, feedback and a Gantt-style allocation timeline. One route per tab, so tabs are linkable and survive a refresh. |
| Apps | Every active app against its required capacity, as of today. The way into an app. |
| App | Staffing over time against required capacity, current and planned assignees, and the change history. |
| Admin | People, teams and apps. Entities are deactivated, never deleted. |
| Retention review | 1:1 notes and feedback past a configurable age, listed and deleted in bulk. |

![Person allocation](docs/screenshots/person-allocation.jpg)

*A person's allocation timeline. The vertical rule marks today; bars extend into
planned work.*

![App detail](docs/screenshots/app-detail.jpg)

*Staffing over time, sampled at allocation boundaries rather than fixed
intervals, so every step in the line is a real change.*

## Getting started

### Requirements

Node.js 24 or later — `.nvmrc` pins the tested version. No Docker, database
server or native build toolchain is required.

### Installation

```sh
git clone https://github.com/filipstoklasa/team-management-tool.git
cd team-management-tool
npm ci
cp .env.example .env
npm run db:migrate      # creates data/ and both databases
npm run db:seed         # optional: sample data, fictional names
```

### Running

```sh
npm run build
npm start
```

The server listens on <http://127.0.0.1:3000> and binds to loopback only.

Use `npm run dev` while developing. Prefer a production build when evaluating
the application: the dev server does not prefetch, so navigation is noticeably
slower than the real thing.

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3 (App Router, Turbopack), React 19, TypeScript strict |
| Persistence | SQLite via better-sqlite3, Drizzle ORM, migrations committed |
| Interface | Tailwind CSS v4, shadcn/ui, Recharts |
| Tests | `node --test` on TypeScript sources, no test dependencies |

```
src/
  app/          routes; loading.tsx per segment
  components/   ui/ is shadcn; the rest is feature-grouped
  db/           {allocation,people}/ — one connection each
  data/         reads: allocation.ts | people.ts
  actions/      "use server" mutations
  domain/       pure logic with colocated tests
drizzle/        migrations
scripts/        seed, backup, restore
```

**Two databases, never joined in SQL.** `allocation.db` and `people.db` are
separate files with no `ATTACH` and no cross-file foreign key. The People module
stores `user_id` as a plain integer and the join happens in the component tree.
That constraint is what makes the next property achievable rather than
aspirational.

**Allocation works with `people.db` absent.** Remove the file and allocation
remains fully functional: the dashboard drops its People columns instead of
reporting zeros, and People screens report that the records are not present. A
standing acceptance test covers this.

**Dates are text, intervals are half-open.** `YYYY-MM-DD` sorts
lexicographically, so "as of D" is a direct SQL comparison. `[start, end)` means
an allocation ending on D is already gone on D, which removes the off-by-one
where one assignment ends and another begins the same day.

**Changes are transactional.** better-sqlite3 is synchronous, so closing a
record, inserting its successor and writing both audit entries happen in one
transaction with no await points inside it. An audit trail that can half-apply is
not worth keeping.

## Data handling

The People module holds notes about identifiable individuals and is held to a
stricter standard than the rest of the application.

- **Data does not leave the machine.** No cloud sync, no telemetry, and no AI API
  processing note content. A production Content-Security-Policy with
  `connect-src 'self'` makes the browser enforce this rather than relying on
  convention.
- **Nothing is cached or prerendered.** Note text never enters the build output
  or a cache directory.
- **Deletion is real.** Removing a person's records is a hard delete in a single
  transaction — no soft-delete flag and no archive table.
- **Records expire.** The retention review lists 1:1s and feedback older than a
  configurable window, 24 months by default, and deletes them in bulk. The
  default posture is expiry rather than accumulation.
- **Deactivating a leaver prompts for deletion** of their People records. It is a
  prompt rather than a cascade: allocation history is retained for capacity
  analysis, personal notes need not be.

When removing `people.db` from a machine, remove its sidecars as well. A `-wal`
file holds committed pages that a clean shutdown checkpoints away but a crash
does not:

```sh
rm -f data/people.db data/people.db-wal data/people.db-shm
```

## Backup and restore

`data/` is excluded from version control, so the repository rebuilds the
application but never carries its contents. Transferring an installation is
therefore two operations: the code through git, the databases through a backup.

### Creating a backup

```sh
npm run db:backup       # writes backup/<timestamp>/
```

The script uses SQLite's `VACUUM INTO` rather than a file copy. A live database
keeps recent commits in a `-wal` sidecar, so copying `allocation.db` by hand can
silently drop the most recent edits. Each output file is integrity-checked, and a
`manifest.json` records row counts for verification after transfer.

`backup/` is gitignored. Move it manually — on removable or encrypted media
rather than a cloud drive when it contains `people.db`.

### Restoring

```sh
nvm use                                  # or fnm use
npm ci
cp .env.example .env
npm run db:restore -- path/to/backup
npm run db:migrate
npm run build && npm start
```

Restore before migrating. The backup carries its own migration history, so
`db:migrate` applies only what was added since and correctly does nothing when
the backup is current.

`db:restore` refuses to overwrite an existing database without `--force`, and
never touches a database the backup does not contain.

Do not copy `node_modules/` between machines — it contains a native binary built
for the source machine's platform. `npm ci` fetches the correct one.

### Allocation data without People data

```sh
mkdir transfer && cp backup/<timestamp>/allocation.db transfer/
npm run db:restore -- transfer
```

The application runs normally and People screens report that the records are not
present. This is the supported path for a demo, a screenshot, or handing the
allocation side to someone else.

## Development

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on 127.0.0.1:3000 |
| `npm test` | Domain unit tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` followed by `tsc --noEmit` |
| `npm run db:migrate` | Apply migrations to both databases |
| `npm run db:seed` | Load sample data |
| `npm run db:reset` | Drop, recreate and reseed |
| `npm run db:backup` | Consistent copy of both databases |
| `npm run db:restore -- <dir>` | Restore from a backup directory |

Domain logic is pure and tested in isolation with `node --test`, run directly
against `.ts` files through Node's native type stripping.

Two settings look removable and are not:

- **`.npmrc` sets `ignore-scripts`.** better-sqlite3 ships prebuilt binaries but
  also declares a `binding.gyp` with no install script, and npm responds to that
  combination by running `node-gyp rebuild`, which requires a C++ toolchain. The
  line is what keeps `npm ci` working on a clean machine.
- **`.gitignore` directory rules are anchored** (`/data/`, not `data/`). An
  unanchored rule matches at any depth; `data/` once excluded the whole of
  `src/data/` from the repository.

## Documentation

[`team-management-tool-design.md`](team-management-tool-design.md) is the
specification: domain model, validation rules, screen definitions and the
data-handling regime. The code cites it by section (`§4.2`, `§9.5`), and those
citations are intended to be followed when changing the code that carries them.

[`AGENTS.md`](AGENTS.md) covers contributor conventions and the invariants that
are easiest to break.

---

Built with [Claude Code](https://claude.com/claude-code).
