"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client.ts";
import {
  allocationChanges,
  allocations,
  type Allocation,
} from "@/db/schema/allocation.ts";
import { formatIsoDate, maxDate, minDate, type IsoDate } from "@/domain/date.ts";
import { overlaps, type DateRange } from "@/domain/intervals.ts";
import { overAllocatedSegments } from "@/domain/points-in-time.ts";
import {
  changeAllocationSchema,
  correctAllocationSchema,
  createAllocationSchema,
  endAllocationSchema,
} from "@/domain/schemas.ts";
import { fail, fromZod, ok, type ActionResult, type Warning } from "./result.ts";

/**
 * The handle Drizzle hands to a transaction callback — narrower than the db
 * itself. Derived from the callback signature so it cannot drift.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const range = (r: { startDate: IsoDate; endDate: IsoDate | null }): DateRange => ({
  start: r.startDate,
  end: r.endDate,
});

/**
 * §4.3, blocking: "No overlapping ranges for the same (user_id, app_id) pair."
 *
 * Cannot be a CHECK constraint, so it runs inside the write transaction — never
 * before it — so the answer cannot go stale between the check and the insert.
 */
function findOverlaps(
  tx: Tx,
  userId: number,
  appId: number,
  candidate: DateRange,
  excludeId?: number,
): Allocation[] {
  const existing = tx
    .select()
    .from(allocations)
    .where(
      excludeId === undefined
        ? and(eq(allocations.userId, userId), eq(allocations.appId, appId))
        : and(
            eq(allocations.userId, userId),
            eq(allocations.appId, appId),
            ne(allocations.id, excludeId),
          ),
    )
    .all();
  return existing.filter((row) => overlaps(range(row), candidate));
}

/**
 * §4.3, warning only: "Sum <= 100% per user is a WARNING, not a constraint …
 * The 100% check evaluates PER POINT IN TIME across the AFFECTED RANGE, not
 * just for today."
 *
 * Two things follow from that wording, and both matter:
 *
 *  - Every allocation the user holds on every app is summed, not just the one
 *    being edited, so a breach that only opens up weeks later is still caught.
 *  - Only breaches overlapping `affected` are reported. Warning about a period
 *    that has already elapsed is noise: it is a historical fact, not something
 *    the save just caused, and it cannot be acted on. Reducing today's
 *    allocation should not produce a warning about last quarter.
 */
function overAllocationWarnings(
  tx: Tx,
  userId: number,
  affected: DateRange,
  excludeId?: number,
): Warning[] {
  const rows = tx
    .select()
    .from(allocations)
    .where(eq(allocations.userId, userId))
    .all()
    .filter((r) => excludeId === undefined || r.id !== excludeId);

  return overAllocatedSegments(rows, range, (r) => r.percentage)
    .filter((segment) => overlaps(segment.range, affected))
    .map((segment) => ({
      message: `Over 100% (${segment.total}%) from ${formatIsoDate(segment.range.start)}${
        segment.range.end === null ? " onwards" : ` until ${formatIsoDate(segment.range.end)}`
      }`,
      detail: `${segment.items.length} concurrent allocations`,
    }));
}

function refresh(userId: number, appId?: number) {
  revalidatePath("/");
  revalidatePath(`/people/${userId}`, "layout");
  if (appId !== undefined) revalidatePath(`/apps/${appId}`);
  revalidatePath("/apps");
}

export async function createAllocation(
  input: unknown,
): Promise<ActionResult<Allocation>> {
  const parsed = createAllocationSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  try {
    const result = db.transaction((tx) => {
      const conflicts = findOverlaps(tx, v.userId, v.appId, {
        start: v.startDate,
        end: v.endDate,
      });
      if (conflicts.length > 0) {
        throw new OverlapError(conflicts);
      }

      const created = tx
        .insert(allocations)
        .values({
          userId: v.userId,
          appId: v.appId,
          percentage: v.percentage,
          startDate: v.startDate,
          endDate: v.endDate,
          createdAt: new Date(),
        })
        .returning()
        .get();

      tx.insert(allocationChanges)
        .values({
          allocationId: created.id,
          changedAt: new Date(),
          changeType: "created",
          note: v.note,
        })
        .run();

      return {
        created,
        warnings: overAllocationWarnings(tx, v.userId, {
          start: v.startDate,
          end: v.endDate,
        }),
      };
    });

    refresh(v.userId, v.appId);
    return ok(result.created, result.warnings);
  } catch (error) {
    return toFailure(error);
  }
}

/**
 * §4.2 — the change sequence, and the reason this app uses a synchronous
 * database driver.
 *
 * "when an allocation changes (e.g. 50% -> 70%), do not update the row.
 *  Instead: 1. set end_date on the existing row … 2. insert a new row …
 *  3. write AllocationChange records for both"
 *
 * All four writes happen in one transaction. A failure between steps 1 and 2
 * would otherwise silently delete someone's allocation, and the audit trail is
 * only trustworthy if it cannot half-happen.
 */
