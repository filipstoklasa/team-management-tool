"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client.ts";
import { appTeams, apps, teams, userTeams, users } from "@/db/schema/allocation.ts";
import { appSchema, teamSchema, userSchema } from "@/domain/schemas.ts";
import { fail, fromZod, ok, type ActionResult } from "./result.ts";

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveUser(input: unknown) {
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  try {
    const row = db.transaction((tx) => {
      const user = v.id
        ? tx
            .update(users)
            .set({ name: v.name, title: v.title, startDate: v.startDate })
            .where(eq(users.id, v.id))
            .returning()
            .get()
        : tx
            .insert(users)
            .values({ name: v.name, title: v.title, startDate: v.startDate, active: true })
            .returning()
            .get();

      tx.delete(userTeams).where(eq(userTeams.userId, user.id)).run();
      for (const teamId of v.teamIds) {
        tx.insert(userTeams).values({ userId: user.id, teamId }).run();
      }
      return user;
    });
    refresh();
    return ok(row);
  } catch (error) {
    console.error("saveUser failed:", error);
    return fail("Could not save that person.");
  }
}

export interface DeactivationResult {
  userId: number;
  userName: string;
  /**
   * §9.5 leavers: "when a user is deactivated on the allocation side, prompt to
   * hard-delete their people records."
   *
   * A prompt, never a cascade. Their allocation history stays for capacity
   * analysis; the decision about their personal notes is made explicitly, as a
   * second action.
   */
  promptPeopleRecordsDeletion: boolean;
}

export async function setUserActive(
  userId: number,
  active: boolean,
): Promise<ActionResult<DeactivationResult>> {
  try {
    const user = db
      .update(users)
      .set({ active })
      .where(eq(users.id, userId))
      .returning()
      .get();
    if (!user) return fail("That person no longer exists.");
    refresh();
    return ok({
      userId,
      userName: user.name,
      promptPeopleRecordsDeletion: !active,
    });
  } catch (error) {
    console.error("setUserActive failed:", error);
    return fail("Could not update that person.");
  }
}

export async function saveTeam(input: unknown) {
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  try {
    const row = v.id
      ? db.update(teams).set({ name: v.name }).where(eq(teams.id, v.id)).returning().get()
      : db.insert(teams).values({ name: v.name, active: true }).returning().get();
    refresh();
    return ok(row);
  } catch (error) {
    console.error("saveTeam failed:", error);
    return fail("Could not save that team.");
  }
}

export async function setTeamActive(teamId: number, active: boolean) {
  try {
    db.update(teams).set({ active }).where(eq(teams.id, teamId)).run();
    refresh();
    return ok(undefined);
  } catch {
    return fail("Could not update that team.");
  }
}

export async function saveApp(input: unknown) {
  const parsed = appSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  try {
    const row = db.transaction((tx) => {
      const app = v.id
        ? tx
            .update(apps)
            .set({ name: v.name, requiredCapacity: v.requiredCapacity, notes: v.notes })
            .where(eq(apps.id, v.id))
            .returning()
            .get()
        : tx
            .insert(apps)
            .values({
              name: v.name,
              requiredCapacity: v.requiredCapacity,
              notes: v.notes,
              active: true,
            })
            .returning()
            .get();

      tx.delete(appTeams).where(eq(appTeams.appId, app.id)).run();
      for (const teamId of v.teamIds) {
        tx.insert(appTeams).values({ appId: app.id, teamId }).run();
      }
      return app;
    });
    refresh();
    return ok(row);
  } catch (error) {
    console.error("saveApp failed:", error);
    return fail("Could not save that app.");
  }
}

export async function setAppActive(appId: number, active: boolean) {
  try {
    db.update(apps).set({ active }).where(eq(apps.id, appId)).run();
    refresh();
    return ok(undefined);
  } catch {
    return fail("Could not update that app.");
  }
}
