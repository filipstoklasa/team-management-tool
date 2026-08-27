import {
  addMonths,
  daysBetween,
  formatIsoDate,
  maxDate,
  minDate,
  today,
  type IsoDate,
} from "@/domain/date.ts";
import { cn } from "@/lib/utils";

export interface TimelineRow {
  id: number;
  label: string;
  sublabel?: string;
  start: IsoDate;
  /** null = ongoing. */
  end: IsoDate | null;
  percentage: number;
  color: string;
  href?: string;
}

/**
 * §6.2 / §6.3 — "Gantt-style timeline of app assignments over time, past and
 * future."
 *
 * Ongoing allocations have no end date, so the window is extended past today
 * far enough for them to read as continuing rather than as stopping at the
 * edge. Today is marked, because the whole point of the view is seeing what is
 * behind you and what is still ahead.
 */
export function Timeline({ rows }: { rows: TimelineRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No allocations recorded.
      </p>
    );
  }

  const t = today();
  let windowStart = rows.reduce<IsoDate>((min, r) => minDate(min, r.start), rows[0].start);
  let windowEnd = rows.reduce<IsoDate>(
    (max, r) => maxDate(max, r.end ?? addMonths(t, 3)),
    addMonths(t, 3),
  );
  // A little padding either side so bars never touch the frame.
  windowStart = addMonths(windowStart, -1);
  windowEnd = addMonths(windowEnd, 1);

  const span = Math.max(daysBetween(windowStart, windowEnd), 1);
  const pct = (date: IsoDate) => (daysBetween(windowStart, date) / span) * 100;

  // Quarter gridlines — dense enough to read, sparse enough not to be noise.
  const ticks: IsoDate[] = [];
  let cursor = windowStart;
  while (cursor < windowEnd) {
    ticks.push(cursor);
    cursor = addMonths(cursor, 3);
  }

  return (
    <div className="space-y-1">
      <div className="relative h-5">
        {ticks.map((tick) => (
          <span
            key={tick}
            className="text-muted-foreground absolute text-[10px] whitespace-nowrap"
            style={{ left: `${pct(tick)}%` }}
          >
            {tick.slice(0, 7)}
          </span>
        ))}
      </div>

      <div className="relative">
        {/* gridlines */}
        <div className="pointer-events-none absolute inset-0">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="border-border absolute inset-y-0 border-l border-dashed"
              style={{ left: `${pct(tick)}%` }}
            />
          ))}
          <span
            className="border-status-unallocated absolute inset-y-0 z-10 border-l-2"
            style={{ left: `${pct(t)}%` }}
            title={`Today — ${formatIsoDate(t)}`}
          />
        </div>

        <ul className="relative space-y-1.5 py-1">
          {rows.map((row) => {
            const left = pct(row.start);
            const right = pct(row.end ?? windowEnd);
            const isFuture = row.start > t;
            const isPast = row.end !== null && row.end <= t;

            return (
              <li key={row.id} className="relative h-9">
                <div
                  className={cn(
                    "absolute inset-y-0 flex min-w-[2px] items-center overflow-hidden rounded px-2",
                    isFuture && "opacity-70 outline-2 outline-dashed outline-offset-[-2px]",
                    isPast && "opacity-45",
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(right - left, 0.4)}%`,
                    backgroundColor: row.color,
                  }}
                  title={`${row.label} · ${row.percentage}% · ${formatIsoDate(row.start)} → ${
                    row.end ? formatIsoDate(row.end) : "ongoing"
                  }`}
                >
                  <span className="truncate text-xs font-medium text-white drop-shadow-sm">
                    {row.label}
                    <span className="ml-1.5 opacity-80">{row.percentage}%</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="bg-status-unallocated inline-block h-3 w-0.5" /> today
        </span>
        <span className="flex items-center gap-1">
          <span className="border-foreground/40 inline-block h-3 w-3 rounded-sm border-2 border-dashed" />
          planned
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-foreground/30 inline-block h-3 w-3 rounded-sm" /> ended
        </span>
      </div>
    </div>
  );
}
