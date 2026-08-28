import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { allocationDb } from "@/db/allocation/client.ts";
import {
  allocationChanges,
  allocations,
  appTeams,
  apps,
  teams,
  userTeams,
  users,
  type Allocation,
  type App,
  type Team,
  type User,
} from "@/db/allocation/schema.ts";
import type { IsoDate } from "@/domain/date.ts";
import type { DateRange } from "@/domain/intervals.ts";
import {
  appStatus,
  capacityDelta,
  personStatus,
  type AppStatus,
  type PersonStatus,
} from "@/domain/metrics.ts";

/**
 * §4.2 — the core temporal predicate, in one place.
 *
 *   start_date <= D AND (end_date IS NULL OR end_date > D)
 *
 * Every allocation view in the app is this with a different D. "Today" is just
 * the default. Note the strict `>` on end_date: intervals are half-open, so an
 * allocation ending on D is already gone on D (§7).
 */
function activeOn(date: IsoDate) {
  return and(
    lte(allocations.startDate, date),
    or(isNull(allocations.endDate), gt(allocations.endDate, date)),
  );
}

export interface AllocationRow extends Allocation {
  appName: string;
  userName: string;
  requiredCapacity: number;
}

export interface PersonAllocation {
  user: User;
  teams: Team[];
  allocations: AllocationRow[];
  total: number;
  status: PersonStatus;
}

