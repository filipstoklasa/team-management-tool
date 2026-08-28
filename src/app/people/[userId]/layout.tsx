import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonTabs } from "@/components/people/person-tabs";
import { getPeopleAllocation, getUser } from "@/data/allocation.ts";
import { peopleRecordsAvailable } from "@/data/people.ts";
import { formatIsoDate, today } from "@/domain/date.ts";
import { formatPercent, personStatusMeta } from "@/lib/status.ts";
import { cn } from "@/lib/utils";

/**
 * §6.2 — "One screen per report, tabbed. This is the screen used most."
 *
 * Each tab is a real route rather than client state, so a tab is linkable,
 * survives a refresh and lands in browser history (§10.5).
 */
export default async function PersonLayout({
  children,
  params,
}: LayoutProps<"/people/[userId]">) {
  const { userId } = await params;
  const id = Number(userId);
  if (!Number.isInteger(id)) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/people"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-3.5" />
        All people
      </Link>

      <Suspense fallback={<Skeleton className="h-16 w-full" />}>
        <PersonHeader userId={id} />
      </Suspense>

      <PersonTabs userId={id} peopleRecordsAvailable={peopleRecordsAvailable()} />

      {children}
    </div>
  );
}

async function PersonHeader({ userId }: { userId: number }) {
  const user = await getUser(userId);
  if (!user) notFound();

  const people = await getPeopleAllocation(today());
  const entry = people.find((p) => p.user.id === userId);
  const meta = entry ? personStatusMeta[entry.status] : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {user.name}
          {!user.active && <Badge variant="outline">Inactive</Badge>}
        </h1>
        <p className="text-muted-foreground text-sm">
          {user.title ?? "—"}
          {user.startDate && <> · joined {formatIsoDate(user.startDate)}</>}
          {entry && entry.teams.length > 0 && (
            <> · {entry.teams.map((t) => t.name).join(", ")}</>
          )}
        </p>
      </div>

      {entry && meta && (
        <div className={cn("rounded-lg px-4 py-2 text-right", meta.bg)}>
          <div className={cn("tabular text-2xl font-semibold", meta.text)}>
            {formatPercent(entry.total)}
          </div>
          <div className={cn("text-xs", meta.text)}>{meta.label} today</div>
        </div>
      )}
    </div>
  );
}
