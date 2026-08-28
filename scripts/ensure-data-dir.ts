/**
 * drizzle-kit opens the database file directly and will not create the
 * directory holding it, so on a fresh checkout — where `data/` is absent
 * because it is gitignored (§7) — `db:migrate` fails before it starts.
 *
 * Every migrate script runs this first.
 */
import { mkdirSync } from "node:fs";
import { DATA_DIR } from "../src/db/paths.ts";

mkdirSync(DATA_DIR, { recursive: true });
