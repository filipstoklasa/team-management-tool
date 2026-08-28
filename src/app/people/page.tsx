import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AllocationBar } from "@/components/allocation-bar";
import { getPeopleAllocation } from "@/data/allocation.ts";
import { getDaysSinceLastOneOnOne } from "@/data/people.ts";
import { today } from "@/domain/date.ts";
import { formatPercent, personStatusMeta } from "@/lib/status.ts";
import { cn } from "@/lib/utils";

export default async function PeopleIndexPage() {
  const date = today();
  const [people, daysSince] = await Promise.all([
    getPeopleAllocation(date),
    getDaysSinceLastOneOnOne(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <p className="text-muted-foreground text-sm">
          {people.length} active {people.length === 1 ? "person" : "people"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => {
          const meta = personStatusMeta[person.status];
          const since = daysSince.get(person.user.id);
          return (
            <Link key={person.user.id} href={`/people/${person.user.id}`}>
              <Card className="hover:border-foreground/25 h-full gap-3 transition-colors">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {person.user.name}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {person.user.title ?? "—"}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(meta.text, meta.bg)}>
                      {formatPercent(person.total)}
                    </Badge>
                  </div>

                  <AllocationBar
                    segments={person.allocations.map((a) => ({
                      appId: a.appId,
                      appName: a.appName,
                      percentage: a.percentage,
                    }))}
                    total={person.total}
                  />

                  <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px]">
                    {person.teams.map((team) => (
                      <span
                        key={team.id}
                        className="bg-secondary rounded px-1.5 py-0.5"
                      >
                        {team.name}
                      </span>
                    ))}
                    <span
                      className={cn(
                        "ml-auto",
                        since === undefined && "text-status-under",
                      )}
                    >
                      {since === undefined ? "no 1:1 yet" : `1:1 ${since}d ago`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
