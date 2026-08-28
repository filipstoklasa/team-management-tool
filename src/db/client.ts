import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { applyPragmas } from "./pragmas.ts";
import { DB_PATH } from "./paths.ts";
import * as allocation from "./schema/allocation.ts";
import * as people from "./schema/people.ts";

/**
 * The one connection. A missing database file is a hard failure — there is no
 * partial mode to fall back to, and pretending otherwise was the complexity
 * the two-file split cost us for years of nothing.
 *
 * Cached on globalThis so the dev server's module reloading does not leak a new
 * SQLite handle on every edit.
 */
export const schema = { ...allocation, ...people };

const globalForDb = globalThis as unknown as {
  __db?: ReturnType<typeof create>;
};

function create() {
  const sqlite = new Database(DB_PATH);
  applyPragmas(sqlite);
  return drizzle(sqlite, { schema });
}

export const db = (globalForDb.__db ??= create());
