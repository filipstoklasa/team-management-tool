import type { AllocationRow } from "@/data/allocation.ts";
import { toCsv } from "@/domain/csv.ts";
import { parseIsoDate, type IsoDate } from "@/domain/date.ts";
import { overlaps, type DateRange } from "@/domain/intervals.ts";

/**
 * The "selected date range" for an export (#2).
 *
 * Both ends are optional: with neither set the report covers the whole
 * history, which is what the allocation screens already show. `end` follows the
 * §7 half-open convention, so an allocation that ends exactly on `to` is
 * already gone and does not appear — the same rule the rest of the app uses.
 */
export type ReportRange = DateRange | null;

export function parseReportRange(params: {
  from?: string | string[];
  to?: string | string[];
}): ReportRange {
  const from = parseIsoDate(first(params.from));
  const to = parseIsoDate(first(params.to));
  if (from === null && to === null) return null;
  // An open start is expressed as the earliest date the format can hold rather
  // than another nullable end of DateRange, which `overlaps` does not model.
  return { start: from ?? ("0000-01-01" as IsoDate), end: to };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Rows sharing at least one day with the range. Touching boundaries do not count. */
export function filterByRange(
  rows: readonly AllocationRow[],
  range: ReportRange,
): AllocationRow[] {
  if (range === null) return [...rows];
  return rows.filter((row) => overlaps({ start: row.startDate, end: row.endDate }, range));
}

const HEADER = ["Person", "App", "Percentage", "Start date", "End date"] as const;

/**
 * §9.2 requires separate export paths for the two halves. This is the
 * allocation one: it takes allocation rows and has no access to people.db.
 */
export function allocationCsv(rows: readonly AllocationRow[]): string {
  return toCsv(
    HEADER,
    rows.map((row) => [
      row.userName,
      row.appName,
      row.percentage,
      row.startDate,
      // Blank rather than "ongoing": this column is consumed by a spreadsheet.
      row.endDate,
    ]),
  );
}

/** A filename that says what the export is without needing the download page. */
export function exportFilename(subject: string, range: ReportRange): string {
  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const span =
    range === null
      ? "all"
      : `${range.start === "0000-01-01" ? "start" : range.start}_${range.end ?? "ongoing"}`;
  return `allocation-${slug}-${span}.csv`;
}
