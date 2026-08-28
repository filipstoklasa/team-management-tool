import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminPanels } from "@/components/admin/admin-panels";
import {
  getAllApps,
  getAllTeams,
  getAllUsers,
  getTeamIdsByApp,
  getTeamIdsByUser,
} from "@/data/allocation.ts";
import { moduleBAvailable } from "@/data/people.ts";

/**
 * §6.6 Admin. Everything here reads from Module A only — the panels never touch
 * `people.db`, so this screen works unchanged when Module B is absent (§9.2).
 * The one exception is the §9.5 leaver prompt, which the deactivate action
 * decides server-side and the dialog then runs.
 */
export default async function AdminPage() {
  const [users, apps, teams, userTeamIds, appTeamIds] = await Promise.all([
    getAllUsers(true),
    getAllApps(true),
    getAllTeams(true),
    getTeamIdsByUser(),
    getTeamIdsByApp(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-muted-foreground text-sm">
            People, apps and teams. Entities are deactivated, never deleted, so the
            allocation history that references them stays intact.
          </p>
        </div>
        {moduleBAvailable() && (
          <Link
            href="/retention"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors"
          >
            Retention review
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      <AdminPanels
        users={users.map((user) => ({ ...user, teamIds: userTeamIds.get(user.id) ?? [] }))}
        apps={apps.map((app) => ({ ...app, teamIds: appTeamIds.get(app.id) ?? [] }))}
        teams={teams}
      />
    </div>
  );
}
