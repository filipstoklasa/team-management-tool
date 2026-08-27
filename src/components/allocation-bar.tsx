import { appColor } from "@/lib/status.ts";
import { cn } from "@/lib/utils";

interface Segment {
  appId: number;
  appName: string;
  percentage: number;
}

/**
 * §6.1 — "a visual allocation bar".
 *
 * Stacked by app rather than showing a single total, because the useful
 * question on the dashboard is not just "is this person at 120%" but "120% of
 * what". The 100% mark is drawn as a reference line so over-allocation is
 * visible as overflow past it, not merely as a number.
 */
export function AllocationBar({
  segments,
  total,
  scale = 100,
  className,
}: {
  segments: Segment[];
  total: number;
  /** Full-width value. 100 for people; required capacity for apps. */
  scale?: number;
  className?: string;
}) {
  // Overflow past the reference is shown compressed, so a 300% row stays legible.
  const displayMax = Math.max(scale, total);
  const referenceAt = (scale / displayMax) * 100;

  return (
    <div className={cn("relative h-6 w-full", className)}>
      <div className="bg-track flex h-full w-full overflow-hidden rounded-md">
        {segments.map((segment, index) => (
          <div
            key={`${segment.appId}-${index}`}
            className="h-full border-r border-white/25 last:border-r-0 dark:border-black/20"
            style={{
              width: `${(segment.percentage / displayMax) * 100}%`,
              backgroundColor: appColor(segment.appId),
            }}
            title={`${segment.appName} — ${segment.percentage}%`}
          />
        ))}
      </div>
      {total > scale && (
        <div
          className="border-foreground/70 absolute inset-y-0 border-l-2 border-dashed"
          style={{ left: `${referenceAt}%` }}
          title={`${scale}%`}
        />
      )}
    </div>
  );
}

/** §6.3 — app staffing against required capacity, with the target marked. */
export function CapacityBar({
  total,
  required,
  status,
  className,
}: {
  total: number;
  required: number;
  status: "under-resourced" | "staffed" | "over-resourced";
  className?: string;
}) {
  const displayMax = Math.max(required, total, 1);
  const fill = (total / displayMax) * 100;
  const target = (required / displayMax) * 100;
  const barColor =
    status === "under-resourced"
      ? "bg-status-under"
      : status === "over-resourced"
        ? "bg-status-over"
        : "bg-status-full";

  return (
    <div className={cn("relative h-6 w-full", className)}>
      <div className="bg-track h-full w-full overflow-hidden rounded-md">
        <div className={cn("h-full rounded-l-md", barColor)} style={{ width: `${fill}%` }} />
      </div>
      <div
        className="border-foreground/70 absolute inset-y-0 border-l-2 border-dashed"
        style={{ left: `${target}%` }}
        title={`Required: ${required}%`}
      />
    </div>
  );
}
