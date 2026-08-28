import { AdminPanels } from "@/components/admin/admin-panels";
import {
  getAllApps,
  getAllTeams,
  getAllUsers,
  getTeamIdsByApp,
  getTeamIdsByUser,
} from "@/data/allocation.ts";

/**
 * §6.6 Admin. Everything here reads from allocation only — the panels never touch
 * `people.db`, so this screen works unchanged when people records are absent (§9.2).
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
      <p className="text-muted-foreground text-sm">
        Entities are deactivated, never deleted, so the allocation history that
        references them stays intact.
      </p>

      <AdminPanels
        users={users.map((user) => ({ ...user, teamIds: userTeamIds.get(user.id) ?? [] }))}
        apps={apps.map((app) => ({ ...app, teamIds: appTeamIds.get(app.id) ?? [] }))}
        teams={teams}
      />
    </div>
  );
}
