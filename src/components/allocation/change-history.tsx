import { Badge } from "@/components/ui/badge";
import type { ChangeEntry } from "@/data/allocation.ts";
import { formatIsoDate } from "@/domain/date.ts";
import { cn } from "@/lib/utils";

/** §6.3 — "Change history from AllocationChange". The §4.1 audit trail surfaced. */
export function ChangeHistory({ entries }: { entries: ChangeEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No changes recorded.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 text-[13px]">
          <span className="tabular text-muted-foreground w-24 shrink-0 text-[11px]">
            {entry.changedAt.toISOString().slice(0, 10)}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "w-16 shrink-0 justify-center text-[10px]",
              entry.changeType === "created" && "text-status-full bg-status-full-bg",
              entry.changeType === "ended" && "text-muted-foreground",
              entry.changeType === "modified" && "text-status-under bg-status-under-bg",
            )}
          >
            {entry.changeType}
          </Badge>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{entry.userName}</span>
            <span className="text-muted-foreground">
              {" "}
              — {entry.percentage}% from {formatIsoDate(entry.startDate)}
              {entry.endDate ? ` to ${formatIsoDate(entry.endDate)}` : " onwards"}
            </span>
            {entry.note && (
              <span className="text-muted-foreground block text-[12px] italic">
                {entry.note}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
