import {
  getApp,
  getAppAllocationHistory,
  getUser,
  getUserAllocationHistory,
} from "@/data/allocation.ts";
import {
  allocationCsv,
  exportFilename,
  filterByRange,
  parseReportRange,
} from "@/lib/report.ts";

/**
 * CSV export for the §6.2 and §6.3 allocation reports (#2).
 *
 * One handler rather than one per screen: the two reports differ only in which
 * history function they call and what the file is named after. Both are
 * allocation reads — §9.2 requires the two export paths stay separate, so
 * nothing here may ever reach into `people.db`.
 *
 * A route handler rather than a server action because the browser needs a plain
 * same-origin navigation to trigger a download. The production CSP allows that;
 * a blob URL built client-side would be the thing it blocks.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope");
  const id = Number(params.get("id"));

  if ((scope !== "person" && scope !== "app") || !Number.isInteger(id) || id <= 0) {
    return new Response("Expected ?scope=person|app and a positive integer ?id", {
      status: 400,
    });
  }

  const subject = scope === "person" ? await getUser(id) : await getApp(id);
  if (!subject) return new Response("Not found", { status: 404 });

  const rows =
    scope === "person"
      ? await getUserAllocationHistory(id)
      : await getAppAllocationHistory(id);

  const range = parseReportRange({
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
  const csv = allocationCsv(filterByRange(rows, range));

  return new Response(csv, {
    headers: {
      // charset matters: names outside ASCII are common and Excel guesses badly.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(subject.name, range)}"`,
      // A report is a snapshot of a live database; never let one be reused.
      "Cache-Control": "no-store",
    },
  });
}
