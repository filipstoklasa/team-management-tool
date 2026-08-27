import Link from "next/link";
import { Suspense } from "react";
import { CircleDot, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserAllocationsOn } from "@/data/allocation.ts";
import { getActionItems, getGoals, getLastOneOnOne, moduleBAvailable } from "@/data/people.ts";
import { daysBetween, formatIsoDate, today } from "@/domain/date.ts";
import { appColor, formatPercent } from "@/lib/status.ts";

/** §6.2 Overview tab — current allocations, active goals, open items, last 1:1. */
export default async function OverviewPage({ params }: PageProps<"/people/[userId]">) {
  const { userId } = await params;
  const id = Number(userId);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Current allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <CurrentAllocations userId={id} />
          </Suspense>
        </CardContent>
      </Card>

      {moduleBAvailable() && (
        <>
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Open action items</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <OpenItems userId={id} />
              </Suspense>
            </CardContent>
          </Card>

          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Active goals</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <ActiveGoals userId={id} />
              </Suspense>
            </CardContent>
          </Card>

          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Last 1:1</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <LastOneOnOne userId={id} />
              </Suspense>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

async function CurrentAllocations({ userId }: { userId: number }) {
  const rows = await getUserAllocationsOn(userId, today());
  if (rows.length === 0) {
    return (
      <p className="text-status-unallocated text-sm">
        Not allocated to anything today.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/apps/${row.appId}`}
            className="hover:bg-muted/50 -mx-2 flex items-center gap-2 rounded px-2 py-1.5"
          >
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: appColor(row.appId) }}
            />
            <span className="min-w-0 flex-1 truncate text-sm">{row.appName}</span>
            <span className="tabular text-sm font-medium">
              {formatPercent(row.percentage)}
            </span>
            <span className="text-muted-foreground w-32 text-right text-[11px]">
              since {formatIsoDate(row.startDate)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function OpenItems({ userId }: { userId: number }) {
  const items = await getActionItems(userId, "open");
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Nothing outstanding.</p>;
  }
  const t = today();
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const overdue = item.dueDate !== null && item.dueDate < t;
        return (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <CircleDot className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
            <span className="flex-1">{item.description}</span>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {item.owner}
            </Badge>
            {item.dueDate && (
              <span
                className={
                  overdue ? "text-status-unallocated text-[11px] font-medium" : "text-muted-foreground text-[11px]"
                }
              >
                {overdue ? `${daysBetween(item.dueDate, t)}d late` : formatIsoDate(item.dueDate)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

async function ActiveGoals({ userId }: { userId: number }) {
  const goals = (await getGoals(userId)).filter((g) => g.status === "active");
  if (goals.length === 0) {
    return <p className="text-muted-foreground text-sm">No active goals.</p>;
  }
  return (
    <ul className="space-y-2">
      {goals.map((goal) => (
        <li key={goal.id} className="flex items-start gap-2 text-sm">
          <Target className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
          <span className="flex-1">{goal.title}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {goal.category}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

async function LastOneOnOne({ userId }: { userId: number }) {
  const last = await getLastOneOnOne(userId);
  if (!last) {
    return (
      <p className="text-status-under text-sm">No 1:1 has been recorded yet.</p>
    );
  }
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{formatIsoDate(last.date)}</span>
        <span className="text-muted-foreground text-xs">
          {daysBetween(last.date, today())} days ago
        </span>
      </div>
      <p className="text-muted-foreground line-clamp-3 text-[13px] whitespace-pre-wrap">
        {last.managerNotes ?? last.theirTopics ?? "No notes recorded."}
      </p>
      <Link
        href={`/people/${userId}/one-on-ones`}
        className="inline-block text-xs underline underline-offset-2"
      >
        All 1:1s
      </Link>
    </div>
  );
}
