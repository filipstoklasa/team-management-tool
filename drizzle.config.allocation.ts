import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/allocation/schema.ts",
  out: "./drizzle/allocation",
  dbCredentials: { url: process.env.ALLOCATION_DB_PATH ?? "./data/allocation.db" },
});
