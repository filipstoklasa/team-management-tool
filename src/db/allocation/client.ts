import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { applyPragmas } from "../pragmas.ts";
import { ALLOCATION_DB_PATH } from "../paths.ts";
import * as schema from "./schema.ts";

/**
 * allocation.db is required. If it is missing, the app cannot work at all, so
 * failing loudly here is correct — unlike people.db, whose absence is a
 * supported state (§9.2).
 *
 * Cached on globalThis so the dev server's module reloading does not leak a new
 * SQLite handle on every edit.
 */
const globalForDb = globalThis as unknown as {
  __allocationDb?: ReturnType<typeof create>;
};

function create() {
  const sqlite = new Database(ALLOCATION_DB_PATH);
  applyPragmas(sqlite);
  return drizzle(sqlite, { schema });
}

export const allocationDb = (globalForDb.__allocationDb ??= create());
export { schema };
