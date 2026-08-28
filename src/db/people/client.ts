import "server-only";
import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { applyPragmas } from "../pragmas.ts";
import { PEOPLE_DB_PATH } from "../paths.ts";
import * as schema from "./schema.ts";

export type PeopleDb = ReturnType<typeof create>;

/**
 * §9.2: "allocation must be fully usable and shareable with `people.db` absent."
 *
 * So this file is opened lazily and its absence is a normal, supported state —
 * never an error. Callers use `peopleDbAvailable()` and render a people-records
 * unavailable state rather than failing. This is what makes the separation
 * testable rather than aspirational: move people.db aside and allocation keeps
 * working.
 *
 * `undefined` = not yet checked. `null` = checked, genuinely absent.
 */
const globalForDb = globalThis as unknown as {
  __peopleDb?: PeopleDb | null;
};

function create() {
  const sqlite = new Database(PEOPLE_DB_PATH);
  applyPragmas(sqlite);
  return drizzle(sqlite, { schema });
}

export function getPeopleDb(): PeopleDb | null {
  if (globalForDb.__peopleDb !== undefined) return globalForDb.__peopleDb;
  globalForDb.__peopleDb = existsSync(PEOPLE_DB_PATH) ? create() : null;
  return globalForDb.__peopleDb;
}

export function peopleDbAvailable(): boolean {
  return getPeopleDb() !== null;
}

export { schema };
