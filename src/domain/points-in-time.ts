import { type IsoDate } from "./date.ts";
import { contains, type DateRange } from "./intervals.ts";

/**
 * §4.3: "The 100% check evaluates PER POINT IN TIME across the affected range,
 * not just for today."
 *
 * This is the subtlest rule in the design. A new allocation can be perfectly
 * fine on the day it starts and push someone to 130% six weeks later, when an
 * unrelated allocation begins. Checking only "today", or only the start date,
 * silently misses that.
 *
 * The approach: a set of half-open ranges only changes its total at a boundary
 * — a start or an end. Between consecutive boundaries the total is constant.
 * So collecting every boundary and evaluating the total once per resulting
 * segment is both exhaustive and cheap.
 */
export interface Segment<T> {
  readonly range: DateRange;
  readonly items: readonly T[];
  readonly total: number;
}

/** Percentages are stored as REAL; compare on 2dp so 99.999999 is not "over". */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Splits `items` into consecutive segments over which the active set — and
 * therefore the total — does not change. Segments with nothing active are
 * omitted, so gaps in coverage simply do not appear.
 */
export function segmentize<T>(
  items: readonly T[],
  getRange: (item: T) => DateRange,
  getWeight: (item: T) => number,
): Segment<T>[] {
  if (items.length === 0) return [];

  const boundaries = new Set<IsoDate>();
  let anyOngoing = false;
  for (const item of items) {
    const range = getRange(item);
    boundaries.add(range.start);
    if (range.end === null) anyOngoing = true;
    else boundaries.add(range.end);
  }

  const points = [...boundaries].sort();
  const segments: Segment<T>[] = [];

  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = i + 1 < points.length ? points[i + 1] : null;

    // A trailing open-ended segment exists only if something is actually ongoing.
    if (end === null && !anyOngoing) break;

    const active = items.filter((item) => contains(getRange(item), start));
    if (active.length === 0) continue;

    segments.push({
      range: { start, end },
      items: active,
      total: round2(active.reduce((sum, item) => sum + getWeight(item), 0)),
    });
  }

  return segments;
}

/**
 * Segments whose total exceeds `threshold`.
 *
 * §4.3 is explicit that this is a WARNING and never blocks a save: "Real
 * allocation legitimately exceeds 100% during crunch." Callers surface these,
 * they do not reject on them.
 */
export function overAllocatedSegments<T>(
  items: readonly T[],
  getRange: (item: T) => DateRange,
  getWeight: (item: T) => number,
  threshold = 100,
): Segment<T>[] {
  return segmentize(items, getRange, getWeight).filter(
    (segment) => segment.total > threshold,
  );
}

/** The total in force on one specific day. */
export function totalAsOf<T>(
  items: readonly T[],
  getRange: (item: T) => DateRange,
  getWeight: (item: T) => number,
  date: IsoDate,
): number {
  return round2(
    items
      .filter((item) => contains(getRange(item), date))
      .reduce((sum, item) => sum + getWeight(item), 0),
  );
}
