import type Database from "better-sqlite3";

/**
 * Applied to every connection, both databases (§10.4).
 *
 * - WAL:          readers never block the writer, which matters because a page
 *                 render may read while a server action writes.
 * - foreign_keys: SQLite defaults these OFF per-connection regardless of how
 *                 the library was compiled, so it must be set explicitly.
 * - busy_timeout: wait rather than immediately throwing SQLITE_BUSY.
 */
export function applyPragmas(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
}
