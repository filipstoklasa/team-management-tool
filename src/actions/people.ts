"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray, lt } from "drizzle-orm";
import { getPeopleDb } from "@/db/people/client.ts";
import {
  actionItems,
  feedback,
  goalUpdates,
  goals,
  oneOnOnes,
} from "@/db/people/schema.ts";
import {
  actionItemSchema,
  feedbackSchema,
  goalSchema,
  goalUpdateSchema,
  oneOnOneSchema,
} from "@/domain/schemas.ts";
import { addDays, today } from "@/domain/date.ts";
import { fail, fromZod, ok, type ActionResult } from "./result.ts";

/**
 * Module B mutations (§5).
 *
 * Every one of these begins by checking that people.db exists, because §9.2
 * makes its absence a supported state rather than an error. Nothing here caches
 * anything (§10.6).
 */
function db() {
  const handle = getPeopleDb();
  if (!handle) throw new ModuleBUnavailable();
  return handle;
}

class ModuleBUnavailable extends Error {}

function guard<T>(fn: () => T): ActionResult<T> {
  try {
    return ok(fn());
  } catch (error) {
    if (error instanceof ModuleBUnavailable) {
      return fail("The people database is not present on this machine.");
    }
    console.error("Module B action failed:", error);
    return fail("Something went wrong saving that.");
  }
}

function refresh(userId: number) {
  revalidatePath(`/people/${userId}`, "layout");
  revalidatePath("/");
}

// ------------------------------------------------------------------- 1:1s

