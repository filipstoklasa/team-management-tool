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
import { ReportToolbar } from "@/components/allocation/report-toolbar";
import { getAllApps, getUser, getUserAllocationHistory } from "@/data/allocation.ts";
import { appColor } from "@/lib/status.ts";
import { filterByRange, parseReportRange } from "@/lib/report.ts";

/** §6.2 Allocation tab — "Gantt-style timeline … over time, past and future." */
export default async function PersonAllocationPage({
  params,
  searchParams,
}: PageProps<"/people/[userId]/allocation">) {
  const { userId } = await params;
  const id = Number(userId);
  const [all, user, apps] = await Promise.all([
    getUserAllocationHistory(id),
    getUser(id),
    getAllApps(),
  ]);

  // #2 — the export range narrows what is on screen too, so that the CSV, the
  // printed page and the tables can never show three different things.
  const rows = filterByRange(all, parseReportRange(await searchParams));

  return (
    <div className="space-y-5">
      <ReportToolbar csvBase={`/export?scope=person&id=${id}`} />
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
