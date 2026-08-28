import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/db/schema/allocation.ts", "./src/db/schema/people.ts"],
  out: "./drizzle",
  dbCredentials: { url: process.env.DB_PATH ?? "./data/app.db" },
});
