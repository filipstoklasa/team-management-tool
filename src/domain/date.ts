/**
 * Dates in this app are calendar dates, never instants (§7: "store dates as
 * DATE, not DATETIME — allocations change on day boundaries and timezone
 * handling only adds bugs here").
 *
 * They are stored and passed around as ISO-8601 `YYYY-MM-DD` strings, which
 * sort lexicographically, so the §4.2 "as of D" comparison works directly in
 * SQL with plain `<=` and `>`. The brand stops a bare string being passed
 * where a date is expected.
 */
export type IsoDate = string & { readonly __isoDate: unique symbol };

const ISO_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_SHAPE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2026-02-30 and friends, which the regex alone would accept.
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function asIsoDate(value: string): IsoDate {
  if (!isIsoDate(value)) throw new Error(`Not a valid ISO date: ${value}`);
  return value;
}

/** Parses without throwing — for untrusted input such as searchParams. */
export function parseIsoDate(value: string | undefined | null): IsoDate | null {
  if (!value) return null;
  return isIsoDate(value) ? value : null;
}

/** Local calendar date, not UTC — "today" means today where the user is. */
export function today(): IsoDate {
  const d = new Date();
  return format(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function format(y: number, m: number, d: number): IsoDate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` as IsoDate;
}

/** Arithmetic runs in UTC so a DST transition can never shift a calendar date. */
function toUtc(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt: Date): IsoDate {
  return format(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const dt = toUtc(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  // Clamp: 31 Jan + 1 month is 28/29 Feb, not 2/3 March.
  const lastDay = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0),
  ).getUTCDate();
  dt.setUTCDate(Math.min(d, lastDay));
  return fromUtc(dt);
}

/** Whole days from `a` to `b`; negative when `b` precedes `a`. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

/** e.g. "12 Mar 2026" — used wherever a date is shown to the user. */
export function formatIsoDate(date: IsoDate): string {
  const [y, m, d] = date.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}