export interface AppAllocation {
  app: App;
  teams: Team[];
  allocations: AllocationRow[];
  total: number;
  status: AppStatus;
  delta: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function allocationRowsOn(date: IsoDate): Promise<AllocationRow[]> {
  return allocationDb
    .select({
      id: allocations.id,
      userId: allocations.userId,
      appId: allocations.appId,
      percentage: allocations.percentage,
      startDate: allocations.startDate,
      endDate: allocations.endDate,
      createdAt: allocations.createdAt,
      appName: apps.name,
      userName: users.name,
      requiredCapacity: apps.requiredCapacity,
    })
    .from(allocations)
    .innerJoin(apps, eq(apps.id, allocations.appId))
    .innerJoin(users, eq(users.id, allocations.userId))
    .where(activeOn(date))
    .orderBy(desc(allocations.percentage));
}

async function teamsByUser(): Promise<Map<number, Team[]>> {
  const rows = await allocationDb
    .select({ userId: userTeams.userId, team: teams })
    .from(userTeams)
    .innerJoin(teams, eq(teams.id, userTeams.teamId));
  const map = new Map<number, Team[]>();
  for (const { userId, team } of rows) {
    const list = map.get(userId) ?? [];
    list.push(team);
    map.set(userId, list);
  }
  return map;
}

async function teamsByApp(): Promise<Map<number, Team[]>> {
  const rows = await allocationDb
    .select({ appId: appTeams.appId, team: teams })
    .from(appTeams)
    .innerJoin(teams, eq(teams.id, appTeams.teamId));
  const map = new Map<number, Team[]>();
  for (const { appId, team } of rows) {
    const list = map.get(appId) ?? [];
    list.push(team);
    map.set(appId, list);
  }
  return map;
}

/**
 * §6.1 People panel — sorted ascending so the underallocated float to the top,
 * with unallocated people first because §4.4 calls them the most actionable
 * signal in the app.
 */
export async function getPeopleAllocation(
  date: IsoDate,
  teamIds?: number[],
): Promise<PersonAllocation[]> {
  const [activeUsers, rows, userTeamMap] = await Promise.all([
    allocationDb
      .select()
      .from(users)
      .where(eq(users.active, true))
      .orderBy(asc(users.name)),
    allocationRowsOn(date),
    teamsByUser(),
  ]);

  const filtered =
    teamIds && teamIds.length > 0
      ? activeUsers.filter((u) =>
          (userTeamMap.get(u.id) ?? []).some((t) => teamIds.includes(t.id)),
        )
      : activeUsers;

  return filtered
    .map((user) => {
      const mine = rows.filter((r) => r.userId === user.id);
      const total = round2(mine.reduce((s, r) => s + r.percentage, 0));
      return {
        user,
        teams: userTeamMap.get(user.id) ?? [],
        allocations: mine,
        total,
        status: personStatus(total),
      };
    })
    .sort((a, b) => a.total - b.total || a.user.name.localeCompare(b.user.name));
}

/** §6.1 Apps panel — sorted by shortfall descending. */
export async function getAppsAllocation(
  date: IsoDate,
  teamIds?: number[],
): Promise<AppAllocation[]> {
  const [activeApps, rows, appTeamMap] = await Promise.all([
    allocationDb
      .select()
      .from(apps)
      .where(eq(apps.active, true))
      .orderBy(asc(apps.name)),
    allocationRowsOn(date),
    teamsByApp(),
  ]);

  const filtered =
    teamIds && teamIds.length > 0
      ? activeApps.filter((app) =>
          (appTeamMap.get(app.id) ?? []).some((t) => teamIds.includes(t.id)),
        )
      : activeApps;

  return filtered
    .map((app) => {
      const mine = rows.filter((r) => r.appId === app.id);
      const total = round2(mine.reduce((s, r) => s + r.percentage, 0));
      return {
        app,
        teams: appTeamMap.get(app.id) ?? [],
        allocations: mine,
        total,
        status: appStatus(total, app.requiredCapacity),
        delta: capacityDelta(total, app.requiredCapacity),
      };
    })
    .sort((a, b) => a.delta - b.delta || a.app.name.localeCompare(b.app.name));
}

export async function getTeams(): Promise<Team[]> {
  return allocationDb
    .select()
    .from(teams)
    .where(eq(teams.active, true))
    .orderBy(asc(teams.name));
}

export async function getUser(userId: number): Promise<User | undefined> {
  return allocationDb.select().from(users).where(eq(users.id, userId)).get();
}

export async function getApp(appId: number): Promise<App | undefined> {
  return allocationDb.select().from(apps).where(eq(apps.id, appId)).get();
}

export async function getAllUsers(includeInactive = false): Promise<User[]> {
  const q = allocationDb.select().from(users).orderBy(asc(users.name));
  if (includeInactive) return q;
  return q.where(eq(users.active, true));
}

export async function getAllApps(includeInactive = false): Promise<App[]> {
  const q = allocationDb.select().from(apps).orderBy(asc(apps.name));
  if (includeInactive) return q;
  return q.where(eq(apps.active, true));
}

/** Every allocation for one user, past present and future — the §6.2 timeline. */
export async function getUserAllocationHistory(
  userId: number,
): Promise<AllocationRow[]> {
  return allocationDb
    .select({
      id: allocations.id,
      userId: allocations.userId,
      appId: allocations.appId,
      percentage: allocations.percentage,
      startDate: allocations.startDate,
      endDate: allocations.endDate,
      createdAt: allocations.createdAt,
      appName: apps.name,
      userName: users.name,
      requiredCapacity: apps.requiredCapacity,
    })
    .from(allocations)
    .innerJoin(apps, eq(apps.id, allocations.appId))
    .innerJoin(users, eq(users.id, allocations.userId))
    .where(eq(allocations.userId, userId))
    .orderBy(desc(allocations.startDate));
}

/** Every allocation for one app — the §6.3 timeline. */
export async function getAppAllocationHistory(
  appId: number,
): Promise<AllocationRow[]> {
  return allocationDb
    .select({
      id: allocations.id,
      userId: allocations.userId,
      appId: allocations.appId,
      percentage: allocations.percentage,
      startDate: allocations.startDate,
      endDate: allocations.endDate,
      createdAt: allocations.createdAt,
      appName: apps.name,
      userName: users.name,
      requiredCapacity: apps.requiredCapacity,
    })
    .from(allocations)
    .innerJoin(apps, eq(apps.id, allocations.appId))
    .innerJoin(users, eq(users.id, allocations.userId))
    .where(eq(allocations.appId, appId))
    .orderBy(desc(allocations.startDate));
}

export interface ChangeEntry {
  id: number;
  changedAt: Date;
  changeType: "created" | "modified" | "ended";
  note: string | null;
  allocationId: number;
  userName: string;
  appName: string;
  percentage: number;
  startDate: IsoDate;
  endDate: IsoDate | null;
}

/** §6.3 — change history from AllocationChange, most recent first. */
export async function getAllocationChanges(filter?: {
  appId?: number;
  userId?: number;
  limit?: number;
}): Promise<ChangeEntry[]> {
  const conditions = [];
  if (filter?.appId !== undefined) conditions.push(eq(allocations.appId, filter.appId));
  if (filter?.userId !== undefined) conditions.push(eq(allocations.userId, filter.userId));

  return allocationDb
    .select({
      id: allocationChanges.id,
      changedAt: allocationChanges.changedAt,
      changeType: allocationChanges.changeType,
      note: allocationChanges.note,
      allocationId: allocationChanges.allocationId,
      userName: users.name,
      appName: apps.name,
      percentage: allocations.percentage,
      startDate: allocations.startDate,
      endDate: allocations.endDate,
    })
    .from(allocationChanges)
    .innerJoin(allocations, eq(allocations.id, allocationChanges.allocationId))
    .innerJoin(users, eq(users.id, allocations.userId))
    .innerJoin(apps, eq(apps.id, allocations.appId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(allocationChanges.changedAt), desc(allocationChanges.id))
    .limit(filter?.limit ?? 100);
}

/** Allocations for one user in force on a date — used by the §5.2 prep panel. */
export async function getUserAllocationsOn(
  userId: number,
  date: IsoDate,
): Promise<AllocationRow[]> {
  const rows = await allocationRowsOn(date);
  return rows.filter((r) => r.userId === userId);
}

export function toRange(row: {
  startDate: IsoDate;
  endDate: IsoDate | null;
}): DateRange {
  return { start: row.startDate, end: row.endDate };
}

/** Every allocation touching a user, for the §4.3 per-point-in-time check. */
export async function getUserAllocationsForConflictCheck(
  userId: number,
  excludeAllocationId?: number,
): Promise<Allocation[]> {
  const rows = await allocationDb
    .select()
    .from(allocations)
    .where(eq(allocations.userId, userId));
  return excludeAllocationId === undefined
    ? rows
    : rows.filter((r) => r.id !== excludeAllocationId);
}

export async function getAllocation(id: number): Promise<Allocation | undefined> {
  return allocationDb.select().from(allocations).where(eq(allocations.id, id)).get();
}

export async function getTeamsForUsers(userIds: number[]) {
  if (userIds.length === 0) return [];
  return allocationDb
    .select({ userId: userTeams.userId, team: teams })
    .from(userTeams)
    .innerJoin(teams, eq(teams.id, userTeams.teamId))
    .where(inArray(userTeams.userId, userIds));
}

/** Counts for the §6.1 summary strip that come from allocation. */
export async function getAllocationSummary(date: IsoDate, teamIds?: number[]) {
  const [people, appRows] = await Promise.all([
    getPeopleAllocation(date, teamIds),
    getAppsAllocation(date, teamIds),
  ]);
  return {
    unallocatedPeople: people.filter((p) => p.status === "unallocated").length,
    underallocatedPeople: people.filter((p) => p.status === "under").length,
    overallocatedPeople: people.filter((p) => p.status === "over").length,
    underResourcedApps: appRows.filter((a) => a.status === "under-resourced").length,
    totalPeople: people.length,
    totalApps: appRows.length,
  };
}

export { sql };

export interface StaffingPoint {
  date: IsoDate;
  total: number;
  required: number;
}

/**
 * §6.3 — "Staffing-over-time chart: total allocation vs. required capacity,
 * making trends visible."
 *
 * Sampled at every boundary in the app's allocation history rather than at
 * fixed intervals: the total only changes when an allocation starts or ends, so
 * boundaries capture every real step exactly and nothing in between is
 * interesting. Fixed sampling would either miss short spells or invent detail.
 */
export async function getAppStaffingOverTime(
  appId: number,
): Promise<StaffingPoint[]> {
  const [app, rows] = await Promise.all([getApp(appId), getAppAllocationHistory(appId)]);
  if (!app || rows.length === 0) return [];

  const boundaries = new Set<IsoDate>();
  for (const row of rows) {
    boundaries.add(row.startDate);
    if (row.endDate) boundaries.add(row.endDate);
  }

  return [...boundaries]
    .sort()
    .map((date) => ({
      date,
      total:
        Math.round(
          rows
            .filter(
              (r) => r.startDate <= date && (r.endDate === null || r.endDate > date),
            )
            .reduce((sum, r) => sum + r.percentage, 0) * 100,
        ) / 100,
      required: app.requiredCapacity,
    }));
}

// ------------------------------------------------------------ §6.6 admin

/**
 * Admin lists everything, including deactivated rows — §6.6 deactivates rather
 * than deletes, so the only place a deactivated entity is still visible (and
 * reactivatable) is here.
 */
export async function getAllTeams(includeInactive = false): Promise<Team[]> {
  const q = allocationDb.select().from(teams).orderBy(asc(teams.name));
  if (includeInactive) return q;
  return q.where(eq(teams.active, true));
}

export async function getTeamIdsByUser(): Promise<Map<number, number[]>> {
  const rows = await allocationDb.select().from(userTeams);
  return groupIds(rows.map((r) => [r.userId, r.teamId]));
}

export async function getTeamIdsByApp(): Promise<Map<number, number[]>> {
  const rows = await allocationDb.select().from(appTeams);
  return groupIds(rows.map((r) => [r.appId, r.teamId]));
}

function groupIds(pairs: Array<[number, number]>): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const [key, value] of pairs) {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  }
  return map;
}
