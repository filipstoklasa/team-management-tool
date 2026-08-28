import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { IsoDate } from "../../domain/date.ts";
import { users } from "./allocation.ts";

/**
 * 1:1s, goals and feedback (§5). Personal data about identifiable people, so
 * §9 still governs what may be written here and how long it is kept.
 *
 * `userId` is a real foreign key. It could not be while these tables lived in
 * a second file; now that they do not, an orphaned 1:1 is a state the database
 * refuses rather than one the application has to remember to avoid.
 *
 * No `onDelete: "cascade"` on these: §6.6 deactivates users rather than
 * deleting them, and §9.5's hard delete is a deliberate, separately confirmed
 * action that removes these rows explicitly. A cascade would make it possible
 * to lose someone's records as a side effect of a different operation.
 */

/** §5.1 — a single 1:1 session. */
export const oneOnOnes = sqliteTable(
  "one_on_ones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    date: text("date").$type<IsoDate>().notNull(),
    /** What the manager recorded. */
    managerNotes: text("manager_notes"),
    /** What the report raised. */
    theirTopics: text("their_topics"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("one_on_one_user_date").on(t.userId, t.date)],
);

/** §5.1 — commitments from a 1:1, by either side. Drives agenda carry-over. */
export const actionItems = sqliteTable(
  "action_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    oneOnOneId: integer("one_on_one_id").references(() => oneOnOnes.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    owner: text("owner", { enum: ["manager", "report"] }).notNull(),
    status: text("status", { enum: ["open", "done", "dropped"] })
      .notNull()
      .default("open"),
    dueDate: text("due_date").$type<IsoDate>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("action_item_user_status").on(t.userId, t.status)],
);

/** §5.1 — career or development objective. */
export const goals = sqliteTable(
  "goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    detail: text("detail"),
    category: text("category", {
      enum: ["technical", "leadership", "delivery", "other"],
    }).notNull(),
    status: text("status", {
      enum: ["active", "achieved", "paused", "dropped"],
    })
      .notNull()
      .default("active"),
    targetDate: text("target_date").$type<IsoDate>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("goal_user_status").on(t.userId, t.status)],
);

/** §5.1 — progress log, so trajectory is visible rather than just current state. */
export const goalUpdates = sqliteTable(
  "goal_updates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    goalId: integer("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    date: text("date").$type<IsoDate>().notNull(),
    note: text("note").notNull(),
  },
  (t) => [index("goal_update_goal_date").on(t.goalId, t.date)],
);

/** §5.1 — feedback given to, or received about, a report. */
export const feedback = sqliteTable(
  "feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    date: text("date").$type<IsoDate>().notNull(),
    direction: text("direction", { enum: ["given", "received"] }).notNull(),
    /** Who it came from, for 'received'. */
    source: text("source"),
    category: text("category", {
      enum: ["praise", "constructive", "other"],
    }).notNull(),
    content: text("content").notNull(),
    /** Has this been relayed to the person yet (§5.2 carry-over). */
    shared: integer("shared", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("feedback_user_shared").on(t.userId, t.shared)],
);

export type OneOnOne = typeof oneOnOnes.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalUpdate = typeof goalUpdates.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type ActionItemStatus = ActionItem["status"];
export type GoalStatus = Goal["status"];