export async function changeAllocation(
  input: unknown,
): Promise<ActionResult<Allocation>> {
  const parsed = changeAllocationSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  try {
    const result = db.transaction((tx) => {
      const current = tx
        .select()
        .from(allocations)
        .where(eq(allocations.id, v.allocationId))
        .get();
      if (!current) throw new NotFoundError("That allocation no longer exists.");

      if (v.effectiveDate <= current.startDate) {
        throw new ValidationError(
          `The change must take effect after the allocation started (${formatIsoDate(current.startDate)}). To fix a mistake in the original row, use "correct" instead.`,
          "effectiveDate",
        );
      }
      if (current.endDate !== null && v.effectiveDate >= current.endDate) {
        throw new ValidationError(
          `That allocation already ended on ${formatIsoDate(current.endDate)}.`,
          "effectiveDate",
        );
      }

      const appId = v.appId ?? current.appId;
      const candidate: DateRange = { start: v.effectiveDate, end: v.endDate };
      const conflicts = findOverlaps(
        tx,
        current.userId,
        appId,
        candidate,
        v.allocationId,
      );
      if (conflicts.length > 0) throw new OverlapError(conflicts);

      // 1. End the existing row — do not mutate its percentage.
      tx.update(allocations)
        .set({ endDate: v.effectiveDate })
        .where(eq(allocations.id, v.allocationId))
        .run();

      // 2. Insert the successor.
      const created = tx
        .insert(allocations)
        .values({
          userId: current.userId,
          appId,
          percentage: v.percentage,
          startDate: v.effectiveDate,
          endDate: v.endDate,
          createdAt: new Date(),
        })
        .returning()
        .get();

      // 3. Audit both sides of the change.
      tx.insert(allocationChanges)
        .values([
          {
            allocationId: v.allocationId,
            changedAt: new Date(),
            changeType: "ended",
            note: v.note ?? `Ended on change to ${v.percentage}%`,
          },
          {
            allocationId: created.id,
            changedAt: new Date(),
            changeType: "created",
            note: v.note ?? `Continues from allocation #${v.allocationId}`,
          },
        ])
        .run();

      return {
        created,
        userId: current.userId,
        appId,
        warnings: overAllocationWarnings(tx, current.userId, candidate),
      };
    });

    refresh(result.userId, result.appId);
    return ok(result.created, result.warnings);
  } catch (error) {
    return toFailure(error);
  }
}

/** §4.2 — in-place correction of a mistake. Still audited as `modified`. */
export async function correctAllocation(
  input: unknown,
): Promise<ActionResult<Allocation>> {
  const parsed = correctAllocationSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  try {
    const result = db.transaction((tx) => {
      const current = tx
        .select()
        .from(allocations)
        .where(eq(allocations.id, v.allocationId))
        .get();
      if (!current) throw new NotFoundError("That allocation no longer exists.");

      const conflicts = findOverlaps(
        tx,
        current.userId,
        current.appId,
        { start: v.startDate, end: v.endDate },
        v.allocationId,
      );
      if (conflicts.length > 0) throw new OverlapError(conflicts);

      const updated = tx
        .update(allocations)
        .set({
          percentage: v.percentage,
          startDate: v.startDate,
          endDate: v.endDate,
        })
        .where(eq(allocations.id, v.allocationId))
        .returning()
        .get();

      tx.insert(allocationChanges)
        .values({
          allocationId: v.allocationId,
          changedAt: new Date(),
          changeType: "modified",
          note: v.note ?? "Corrected in place",
        })
        .run();

      return {
        updated,
        userId: current.userId,
        appId: current.appId,
        // A correction can move dates either way, so the affected window spans
        // both where the row was and where it now is.
        warnings: overAllocationWarnings(tx, current.userId, {
          start: minDate(current.startDate, v.startDate),
          end:
            current.endDate === null || v.endDate === null
              ? null
              : maxDate(current.endDate, v.endDate),
        }),
      };
    });

    refresh(result.userId, result.appId);
    return ok(result.updated, result.warnings);
  } catch (error) {
    return toFailure(error);
  }
}

export async function endAllocation(
  input: unknown,
): Promise<ActionResult<Allocation>> {
  const parsed = endAllocationSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  try {
    const result = db.transaction((tx) => {
      const current = tx
        .select()
        .from(allocations)
        .where(eq(allocations.id, v.allocationId))
        .get();
      if (!current) throw new NotFoundError("That allocation no longer exists.");
      if (v.endDate <= current.startDate) {
        throw new ValidationError(
          `An allocation cannot end on or before it started (${formatIsoDate(current.startDate)}).`,
          "endDate",
        );
      }

      const updated = tx
        .update(allocations)
        .set({ endDate: v.endDate })
        .where(eq(allocations.id, v.allocationId))
        .returning()
        .get();

      tx.insert(allocationChanges)
        .values({
          allocationId: v.allocationId,
          changedAt: new Date(),
          changeType: "ended",
          note: v.note,
        })
        .run();

      return { updated, userId: current.userId, appId: current.appId };
    });

    refresh(result.userId, result.appId);
    return ok(result.updated);
  } catch (error) {
    return toFailure(error);
  }
}

// ------------------------------------------------------------------ errors

class OverlapError extends Error {
  constructor(readonly conflicts: Allocation[]) {
    super("overlap");
  }
}
class ValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}
class NotFoundError extends Error {}

function toFailure(error: unknown): ActionResult<never> {
  if (error instanceof OverlapError) {
    return fail({
      field: "startDate",
      message: `Overlaps an existing allocation on this app: ${error.conflicts
        .map(
          (c) =>
            `${c.percentage}% from ${formatIsoDate(c.startDate)}${
              c.endDate ? ` to ${formatIsoDate(c.endDate)}` : " onwards"
            }`,
        )
        .join("; ")}. End that one first, or pick different dates.`,
    });
  }
  if (error instanceof ValidationError) {
    return fail({ field: error.field, message: error.message });
  }
  if (error instanceof NotFoundError) return fail(error.message);

  // A CHECK constraint firing here means app-level validation let something
  // through — surface it rather than swallowing it.
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("CHECK constraint failed")) {
    return fail("That allocation breaks a database rule (percentage must be 0-100, end date after start date).");
  }
  console.error("Allocation action failed:", error);
  return fail("Something went wrong saving that allocation.");
}
