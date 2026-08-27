import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AllocationRowActions } from "./allocation-row-actions";
import type { AllocationRow } from "@/data/allocation.ts";
import { formatIsoDate, today } from "@/domain/date.ts";
import { appColor, formatPercent } from "@/lib/status.ts";
import { cn } from "@/lib/utils";

export function AllocationTable({
  rows,
  showUser = true,
  showApp = true,
}: {
  rows: AllocationRow[];
  showUser?: boolean;
  showApp?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No allocations recorded.
      </p>
    );
  }

  const t = today();

  return (
    <table className="w-full text-sm">
      <thead className="text-muted-foreground border-b text-left text-xs">
        <tr>
          {showUser && <th className="px-4 py-2 font-medium">Person</th>}
          {showApp && <th className="px-4 py-2 font-medium">App</th>}
          <th className="px-4 py-2 text-right font-medium">%</th>
          <th className="px-4 py-2 font-medium">From</th>
          <th className="px-4 py-2 font-medium">Until</th>
          <th className="px-4 py-2 font-medium">State</th>
          <th className="px-4 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => {
          const future = row.startDate > t;
          const ended = row.endDate !== null && row.endDate <= t;
          const state = future ? "Planned" : ended ? "Ended" : "Active";

          return (
            <tr key={row.id} className={cn("hover:bg-muted/40", ended && "opacity-60")}>
              {showUser && (
                <td className="px-4 py-2">
                  <Link href={`/people/${row.userId}`} className="hover:underline">
                    {row.userName}
                  </Link>
                </td>
              )}
              {showApp && (
                <td className="px-4 py-2">
                  <Link
                    href={`/apps/${row.appId}`}
                    className="flex items-center gap-1.5 hover:underline"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: appColor(row.appId) }}
                    />
                    {row.appName}
                  </Link>
                </td>
              )}
              <td className="tabular px-4 py-2 text-right font-medium">
                {formatPercent(row.percentage)}
              </td>
              <td className="tabular text-muted-foreground px-4 py-2">
                {formatIsoDate(row.startDate)}
              </td>
              <td className="tabular text-muted-foreground px-4 py-2">
                {row.endDate ? formatIsoDate(row.endDate) : "ongoing"}
              </td>
              <td className="px-4 py-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    state === "Active" && "text-status-full bg-status-full-bg",
                    state === "Planned" && "text-status-over bg-status-over-bg",
                  )}
                >
                  {state}
                </Badge>
              </td>
              <td className="px-2 py-2 text-right">
                <AllocationRowActions row={row} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
