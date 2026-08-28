/**
 * The other half of a machine transfer: puts a `db:backup` directory back into
 * `data/`.
 *
 * Restoring is not a merge. It replaces whatever is in `data/`, so it refuses
 * to run over an existing database unless `--force` is passed, and it never
 * touches a database the backup does not contain — restoring an
 * allocation-only backup on a machine that already has `people.db` leaves the
 * people data alone rather than deleting it.
 *
 * Usage:  npm run db:restore -- <directory> [--force]
 */
import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { ALLOCATION_DB_PATH, DATA_DIR, PEOPLE_DB_PATH } from "../src/db/paths.ts";

const args = process.argv.slice(2);
const force = args.includes("--force");
const source = args.find((arg) => !arg.startsWith("--"));

if (!source) {
  console.error("Usage: npm run db:restore -- <directory> [--force]");
  process.exit(1);
}
if (!existsSync(source)) {
  console.error(`No such backup directory: ${source}`);
  process.exit(1);
}

function restore(name: string, destination: string): boolean {
  const file = path.join(source!, name);
  if (!existsSync(file)) return false;

  if (existsSync(destination) && !force) {
    console.error(
      `${destination} already exists. Move it aside, or re-run with --force to replace it.`,
    );
    process.exit(1);
  }

  const check = new Database(file, { readonly: true });
  try {
    const [{ integrity_check: result }] = check.pragma("integrity_check") as [
      { integrity_check: string },
    ];
    if (result !== "ok") {
      console.error(`${file} failed its integrity check: ${result}`);
      process.exit(1);
    }
  } finally {
    check.close();
  }

  mkdirSync(DATA_DIR, { recursive: true });
  copyFileSync(file, destination);
  // A stale sidecar from the replaced database would be read as belonging to
  // the new one, so both go.
  for (const suffix of ["-wal", "-shm"]) rmSync(`${destination}${suffix}`, { force: true });
  return true;
}

const allocation = restore("allocation.db", ALLOCATION_DB_PATH);
const people = restore("people.db", PEOPLE_DB_PATH);

if (!allocation && !people) {
  console.error(`${source} contains no allocation.db or people.db.`);
  process.exit(1);
}

console.log(`Restored into ${DATA_DIR}`);
console.log(`  allocation.db  ${allocation ? "restored" : "not in this backup — left as is"}`);
console.log(`  people.db      ${people ? "restored" : "not in this backup — left as is"}`);
