import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CapacityBar } from "@/components/allocation-bar";
import type { AppAllocation } from "@/data/allocation.ts";
import { appStatusMeta, formatPercent } from "@/lib/status.ts";
import { cn } from "@/lib/utils";

/**
 * §6.1 — "current allocation / required_capacity, sorted by shortfall
 * descending, same colour coding."
 */
export function AppsPanel({ apps }: { apps: AppAllocation[] }) {
  if (apps.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No active apps match this filter.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {apps.map((entry) => {
        const meta = appStatusMeta[entry.status];
        return (
          <li key={entry.app.id}>
            <Link
              href={`/apps/${entry.app.id}`}
              className="hover:bg-muted/50 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors sm:grid-cols-[13rem_minmax(0,1fr)_8rem_5.5rem]"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{entry.app.name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {entry.teams.length > 0 ? entry.teams.map((t) => t.name).join(", ") : "—"}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <CapacityBar
                  total={entry.total}
                  required={entry.app.requiredCapacity}
                  status={entry.status}
                />
                <div className="text-muted-foreground mt-1 truncate text-[11px]">
                  {entry.allocations.length === 0
                    ? "Nobody allocated"
                    : entry.allocations
                        .map((a) => `${a.userName} ${formatPercent(a.percentage)}`)
                        .join(" · ")}
                </div>
              </div>

              <div className="tabular text-right text-sm">
                <span className={cn("font-semibold", meta.text)}>
                  {formatPercent(entry.total)}
                </span>
                <span className="text-muted-foreground"> / {entry.app.requiredCapacity}%</span>
              </div>

              <div className="flex justify-end">
                <Badge variant="outline" className={cn("shrink-0", meta.text, meta.bg)}>
                  {entry.delta === 0
                    ? meta.label
                    : `${entry.delta > 0 ? "+" : ""}${entry.delta}%`}
                </Badge>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
