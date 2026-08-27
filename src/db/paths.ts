import path from "node:path";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

export const ALLOCATION_DB_PATH =
  process.env.ALLOCATION_DB_PATH ?? path.join(dataDir, "allocation.db");

export const PEOPLE_DB_PATH =
  process.env.PEOPLE_DB_PATH ?? path.join(dataDir, "people.db");

export const DATA_DIR = dataDir;
