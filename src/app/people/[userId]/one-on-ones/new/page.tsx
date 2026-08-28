import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidancePanel } from "@/components/people/guidance-panel";
import { PeopleRecordsUnavailable } from "@/components/people/people-records-unavailable";
import { OneOnOneEditor } from "@/components/people/one-on-one-editor";
import { PrepPanel } from "@/components/people/prep-panel";
import { getAllocationChanges, getUserAllocationsOn } from "@/data/allocation.ts";
import { getPrepPanelData, peopleRecordsAvailable } from "@/data/people.ts";
import { today } from "@/domain/date.ts";

/** §6.5 — "Prep panel (5.2) visible alongside while writing." */
export default async function NewOneOnOnePage({
  params,
}: PageProps<"/people/[userId]/one-on-ones/new">) {
  const { userId } = await params;
  const id = Number(userId);
  if (!Number.isInteger(id)) notFound();
  if (!peopleRecordsAvailable()) return <PeopleRecordsUnavailable />;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">New 1:1</CardTitle>
        </CardHeader>
        <CardContent>
          <OneOnOneEditor userId={id} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <Prep userId={id} />
        </Suspense>
        <GuidancePanel />
      </div>
    </div>
  );
}

/**
 * The §5.2 join, done here rather than in a data function: the allocation half
 * and the people records half come from separate databases and are combined in the
 * component tree (§10.6).
 */
async function Prep({ userId }: { userId: number }) {
  const prep = await getPrepPanelData(userId);
  const [allocations, changes] = await Promise.all([
    getUserAllocationsOn(userId, today()),
    getAllocationChanges({ userId, limit: 20 }),
  ]);

  const since = prep.lastOneOnOne?.date;
  const recent = changes
    .filter((c) => !since || c.changedAt.toISOString().slice(0, 10) >= since)
    .slice(0, 4)
    .map((c) => ({
      appName: c.appName,
      changeType: c.changeType,
      changedAt: c.changedAt,
    }));

  return (
    <PrepPanel data={prep} allocations={allocations} recentAllocationChanges={recent} />
  );
}
