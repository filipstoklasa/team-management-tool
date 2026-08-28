import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Timeline } from "@/components/timeline";
import { AllocationTable } from "@/components/allocation/allocation-table";
import { NewAllocationButton } from "@/components/allocation/new-allocation-button";
import { getAllApps, getUser, getUserAllocationHistory } from "@/data/allocation.ts";
import { appColor } from "@/lib/status.ts";

/** §6.2 Allocation tab — "Gantt-style timeline … over time, past and future." */
export default async function PersonAllocationPage({
  params,
}: PageProps<"/people/[userId]/allocation">) {
  const { userId } = await params;
  const id = Number(userId);
  const [rows, user, apps] = await Promise.all([
    getUserAllocationHistory(id),
    getUser(id),
    getAllApps(),
  ]);

  return (
    <div className="space-y-5">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline
            rows={rows.map((row) => ({
              id: row.id,
              label: row.appName,
              start: row.startDate,
              end: row.endDate,
              percentage: row.percentage,
              color: appColor(row.appId),
            }))}
          />
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="bg-muted/40 border-b py-3">
          <CardTitle className="text-sm font-medium">All allocations</CardTitle>
          {/* §6.4 — create from the person's side, with the person fixed. */}
          <CardAction>
            <NewAllocationButton
              label="Add allocation"
              users={user ? [{ id: user.id, name: user.name }] : []}
              apps={apps}
              defaultUserId={id}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <AllocationTable rows={rows} showUser={false} />
        </CardContent>
      </Card>
    </div>
  );
}
