# Team Management Tool

An engineering manager's tool for allocation and people management. Runs
entirely on your own machine: no cloud sync, no telemetry, no external calls
carrying app data (§7 of `team-management-tool-design.md`).

Two SQLite files, deliberately separate:

| File | Holds | Notes |
|---|---|---|
| `data/allocation.db` | People, teams, apps, allocations, audit trail | Module A |
| `data/people.db` | 1:1 notes, action items, goals, feedback | Module B — personal data |

They join in application code on `user_id`, never across files, so
`allocation.db` works on its own. Deleting or withholding `people.db` leaves
the whole allocation side fully usable.

## Running it

```sh
npm ci
npm run db:migrate     # creates data/ and both databases
npm run db:seed        # optional — fictional sample data
npm run build && npm start
```

Then open <http://127.0.0.1:3000>. It binds to loopback only.

Use `build && start` for daily use rather than leaving `npm run dev` running —
the dev server does not prefetch, so navigation feels slower than the real
thing.

## Moving to another laptop

Everything needed to rebuild the app is in git. **Your data is not**, and must
not be: `data/` is gitignored because `people.db` holds personal data about
identifiable colleagues. So a transfer is two steps.

**On the old machine:**

```sh
npm run db:backup                 # → backup/<timestamp>/
```

This writes `allocation.db`, `people.db` and a `manifest.json` recording row
counts. It uses SQLite's `VACUUM INTO`, not a file copy — a live database keeps
recent commits in a `-wal` sidecar, so copying `allocation.db` by hand can
silently lose your latest edits. Each file is integrity-checked before the
manifest is written.

Copy the repository (or `git clone` it) and the backup directory to the new
machine. `backup/` is gitignored, so move it yourself — a USB stick or an
encrypted volume, not a cloud drive if it contains `people.db`.

**On the new machine:**

```sh
nvm use                                  # or fnm use — Node version from .nvmrc
npm ci
cp .env.example .env
npm run db:restore -- path/to/backup     # data first
npm run db:migrate                       # then top up any newer migrations
npm run build && npm start
```

Restore before migrate. The backup carries its own migration history, so
`db:migrate` applies only what was added since — and if the backup is current,
it correctly does nothing.

`db:restore` refuses to overwrite an existing database unless you pass
`--force`, and it never touches a database the backup does not contain. So
restoring an allocation-only backup onto a machine that has `people.db` leaves
the people data alone.

**Do not copy `node_modules/`.** It contains a compiled binary for the old
machine's OS and CPU. `npm ci` fetches the right one.

### Taking allocation data without the people data

To demo the tool, or hand the allocation side to someone else, copy only
`allocation.db` out of the backup:

```sh
mkdir transfer && cp backup/<timestamp>/allocation.db transfer/
npm run db:restore -- transfer
```

The app runs normally; Module B screens say the records are not present.

When you want `people.db` genuinely gone from a machine, delete its sidecars
with it — `data/people.db-wal` and `data/people.db-shm`. The `-wal` holds
committed pages that a clean shutdown checkpoints away but a crash does not, so
it can still contain note text after the main file is deleted:

```sh
rm -f data/people.db data/people.db-wal data/people.db-shm
```

## Notes for whoever maintains this

- **`.npmrc` sets `ignore-scripts`.** `better-sqlite3` ships prebuilt binaries
  in its tarball but also ships a `binding.gyp` with no install script, and npm
  responds to that pair by running `node-gyp rebuild` — which needs a C++
  toolchain most laptops do not have. Removing this line breaks `npm ci` on a
  clean machine.
- **`.gitignore` directory rules are anchored** (`/data/`, not `data/`). An
  unanchored rule matches at any depth, which once kept the whole of
  `src/data/` out of the repository.
- Migrations in `drizzle/` are committed and must stay that way — they are how
  a fresh checkout builds its schema.
- `npm test` runs the domain unit tests with `node --test`, no test framework.
- The §9.2 acceptance test, worth re-running whenever Module B is touched:
  `mv data/people.db /tmp && npm run dev` — Module A must remain fully usable.
  Move the `-wal` and `-shm` with it, or you leave orphaned sidecars behind.

The full product and technical design is in `team-management-tool-design.md`.
