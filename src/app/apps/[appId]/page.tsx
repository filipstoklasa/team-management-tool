import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AllocationTable } from "@/components/allocation/allocation-table";
import { Timeline } from "@/components/timeline";
import { StaffingChart } from "@/components/apps/staffing-chart";
import { ChangeHistory } from "@/components/allocation/change-history";
import {
  getAllocationChanges,
  getApp,
  getAppAllocationHistory,
  getAppStaffingOverTime,
  getAppsAllocation,
} from "@/data/allocation.ts";
import { today } from "@/domain/date.ts";
import { appColor, appStatusMeta, formatPercent } from "@/lib/status.ts";
import { cn } from "@/lib/utils";

/** §6.3 — app detail. */
export default async function AppDetailPage({ params }: PageProps<"/apps/[appId]">) {
  const { appId } = await params;
  const id = Number(appId);
  if (!Number.isInteger(id)) notFound();

  const app = await getApp(id);
  if (!app) notFound();

  const [rows, staffing, changes, allApps] = await Promise.all([
    getAppAllocationHistory(id),
    getAppStaffingOverTime(id),
    getAllocationChanges({ appId: id, limit: 30 }),
    getAppsAllocation(today()),
  ]);

  const entry = allApps.find((a) => a.app.id === id);
  const meta = entry ? appStatusMeta[entry.status] : null;

  return (
    <div className="space-y-5">
      <Link
        href="/apps"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-3.5" />
        All apps
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {app.name}
            {!app.active && <Badge variant="outline">Inactive</Badge>}
          </h1>
          {app.notes && (
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm">{app.notes}</p>
          )}
          {entry && entry.teams.length > 0 && (
            <p className="text-muted-foreground mt-1 text-xs">
              {entry.teams.map((t) => t.name).join(", ")}
            </p>
          )}
        </div>
        {entry && meta && (
          <div className={cn("rounded-lg px-4 py-2 text-right", meta.bg)}>
            <div className={cn("tabular text-2xl font-semibold", meta.text)}>
              {formatPercent(entry.total)}
            </div>
            <div className={cn("text-xs", meta.text)}>
              of {app.requiredCapacity}% required
            </div>
          </div>
        )}
      </div>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Staffing over time</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffingChart points={staffing} color={appColor(id)} />
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Who is allocated</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline
            rows={rows.map((row) => ({
              id: row.id,
              label: row.userName,
              start: row.startDate,
              end: row.endDate,
              percentage: row.percentage,
              color: appColor(row.userId + 3),
            }))}
          />
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="bg-muted/40 border-b py-3">
          <CardTitle className="text-sm font-medium">All allocations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AllocationTable rows={rows} showApp={false} />
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Change history</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeHistory entries={changes} />
        </CardContent>
      </Card>
    </div>
  );
}
