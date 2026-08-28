# Team Management Tool — agent guide

A local-only engineering-management tool. `team-management-tool-design.md` is
the specification and the authority: sections are cited throughout the code as
`§4.2`, `§9.5` and so on. **Read the cited section before changing code that
cites it.** Where this file and the design document disagree, the document
wins — and the disagreement is a bug in one of them.

## The three rules that are easy to break

**1. Two databases, never joined in SQL.** `allocation.db` and `people.db` are
separate files. There is no `ATTACH` and no cross-file foreign key — the people
tables store `user_id` as a plain integer, and that is the mechanism, not a
compromise. Joins happen in the component tree.

**2. Allocation must work with `people.db` absent.** This is §9.2 and it is
testable, so test it: `mv data/people.db /tmp && npm run dev` — every route
must still render and the dashboard must drop its people-records columns rather
than show zeros. Reads go through `getPeopleDb()`, which returns `null` when the
file is missing; `peopleRecordsAvailable()` is the guard. Run this whenever you
touch the people side. Move the `-wal` and `-shm` with it.

**3. People-records content is never cached and never prerendered.** No
`use cache` under `src/data/people.ts` or the people components. The root layout
sets
`export const dynamic = "force-dynamic"` so nothing is baked into the build
output — a `○ (Static)` route in `next build` output is a bug.

## Domain invariants

- **Dates are `text` in `YYYY-MM-DD`**, typed as the branded `IsoDate`. They
  sort lexicographically, which is why the §4.2 "as of D" comparison works
  directly in SQL. Never a `Date` in the database.
- **Intervals are half-open `[start, end)`.** An allocation ending on D is
  already gone on D. `src/domain/intervals.ts` owns this; touching boundaries
  do not overlap.
- **§4.2: never mutate an allocation to change it.** End the old row, insert a
  successor, write two `AllocationChange` rows — all inside one synchronous
  better-sqlite3 transaction. `correctAllocation` is the deliberate exception
  and says so in the UI.
- **§4.3 draws a line a boolean cannot express.** Overlap, date order and
  percentage range are *blocking*. A user summing over 100% is a *warning* that
  must never block the save. Hence `ActionResult<T>` carrying `warnings` on
  success. The 100% check evaluates per point in time across the affected
  range, not just today — `src/domain/points-in-time.ts`, and it has the most
  test coverage in the repo for a reason.
- **§6.6: entities deactivate, never delete.** Deleting a user would orphan the
  allocation history the temporal model exists to protect. People-records
  deletion is a separate, genuine hard delete (§9.5).

## Local-only posture (§7)

No cloud sync, no telemetry, no external call carrying app data, no AI API
touching people-records content. In practice: telemetry is disabled in `.env`,
there is a production CSP with `connect-src 'self'`, `next/font/google` is banned
(build-time fetch — use the system stack), `drizzle-kit studio` is not
installed, and both servers bind `127.0.0.1`.

## Conventions

- Imports of local modules carry the `.ts` extension (`@/data/allocation.ts`).
  This is deliberate and `allowImportingTsExtensions` is on.
- Forms are controlled state plus `useTransition` calling a server action
  directly. `react-hook-form`/`zodResolver` are **not** installed; zod parses
  server-side, and the action returns `FieldError[]` the form renders.
- shadcn's `CardHeader` is a CSS grid, so `flex justify-between` on it does
  nothing. Put header buttons in `<CardAction>`.
- Tests are `node --test` on `.ts` files. No test framework, no runner config.
  Domain logic is pure and colocated with its `.test.ts`.
- Seed data uses fictional names only (§7). Keep it that way.

## Two settings that look removable and are not

- **`.npmrc` sets `ignore-scripts`.** `better-sqlite3` ships prebuilt binaries
  but also a `binding.gyp` with no install script, and npm reacts to that pair
  by running `node-gyp rebuild`, which needs a toolchain a laptop rarely has.
  Removing the line breaks `npm ci` on a clean machine.
- **`.gitignore` directory rules are anchored** (`/data/`, not `data/`). An
  unanchored rule matches at any depth; `data/` once silently kept the whole of
  `src/data/` out of the repository.

## Layout

```
src/
  app/          routes; loading.tsx per segment
  components/   ui/ is shadcn; the rest is feature-grouped
  db/           {allocation,people}/{schema,client}.ts — one connection each
  data/         reads — allocation.ts | people.ts (never cached, absence-tolerant)
  actions/      "use server" mutations, all returning ActionResult
  domain/       pure logic + colocated tests: date, intervals, points-in-time, metrics
drizzle/        migrations, committed
scripts/        seed, backup, restore
```

## Commands

```sh
npm run dev            # 127.0.0.1:3000
npm run build && npm start
npm test               # 44 domain tests
npm run lint && npm run typecheck
npm run db:migrate     # creates data/ if absent
npm run db:seed
npm run db:backup      # VACUUM INTO, not a file copy
npm run db:restore -- <dir>
```

Before calling work done: `npm run lint`, `npm run typecheck`, `npm test`, and
`npm run build` — and check the build lists every route as `ƒ (Dynamic)`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
