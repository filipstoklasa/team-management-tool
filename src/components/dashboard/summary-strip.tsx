import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: number | string;
  tone?: "neutral" | "alert" | "warn";
  hint?: string;
}

/**
 * §6.1 — "Summary strip — counts: underallocated people, under-resourced apps,
 * unallocated people, overdue 1:1s, open action items."
 *
 * The last two are Module B and are simply omitted when people.db is absent
 * rather than shown as zero, which would be a lie.
 */
export function SummaryStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card px-4 py-3" title={stat.hint}>
          <dt className="text-muted-foreground text-xs">{stat.label}</dt>
          <dd
            className={cn(
              "tabular mt-0.5 text-2xl font-semibold",
              stat.tone === "alert" && stat.value !== 0 && "text-status-unallocated",
              stat.tone === "warn" && stat.value !== 0 && "text-status-under",
            )}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
