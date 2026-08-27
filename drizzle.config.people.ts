import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/people/schema.ts",
  out: "./drizzle/people",
  dbCredentials: { url: process.env.PEOPLE_DB_PATH ?? "./data/people.db" },
});
