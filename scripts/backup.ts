/**
 * Makes a portable copy of the database — the half of a machine transfer that
 * git cannot do, since `data/` is gitignored (§7) and must stay that way.
 *
 * Uses `VACUUM INTO` rather than copying the file. A live database has a `-wal`
 * sidecar holding committed pages that are not yet in the main file, so copying
 * `app.db` alone can silently lose the most recent writes. `VACUUM INTO` writes
 * a single checkpointed, defragmented file with no sidecars, and does it inside
 * a read transaction, so it is consistent even if the app is running.
 *
 * Usage:  npm run db:backup [-- <directory>]
 */
import Database from "better-sqlite3";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DB_PATH } from "../src/db/paths.ts";

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
if (!existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH}. Nothing to back up.`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });

const database = copy(DB_PATH, path.join(target, "app.db"));

writeFileSync(
  path.join(target, "manifest.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      node: process.version,
      sqlite: sqliteVersion(),
      database,
    },
    null,
    2,
  ) + "\n",
);

const rows = (c: Copied) => Object.values(c.tables).reduce((a, b) => a + b, 0);
console.log(`Backup written to ${target}`);
console.log(`  app.db  ${rows(database)} rows`);
