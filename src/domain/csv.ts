/**
 * RFC 4180 CSV serialisation.
 *
 * Pure and colocated with its test because the quoting rules are the whole
 * point: an app name containing a comma, a quote or a newline must survive a
 * round trip into a spreadsheet, and getting that wrong corrupts every column
 * after it rather than failing loudly.
 */

/** Fields containing a delimiter, quote or newline are quoted; quotes double. */
function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * `null` and `undefined` render as an empty field — an open-ended allocation
 * has no end date, and an empty cell says that better than the string "null".
 */
function renderCell(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : escapeField(String(value));
}

/**
 * CRLF line endings, per the RFC. Excel is the consumer that cares.
 */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  return [header, ...rows].map((row) => row.map(renderCell).join(",")).join("\r\n");
}
