/**
 * RFC 4180 CSV serialisation.
 *
 * Pure and colocated with its test because the quoting rules are the whole
 * point: an app name containing a comma, a quote or a newline must survive a
 * round trip into a spreadsheet, and getting that wrong corrupts every column
 * after it rather than failing loudly.
 */

/**
 * Quoted when the field contains a quote, a newline, or any character a
 * spreadsheet might treat as a separator — comma, semicolon, tab, and space.
 *
 * Space is the one that is not required by RFC 4180 and matters most in
 * practice. Both the LibreOffice and Excel import dialogs remember their last
 * separator selection, so a file opened once with "space" ticked splits
 * "Hina Matsumoto" into two cells and slides every later column out from under
 * its header. Quoting costs two bytes and removes the whole failure mode.
 *
 * Numbers and ISO dates contain none of these and stay bare, so they import as
 * values a spreadsheet will sum rather than as text.
 */
function escapeField(value: string): string {
  return /[",;\t\r\n ]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
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
