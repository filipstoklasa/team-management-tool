import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateControl } from "@/components/date-control";
import { TeamFilter } from "@/components/team-filter";
import { AppsPanel } from "@/components/dashboard/apps-panel";
import { PeoplePanel } from "@/components/dashboard/people-panel";
import { SummaryStrip, type Stat } from "@/components/dashboard/summary-strip";
import {
  getAppsAllocation,
  getPeopleAllocation,
  getTeams,
} from "@/data/allocation.ts";
import {
  getDaysSinceLastOneOnOne,
  getOpenActionItemCount,
  getPeopleSummary,
} from "@/data/people.ts";
import {
  formatIsoDate,
  parseIsoDate,
  today,
  type IsoDate,
} from "@/domain/date.ts";
import { OVERDUE_1ON1_DAYS } from "@/lib/status.ts";

/**
 * §6.1 — the dashboard. "Date control at the top drives every allocation panel
 * below it."
 */
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const date = parseIsoDate(asString(params.date)) ?? today();
  const teamIds = asArray(params.team)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  const teams = await getTeams();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Allocation as of {formatIsoDate(date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TeamFilter teams={teams} selected={teamIds} />
          <DateControl date={date} />
        </div>
      </div>

      <Suspense
        key={`summary-${date}-${teamIds}`}
        fallback={<Skeleton className="h-[76px] w-full rounded-lg" />}
      >
        <Summary date={date} teamIds={teamIds} />
      </Suspense>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden py-0">
          <CardHeader className="bg-muted/40 border-b py-3">
            <CardTitle className="text-sm font-medium">
              People
              <span className="text-muted-foreground ml-2 font-normal">
                least allocated first
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Suspense
              key={`people-${date}-${teamIds}`}
              fallback={<PanelSkeleton />}
            >
              <People date={date} teamIds={teamIds} />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="overflow-hidden py-0">
          <CardHeader className="bg-muted/40 border-b py-3">
            <CardTitle className="text-sm font-medium">
              Apps
              <span className="text-muted-foreground ml-2 font-normal">
                largest shortfall first
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Suspense
              key={`apps-${date}-${teamIds}`}
              fallback={<PanelSkeleton />}
            >
              <Apps date={date} teamIds={teamIds} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function Summary({
  date,
  teamIds,
}: {
  date: IsoDate;
  teamIds: number[];
}) {
  const [people, apps, peopleSummary] = await Promise.all([
    getPeopleAllocation(date, teamIds),
    getAppsAllocation(date, teamIds),
    getPeopleSummary(),
  ]);

  const stats: Stat[] = [
    {
      label: "Unallocated",
      value: people.filter((p) => p.status === "unallocated").length,
      tone: "alert",
      hint: "Active people with no allocation on this date",
    },
    {
      label: "Underallocated",
      value: people.filter((p) => p.status === "under").length,
      tone: "warn",
    },
    {
      label: "Under-resourced apps",
      value: apps.filter((a) => a.status === "under-resourced").length,
      tone: "warn",
    },
  ];

  // "Overdue" needs both halves: the active roster, and the last-1:1 dates.
  // Someone who has never had a 1:1 counts as overdue — they are the ones most
  // easily missed.
  const overdue = people.filter((p) => {
    const since = peopleSummary.daysSinceLastOneOnOne.get(p.user.id);
    return since === undefined || since > OVERDUE_1ON1_DAYS;
  }).length;

  stats.push(
    {
      label: "Overdue 1:1s",
      value: overdue,
      tone: "warn",
      hint: `No 1:1 in over ${OVERDUE_1ON1_DAYS} days, or none ever recorded`,
    },
    {
      label: "Open action items",
      value: peopleSummary.openActionItems,
      tone: "neutral",
    },
  );

  return <SummaryStrip stats={stats} />;
}

async function People({ date, teamIds }: { date: IsoDate; teamIds: number[] }) {
  const [people, daysSince, openItems] = await Promise.all([
    getPeopleAllocation(date, teamIds),
    getDaysSinceLastOneOnOne(),
    getOpenActionItemCount(),
  ]);
  return (
    <PeoplePanel people={people} daysSince={daysSince} openItems={openItems} />
  );
}

async function Apps({ date, teamIds }: { date: IsoDate; teamIds: number[] }) {
  return <AppsPanel apps={await getAppsAllocation(date, teamIds)} />;
}

function PanelSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

function asString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function asArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
