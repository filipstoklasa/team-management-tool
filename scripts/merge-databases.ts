/**
 * One-time move from two database files to one.
 *
 * `allocation.db` and `people.db` were separate so that the allocation half
 * could be handed over with the people half simply absent. That requirement is
 * gone, and with it the cost it imposed: no foreign key on `user_id`, no
 * transaction spanning the two, and an absent-database branch in every read.
 *
 * What this does:
 *   1. copies allocation.db into app.db with VACUUM INTO — checkpointed and
 *      defragmented, so no -wal sidecar is left behind holding recent writes
 *   2. runs the migrations, which adds the people tables with real foreign keys
 *   3. copies every row out of people.db into it, parents before children
 *
 * Both source files are left exactly as they are. Nothing here deletes
 * anything, so a bad run is recovered by deleting app.db and running it again.
 *
 * Usage:  npm run db:merge [-- --drop-orphans]
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync } from "node:fs";
import path from "node:path";
import { DATA_DIR, DB_PATH } from "../src/db/paths.ts";
import { applyPragmas } from "../src/db/pragmas.ts";

const ALLOCATION_DB = process.env.ALLOCATION_DB_PATH ?? path.join(DATA_DIR, "allocation.db");
const PEOPLE_DB = process.env.PEOPLE_DB_PATH ?? path.join(DATA_DIR, "people.db");

/** Parents before children: action_items cite a 1:1, goal_updates cite a goal. */
const TABLES = ["one_on_ones", "goals", "goal_updates", "action_items", "feedback"] as const;

/** Tables whose rows point at a user, and so can be orphaned by a missing one. */
const USER_SCOPED = ["one_on_ones", "goals", "action_items", "feedback"] as const;

const dropOrphans = process.argv.includes("--drop-orphans");

if (!existsSync(ALLOCATION_DB)) {
  console.error(`No allocation database at ${ALLOCATION_DB}. Nothing to merge.`);
  process.exit(1);
}
if (existsSync(DB_PATH)) {
  console.error(
    `${DB_PATH} already exists. Delete it first if you want to redo the merge — ` +
      `this script will not write over a database it did not create.`,
  );
  process.exit(1);
}

// 1. allocation.db -> app.db
const source = new Database(ALLOCATION_DB, { readonly: true });
try {
  source.prepare(`VACUUM INTO '${DB_PATH.replaceAll("'", "''")}'`).run();
} finally {
  source.close();
}
console.log(`Copied ${path.basename(ALLOCATION_DB)} -> ${path.basename(DB_PATH)}`);

// 2. add the people tables
const sqlite = new Database(DB_PATH);
applyPragmas(sqlite);
migrate(drizzle(sqlite), { migrationsFolder: "drizzle" });
console.log("Applied migrations — people tables created with foreign keys");

// 3. move the rows across
if (!existsSync(PEOPLE_DB)) {
  console.log(`No ${path.basename(PEOPLE_DB)} on this machine — nothing further to copy.`);
  sqlite.close();
  process.exit(0);
}

sqlite.prepare(`ATTACH DATABASE '${PEOPLE_DB.replaceAll("'", "''")}' AS old`).run();

// A user_id in people.db with no matching user is now a foreign key violation
// rather than a dangling integer. Say so before the insert fails, because the
// error SQLite gives on its own does not name the row.
const orphans: Record<string, number> = {};
for (const table of USER_SCOPED) {
  const { n } = sqlite
    .prepare(
      `SELECT count(*) AS n FROM old."${table}" o
        WHERE o.user_id NOT IN (SELECT id FROM main.users)`,
    )
    .get() as { n: number };
  if (n > 0) orphans[table] = n;
}

if (Object.keys(orphans).length > 0 && !dropOrphans) {
  console.error("\nRefusing to merge: rows reference users that do not exist.");
  for (const [table, n] of Object.entries(orphans)) {
    console.error(`  ${table}: ${n} row(s) with an unknown user_id`);
  }
  console.error(
    "\nThese could not have been caught before, because user_id had no foreign key.\n" +
      "Re-run with --drop-orphans to leave them behind, or fix them in people.db first.\n",
  );
  sqlite.close();
  process.exit(1);
}

const copied: Record<string, number> = {};
const skipped: Record<string, number> = {};

sqlite.transaction(() => {
  for (const table of TABLES) {
    const columns = (
      sqlite.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as {
        name: string;
      }[]
    ).map((c) => `"${c.name}"`);

    const filter = (USER_SCOPED as readonly string[]).includes(table)
      ? ` WHERE user_id IN (SELECT id FROM main.users)`
      : "";

    const before = sqlite.prepare(`SELECT count(*) AS n FROM old."${table}"`).get() as {
      n: number;
    };
    const result = sqlite
      .prepare(
        `INSERT INTO main."${table}" (${columns.join(", ")})
         SELECT ${columns.join(", ")} FROM old."${table}"${filter}`,
      )
      .run();

    copied[table] = result.changes;
    if (before.n !== result.changes) skipped[table] = before.n - result.changes;
  }
})();

// goal_updates hang off a goal, so a dropped goal takes its updates with it.
// Reported rather than silently absorbed.
const [{ foreign_key_check: violations } = { foreign_key_check: null }] = [
  { foreign_key_check: sqlite.pragma("foreign_key_check") as unknown[] },
];
sqlite.prepare("DETACH DATABASE old").run();
sqlite.close();

console.log("\nCopied from people.db:");
for (const [table, n] of Object.entries(copied)) console.log(`  ${table.padEnd(14)} ${n}`);
if (Object.keys(skipped).length > 0) {
  console.log("\nLeft behind (unknown user_id):");
  for (const [table, n] of Object.entries(skipped)) console.log(`  ${table.padEnd(14)} ${n}`);
}
if (Array.isArray(violations) && violations.length > 0) {
  console.error(`\nWARNING: ${violations.length} foreign key violation(s) remain.`);
  process.exit(1);
}
console.log(
  `\nDone. ${path.basename(ALLOCATION_DB)} and ${path.basename(PEOPLE_DB)} are untouched — ` +
    `keep them until you are satisfied, then delete them and their -wal/-shm sidecars.`,
);
