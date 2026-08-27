import Link from "next/link";
import { CircleAlert, MessageSquareOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AllocationBar } from "@/components/allocation-bar";
import type { PersonAllocation } from "@/data/allocation.ts";
import { formatPercent, personStatusMeta } from "@/lib/status.ts";
import { cn } from "@/lib/utils";

/**
 * §6.1 — "active users with a visual allocation bar, sorted ascending so
 * underallocated float to the top. Colour-coded under / full / over. Each row
 * also shows days since last 1:1."
 *
 * `daysSince` is Module B data and arrives separately. When people.db is absent
 * it is simply an empty map and the column disappears — the panel does not
 * care, which is the point (§9.2).
 */
export function PeoplePanel({
  people,
  daysSince,
  openItems,
  showModuleB,
}: {
  people: PersonAllocation[];
  daysSince: Map<number, number>;
  openItems: Map<number, number>;
  showModuleB: boolean;
}) {
  if (people.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No active people match this filter.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {people.map((person) => {
        const meta = personStatusMeta[person.status];
        const since = daysSince.get(person.user.id);
        const open = openItems.get(person.user.id) ?? 0;

        return (
          <li key={person.user.id}>
            <Link
              href={`/people/${person.user.id}`}
              className="hover:bg-muted/50 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors sm:grid-cols-[13rem_minmax(0,1fr)_4rem_4.5rem_5.5rem]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{person.user.name}</span>
                  {person.status === "unallocated" && (
                    <CircleAlert className="text-status-unallocated size-3.5 shrink-0" />
                  )}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {person.user.title ?? "—"}
                  {person.teams.length > 0 && (
                    <span className="ml-1.5">· {person.teams.map((t) => t.name).join(", ")}</span>
                  )}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <AllocationBar
                  segments={person.allocations.map((a) => ({
                    appId: a.appId,
                    appName: a.appName,
                    percentage: a.percentage,
                  }))}
                  total={person.total}
                />
                <div className="text-muted-foreground mt-1 truncate text-[11px]">
                  {person.allocations.length === 0
                    ? "No allocations"
                    : person.allocations
                        .map((a) => `${a.appName} ${formatPercent(a.percentage)}`)
                        .join(" · ")}
                </div>
              </div>

              <div className={cn("tabular text-right text-sm font-semibold", meta.text)}>
                {formatPercent(person.total)}
              </div>

              {showModuleB ? (
                <div
                  className="text-muted-foreground tabular flex items-center justify-end gap-1 text-[11px]"
                  title={
                    since === undefined
                      ? "No 1:1 ever recorded"
                      : `Last 1:1 ${since} days ago`
                  }
                >
                  {since === undefined ? (
                    <span className="text-status-under flex items-center gap-0.5 font-medium">
                      <MessageSquareOff className="size-3" />
                      never
                    </span>
                  ) : (
                    <span className={cn(since > 30 && "text-status-under font-medium")}>
                      {since}d
                    </span>
                  )}
                  {open > 0 && (
                    <span className="bg-secondary text-secondary-foreground rounded px-1 text-[10px]">
                      {open}
                    </span>
                  )}
                </div>
              ) : (
                <div />
              )}

              <div className="flex justify-end">
                <Badge variant="outline" className={cn("shrink-0", meta.text, meta.bg)}>
                  {meta.label}
                </Badge>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