export async function saveOneOnOne(input: unknown) {
  const parsed = oneOnOneSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const result = guard(() => {
    const now = new Date();
    if (v.id) {
      return db()
        .update(oneOnOnes)
        .set({
          date: v.date,
          managerNotes: v.managerNotes,
          theirTopics: v.theirTopics,
          updatedAt: now,
        })
        .where(eq(oneOnOnes.id, v.id))
        .returning()
        .get();
    }
    return db()
      .insert(oneOnOnes)
      .values({
        userId: v.userId,
        date: v.date,
        managerNotes: v.managerNotes,
        theirTopics: v.theirTopics,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  });

  if (result.ok) refresh(v.userId);
  return result;
}

export async function deleteOneOnOne(id: number, userId: number) {
  const result = guard(() => {
    db().delete(oneOnOnes).where(eq(oneOnOnes.id, id)).run();
  });
  if (result.ok) refresh(userId);
  return result;
}

// ----------------------------------------------------------- action items

export async function saveActionItem(input: unknown) {
  const parsed = actionItemSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const result = guard(() => {
    const closing = v.status !== "open";
    if (v.id) {
      return db()
        .update(actionItems)
        .set({
          description: v.description,
          owner: v.owner,
          status: v.status,
          dueDate: v.dueDate,
          closedAt: closing ? new Date() : null,
        })
        .where(eq(actionItems.id, v.id))
        .returning()
        .get();
    }
    return db()
      .insert(actionItems)
      .values({
        userId: v.userId,
        oneOnOneId: v.oneOnOneId ?? null,
        description: v.description,
        owner: v.owner,
        status: v.status,
        dueDate: v.dueDate,
        createdAt: new Date(),
        closedAt: closing ? new Date() : null,
      })
      .returning()
      .get();
  });

  if (result.ok) refresh(v.userId);
  return result;
}

export async function setActionItemStatus(
  id: number,
  userId: number,
  status: "open" | "done" | "dropped",
) {
  const result = guard(() =>
    db()
      .update(actionItems)
      .set({ status, closedAt: status === "open" ? null : new Date() })
      .where(eq(actionItems.id, id))
      .run(),
  );
  if (result.ok) refresh(userId);
  return result;
}

// ------------------------------------------------------------------ goals

export async function saveGoal(input: unknown) {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const result = guard(() => {
    const now = new Date();
    if (v.id) {
      return db()
        .update(goals)
        .set({
          title: v.title,
          detail: v.detail,
          category: v.category,
          status: v.status,
          targetDate: v.targetDate,
          updatedAt: now,
        })
        .where(eq(goals.id, v.id))
        .returning()
        .get();
    }
    return db()
      .insert(goals)
      .values({
        userId: v.userId,
        title: v.title,
        detail: v.detail,
        category: v.category,
        status: v.status,
        targetDate: v.targetDate,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  });

  if (result.ok) refresh(v.userId);
  return result;
}

export async function addGoalUpdate(input: unknown, userId: number) {
  const parsed = goalUpdateSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const result = guard(() => {
    const row = db()
      .insert(goalUpdates)
      .values({ goalId: v.goalId, date: v.date, note: v.note })
      .returning()
      .get();
    // Touching the goal keeps "quietly stalling" (§5.2) honest.
    db().update(goals).set({ updatedAt: new Date() }).where(eq(goals.id, v.goalId)).run();
    return row;
  });

  if (result.ok) refresh(userId);
  return result;
}

// --------------------------------------------------------------- feedback

export async function saveFeedback(input: unknown) {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  const result = guard(() => {
    if (v.id) {
      return db()
        .update(feedback)
        .set({
          date: v.date,
          direction: v.direction,
          source: v.source,
          category: v.category,
          content: v.content,
          shared: v.shared,
        })
        .where(eq(feedback.id, v.id))
        .returning()
        .get();
    }
    return db()
      .insert(feedback)
      .values({
        userId: v.userId,
        date: v.date,
        direction: v.direction,
        source: v.source,
        category: v.category,
        content: v.content,
        shared: v.shared,
      })
      .returning()
      .get();
  });

  if (result.ok) refresh(v.userId);
  return result;
}

export async function markFeedbackShared(id: number, userId: number, shared: boolean) {
  const result = guard(() =>
    db().update(feedback).set({ shared }).where(eq(feedback.id, id)).run(),
  );
  if (result.ok) refresh(userId);
  return result;
}

// ------------------------------------------------------- §9.5 hard delete

export interface DeletionTally {
  oneOnOnes: number;
  actionItems: number;
  goals: number;
  goalUpdates: number;
  feedback: number;
}

/**
 * §9.5 — "Hard delete per user — a single action that removes all Module B
 * records for one person, permanently. NOT a soft-delete flag."
 *
 * One transaction, and it really is gone: there is no archive table, no
 * `deleted` column, and — because §10.6 keeps Module B out of every cache and
 * out of the build output — no copy anywhere else to sweep up afterwards.
 *
 * Their allocation history in Module A is untouched: §9.5 keeps it "for
 * capacity analysis" while the personal notes go.
 */
export async function hardDeletePersonRecords(
  userId: number,
): Promise<ActionResult<DeletionTally>> {
  const handle = getPeopleDb();
  if (!handle) return fail("The people database is not present on this machine.");

  try {
    const tally = handle.transaction((tx) => {
      const goalIds = tx
        .select({ id: goals.id })
        .from(goals)
        .where(eq(goals.userId, userId))
        .all()
        .map((g) => g.id);

      const updates =
        goalIds.length > 0
          ? tx.delete(goalUpdates).where(inArray(goalUpdates.goalId, goalIds)).run()
              .changes
          : 0;

      return {
        goalUpdates: updates,
        goals: tx.delete(goals).where(eq(goals.userId, userId)).run().changes,
        actionItems: tx.delete(actionItems).where(eq(actionItems.userId, userId)).run()
          .changes,
        feedback: tx.delete(feedback).where(eq(feedback.userId, userId)).run().changes,
        oneOnOnes: tx.delete(oneOnOnes).where(eq(oneOnOnes.userId, userId)).run().changes,
      };
    });

    refresh(userId);
    revalidatePath("/retention");
    return ok(tally);
  } catch (error) {
    console.error("Hard delete failed:", error);
    return fail("Could not delete those records.");
  }
}

/**
 * §9.5 — "Retention review … with bulk delete. The default posture is that old
 * 1:1 notes get deleted, not archived."
 */
export async function deleteOlderThan(
  monthsToKeep: number,
): Promise<ActionResult<{ oneOnOnes: number; feedback: number }>> {
  const handle = getPeopleDb();
  if (!handle) return fail("The people database is not present on this machine.");
  if (!Number.isFinite(monthsToKeep) || monthsToKeep < 1) {
    return fail("Retention window must be at least one month.");
  }

  const cutoff = addDays(today(), -Math.round(monthsToKeep * 30.44));

  try {
    const tally = handle.transaction((tx) => ({
      oneOnOnes: tx.delete(oneOnOnes).where(lt(oneOnOnes.date, cutoff)).run().changes,
      feedback: tx.delete(feedback).where(lt(feedback.date, cutoff)).run().changes,
    }));
    revalidatePath("/retention");
    revalidatePath("/");
    return ok(tally);
  } catch (error) {
    console.error("Retention delete failed:", error);
    return fail("Could not delete those records.");
  }
}

export async function countPersonRecords(
  userId: number,
): Promise<DeletionTally | null> {
  const handle = getPeopleDb();
  if (!handle) return null;
  const goalIds = handle
    .select({ id: goals.id })
    .from(goals)
    .where(eq(goals.userId, userId))
    .all()
    .map((g) => g.id);
  return {
    oneOnOnes: handle.select().from(oneOnOnes).where(eq(oneOnOnes.userId, userId)).all()
      .length,
    actionItems: handle.select().from(actionItems).where(eq(actionItems.userId, userId))
      .all().length,
    goals: goalIds.length,
    goalUpdates:
      goalIds.length > 0
        ? handle.select().from(goalUpdates).where(inArray(goalUpdates.goalId, goalIds))
            .all().length
        : 0,
    feedback: handle.select().from(feedback).where(eq(feedback.userId, userId)).all()
      .length,
  };
}
