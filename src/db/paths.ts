import path from "node:path";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

/**
 * One database holds everything: allocations, users, teams, apps, and the 1:1
 * records that reference them.
 *
 * It was two files until the split was retired — see `scripts/merge-databases.ts`
 * for the one-time move, and the design document's §9 for why the separation
 * existed and why it no longer does.
 */
export const DB_PATH = process.env.DB_PATH ?? path.join(dataDir, "app.db");

export const DATA_DIR = dataDir;
