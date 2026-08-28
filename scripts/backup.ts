/**
 * Makes a portable copy of the databases — the half of a machine transfer that
 * git cannot do, since `data/` is gitignored (§7) and must stay that way.
 *
 * Uses `VACUUM INTO` rather than copying the file. A live database has a `-wal`
 * sidecar holding committed pages that are not yet in the main file, so copying
 * `allocation.db` alone can silently lose the most recent writes. `VACUUM INTO`
 * writes a single checkpointed, defragmented file with no sidecars, and does it
 * inside a read transaction, so it is consistent even if the app is running.
 *
 * The two databases are written as two separate files, deliberately. §7 wants
 * `allocation.db` to be movable "without the people data being present at all",
 * and that property is worth just as much in a backup as it is at runtime.
 *
 * Usage:  npm run db:backup [-- <directory>]
 */
import Database from "better-sqlite3";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ALLOCATION_DB_PATH, PEOPLE_DB_PATH } from "../src/db/paths.ts";

interface Copied {
  file: string;
  bytes: number;
  tables: Record<string, number>;
}

function sqliteVersion(): string {
  const db = new Database(":memory:");
  try {
    return (db.prepare("SELECT sqlite_version() AS v").get() as { v: string }).v;
  } finally {
    db.close();
  }
}

function stamp(): string {
  const iso = new Date().toISOString();
  return `${iso.slice(0, 10)}-${iso.slice(11, 19).replaceAll(":", "")}`;
}

function copy(source: string, destination: string): Copied {
  const db = new Database(source, { readonly: true });
  try {
    // Parameter binding is not allowed in VACUUM INTO, and the path comes from
    // this script rather than from input, so it is quoted the SQL way.
    db.prepare(`VACUUM INTO '${destination.replaceAll("'", "''")}'`).run();
  } finally {
    db.close();
  }

  const check = new Database(destination, { readonly: true });
  try {
    const [{ integrity_check: result }] = check.pragma("integrity_check") as [
      { integrity_check: string },
    ];
    if (result !== "ok") {
      throw new Error(`Backup of ${source} failed its integrity check: ${result}`);
    }
    const tables = check
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    const counts: Record<string, number> = {};
    for (const { name } of tables) {
      const row = check.prepare(`SELECT count(*) AS n FROM "${name}"`).get() as { n: number };
      counts[name] = row.n;
    }
    return {
      file: path.basename(destination),
      bytes: statSync(destination).size,
      tables: counts,
    };
  } finally {
    check.close();
  }
}

const target = process.argv[2] ?? path.join("backup", stamp());

if (existsSync(target)) {
  console.error(`Refusing to write into an existing directory: ${target}`);
  process.exit(1);
}
if (!existsSync(ALLOCATION_DB_PATH)) {
  console.error(`No allocation database at ${ALLOCATION_DB_PATH}. Nothing to back up.`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });

const allocation = copy(ALLOCATION_DB_PATH, path.join(target, "allocation.db"));
const people = existsSync(PEOPLE_DB_PATH)
  ? copy(PEOPLE_DB_PATH, path.join(target, "people.db"))
  : null;

writeFileSync(
  path.join(target, "manifest.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      node: process.version,
      sqlite: sqliteVersion(),
      allocation,
      people,
    },
    null,
    2,
  ) + "\n",
);

const rows = (c: Copied) => Object.values(c.tables).reduce((a, b) => a + b, 0);
console.log(`Backup written to ${target}`);
console.log(`  allocation.db  ${rows(allocation)} rows`);
console.log(
  people
    ? `  people.db      ${rows(people)} rows`
    : "  people.db      not present on this machine — nothing to copy",
);
