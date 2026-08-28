import "server-only";
import { and, asc, desc, eq, isNull, lt, not, sql } from "drizzle-orm";
import { getPeopleDb, peopleDbAvailable } from "@/db/people/client.ts";
import {
  actionItems,
  feedback,
  goalUpdates,
  goals,
  oneOnOnes,
  type ActionItem,
  type Feedback,
  type Goal,
  type GoalUpdate,
  type OneOnOne,
} from "@/db/people/schema.ts";
import { addDays, daysBetween, today, type IsoDate } from "@/domain/date.ts";

/**
 * Module B reads (§5).
 *
 * TWO RULES GOVERN THIS FILE, both from §10.6:
 *
 *   1. NOTHING HERE IS EVER CACHED. No `'use cache'`, no `unstable_cache`.
 *      Cached results are serialised to `.next/cache`, which would put note
 *      text in a second location outside people.db and defeat §9.2. An ESLint
 *      rule enforces this; the reason is here so the rule is not a mystery.
 *
 *   2. EVERY FUNCTION TOLERATES AN ABSENT DATABASE. §9.2 requires Module A to
 *      be fully usable with people.db missing, so these return empty results
 *      rather than throwing. Callers check `moduleBAvailable()` when they need
 *      to distinguish "no records" from "no database".
 */

export function moduleBAvailable(): boolean {
  return peopleDbAvailable();
}

export async function getOneOnOnes(userId: number): Promise<OneOnOne[]> {
  const db = getPeopleDb();
  if (!db) return [];
  return db
    .select()
    .from(oneOnOnes)
    .where(eq(oneOnOnes.userId, userId))
    .orderBy(desc(oneOnOnes.date), desc(oneOnOnes.id));
}

export async function getOneOnOne(id: number): Promise<OneOnOne | undefined> {
  const db = getPeopleDb();
  if (!db) return undefined;
  return db.select().from(oneOnOnes).where(eq(oneOnOnes.id, id)).get();
}

export async function getLastOneOnOne(
  userId: number,
): Promise<OneOnOne | undefined> {
  const db = getPeopleDb();
  if (!db) return undefined;
  return db
    .select()
    .from(oneOnOnes)
    .where(eq(oneOnOnes.userId, userId))
    .orderBy(desc(oneOnOnes.date))
    .get();
}

/** §6.1: "Each row also shows days since last 1:1." null = never, or no database. */
export async function getDaysSinceLastOneOnOne(): Promise<Map<number, number>> {
  const db = getPeopleDb();
  const result = new Map<number, number>();
  if (!db) return result;

  const rows = await db
    .select({
      userId: oneOnOnes.userId,
      last: sql<string>`max(${oneOnOnes.date})`.as("last"),
    })
    .from(oneOnOnes)
    .groupBy(oneOnOnes.userId);

  const t = today();
  for (const row of rows) {
    if (row.last) result.set(row.userId, daysBetween(row.last as IsoDate, t));
  }
  return result;
}

export async function getActionItems(
  userId: number,
  status?: "open" | "done" | "dropped",
): Promise<ActionItem[]> {
  const db = getPeopleDb();
  if (!db) return [];
  const where =
    status === undefined
      ? eq(actionItems.userId, userId)
      : and(eq(actionItems.userId, userId), eq(actionItems.status, status));
  return db
    .select()
    .from(actionItems)
    .where(where)
    .orderBy(asc(actionItems.dueDate), desc(actionItems.createdAt));
}

export async function getOpenActionItemCount(): Promise<Map<number, number>> {
  const db = getPeopleDb();
  const result = new Map<number, number>();
  if (!db) return result;
  const rows = await db
    .select({ userId: actionItems.userId, n: sql<number>`count(*)`.as("n") })
    .from(actionItems)
    .where(eq(actionItems.status, "open"))
    .groupBy(actionItems.userId);
  for (const row of rows) result.set(row.userId, Number(row.n));
  return result;
}

export async function getGoals(userId: number): Promise<Goal[]> {
  const db = getPeopleDb();
  if (!db) return [];
  return db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(asc(goals.status), desc(goals.updatedAt));
}

