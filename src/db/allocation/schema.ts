import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { IsoDate } from "../../domain/date.ts";

/**
 * allocation.db — allocations, users, teams and apps (§3, §4).
 *
 * This database contains no personal notes and is safe to demo, screenshot or
 * hand over on its own (§9.2). People records live in a separate file with no
 * foreign keys pointing here.
 */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  title: text("title"),
  startDate: text("start_date").$type<IsoDate>(),
  // §6.6: deactivate rather than delete, to preserve historical allocations.
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const apps = sqliteTable(
  "apps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** Target total allocation %, e.g. 200 = 2 FTE (§3). */
    requiredCapacity: real("required_capacity").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    notes: text("notes"),
  },
  (t) => [check("apps_capacity_non_negative", sql`${t.requiredCapacity} >= 0`)],
);

/** §3 — a user may belong to multiple teams. Navigation and grouping only. */
export const userTeams = sqliteTable(
  "user_teams",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.teamId] })],
);

/** §3 — an app may belong to multiple teams. */
export const appTeams = sqliteTable(
  "app_teams",
  {
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.appId, t.teamId] })],
);

/**
 * §4.1 — one row is one user on one app at one percentage for one continuous
 * period. Rows are effective-dated and NOT mutated in place (§4.2); that is
 * what makes time travel work.
 *
 * `end_date` is EXCLUSIVE — the interval is half-open `[start_date, end_date)`.
 */
export const allocations = sqliteTable(
  "allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    percentage: real("percentage").notNull(),
    startDate: text("start_date").$type<IsoDate>().notNull(),
    /** NULL = ongoing. */
    endDate: text("end_date").$type<IsoDate>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    // §4.3 blocking rules, enforced by the database and not only by app code.
    // The overlap rule cannot be expressed here and lives in the write
    // transaction instead — see src/actions/allocations.ts.
    check("alloc_pct_range", sql`${t.percentage} > 0 AND ${t.percentage} <= 100`),
    check(
      "alloc_end_after_start",
      sql`${t.endDate} IS NULL OR ${t.endDate} > ${t.startDate}`,
    ),
    index("alloc_user_range").on(t.userId, t.startDate, t.endDate),
    index("alloc_app_range").on(t.appId, t.startDate, t.endDate),
  ],
);

/** §4.1 — audit trail: answers "why did this change" months later. */
export const allocationChanges = sqliteTable(
  "allocation_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    allocationId: integer("allocation_id")
      .notNull()
      .references(() => allocations.id, { onDelete: "cascade" }),
    changedAt: integer("changed_at", { mode: "timestamp_ms" }).notNull(),
    changeType: text("change_type", {
      enum: ["created", "modified", "ended"],
    }).notNull(),
    note: text("note"),
  },
  (t) => [index("alloc_change_alloc").on(t.allocationId)],
);

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type App = typeof apps.$inferSelect;
export type Allocation = typeof allocations.$inferSelect;
export type AllocationChange = typeof allocationChanges.$inferSelect;
export type ChangeType = AllocationChange["changeType"];
