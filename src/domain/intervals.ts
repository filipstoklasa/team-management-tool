import { type IsoDate, maxDate, minDate } from "./date.ts";

/**
 * A half-open interval `[start, end)` — the end date is EXCLUSIVE (§7).
 *
 * This is the detail that makes allocation handover work: an allocation ending
 * 2026-02-01 and another starting 2026-02-01 are adjacent, not overlapping, and
 * there is no gap between them. Using inclusive end dates produces either a
 * one-day overlap or a one-day hole, depending on which way you round.
 *
 * `end === null` means ongoing, with no planned finish.
 */
export interface DateRange {
  readonly start: IsoDate;
  readonly end: IsoDate | null;
}

/** §4.3: `end_date` must be > `start_date` when not NULL. */
export function isValidRange(range: DateRange): boolean {
  return range.end === null || range.end > range.start;
}

/** True when `date` falls within `[start, end)`. This is the §4.2 "as of D" test. */
export function contains(range: DateRange, date: IsoDate): boolean {
  return range.start <= date && (range.end === null || range.end > date);
}

/**
 * True when two half-open ranges share at least one day.
 * Ranges that merely touch at a boundary do NOT overlap.
 */
export function overlaps(a: DateRange, b: DateRange): boolean {
  const aRunsPastBStart = a.end === null || a.end > b.start;
  const bRunsPastAStart = b.end === null || b.end > a.start;
  return aRunsPastBStart && bRunsPastAStart;
}

/** The shared portion of two ranges, or null when they do not overlap. */
export function intersection(a: DateRange, b: DateRange): DateRange | null {
  if (!overlaps(a, b)) return null;
  const start = maxDate(a.start, b.start);
  const end =
    a.end === null ? b.end : b.end === null ? a.end : minDate(a.end, b.end);
  return { start, end };
}

/** Formats a range for display, e.g. "12 Mar 2026 → ongoing". */
export function describeRange(
  range: DateRange,
  format: (d: IsoDate) => string,
): string {
  return `${format(range.start)} → ${range.end === null ? "ongoing" : format(range.end)}`;
}