export async function getGoalUpdates(goalIds: number[]): Promise<Map<number, GoalUpdate[]>> {
  const db = getPeopleDb();
  const result = new Map<number, GoalUpdate[]>();
  if (!db || goalIds.length === 0) return result;
  const rows = await db
    .select()
    .from(goalUpdates)
    .orderBy(desc(goalUpdates.date), desc(goalUpdates.id));
  for (const row of rows) {
    if (!goalIds.includes(row.goalId)) continue;
    const list = result.get(row.goalId) ?? [];
    list.push(row);
    result.set(row.goalId, list);
  }
  return result;
}

export async function getFeedback(userId: number): Promise<Feedback[]> {
  const db = getPeopleDb();
  if (!db) return [];
  return db
    .select()
    .from(feedback)
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.date), desc(feedback.id));
}

/**
 * §5.2 — the agenda carry-over prep panel.
 *
 * "The mechanism that makes 1:1s continuous rather than a series of
 * disconnected conversations."
 *
 * Deliberately returns ONLY the Module B half. The Module A half (current
 * allocation and any change since the last 1:1) is fetched separately by the
 * caller and joined in the component tree — §10.6 forbids a single function
 * that reads both databases, because that function could not survive
 * people.db being absent and could not be reasoned about independently.
 */
export interface PrepPanelData {
  openActionItems: ActionItem[];
  unsharedFeedback: Feedback[];
  stallingGoals: Goal[];
  lastOneOnOne: OneOnOne | undefined;
}

/** §5.2: active goals with no update in the last 60 days are "quietly stalling". */
const STALL_DAYS = 60;

export async function getPrepPanelData(userId: number): Promise<PrepPanelData> {
  const db = getPeopleDb();
  if (!db) {
    return {
      openActionItems: [],
      unsharedFeedback: [],
      stallingGoals: [],
      lastOneOnOne: undefined,
    };
  }

  const cutoff = addDays(today(), -STALL_DAYS);

  const [openItems, unshared, activeGoals, last] = await Promise.all([
    db
      .select()
      .from(actionItems)
      .where(and(eq(actionItems.userId, userId), eq(actionItems.status, "open")))
      .orderBy(asc(actionItems.dueDate)),
    db
      .select()
      .from(feedback)
      .where(and(eq(feedback.userId, userId), eq(feedback.shared, false)))
      .orderBy(desc(feedback.date)),
    db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.status, "active"))),
    getLastOneOnOne(userId),
  ]);

  const updatesByGoal = await getGoalUpdates(activeGoals.map((g) => g.id));
  const stallingGoals = activeGoals.filter((goal) => {
    const updates = updatesByGoal.get(goal.id) ?? [];
    const latest = updates[0];
    // Never updated, or last touched before the cutoff.
    return latest === undefined || latest.date < cutoff;
  });

  return {
    openActionItems: openItems,
    unsharedFeedback: unshared,
    stallingGoals,
    lastOneOnOne: last,
  };
}

/** Counts for the §6.1 summary strip that come from Module B. */
export async function getPeopleSummary() {
  const db = getPeopleDb();
  if (!db) return null;

  const [openItems, sinceMap] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)`.as("n") })
      .from(actionItems)
      .where(eq(actionItems.status, "open"))
      .get(),
    getDaysSinceLastOneOnOne(),
  ]);

  return {
    openActionItems: Number(openItems?.n ?? 0),
    /**
     * Deliberately NOT an "overdue" count. Deciding who is overdue needs the
     * roster of active people, which lives in allocation.db — a person who has
     * never had a 1:1 is the most overdue there is, and they are absent from
     * this map rather than present with a large number. Combining the two is
     * the caller's job, in the component tree, per §10.6.
     */
    daysSinceLastOneOnOne: sinceMap,
  };
}

/** §9.5 — retention review: records older than the configured window. */
export async function getRetentionCandidates(months: number) {
  const db = getPeopleDb();
  if (!db) return null;
  const cutoff = addDays(today(), -Math.round(months * 30.44));
  const [sessions, feedbackRows, closedItems] = await Promise.all([
    db.select().from(oneOnOnes).where(lt(oneOnOnes.date, cutoff)).orderBy(asc(oneOnOnes.date)),
    db.select().from(feedback).where(lt(feedback.date, cutoff)).orderBy(asc(feedback.date)),
    db
      .select()
      .from(actionItems)
      .where(and(not(eq(actionItems.status, "open")), isNull(actionItems.closedAt)))
      .orderBy(asc(actionItems.createdAt)),
  ]);
  return { cutoff, sessions, feedback: feedbackRows, closedItems };
}
