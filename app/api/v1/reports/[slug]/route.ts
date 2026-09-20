import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { runReport } from "@/lib/services/report.service";
import { toCsv, csvFilename } from "@/lib/reports/csv";
import {
  reportFormatSchema,
  reportQuerySchema,
  reportSlugSchema,
} from "@/lib/validation/report";
import { displayCell } from "@/lib/reports/definitions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

/**
 * GET /api/v1/reports/:slug — a report, as JSON or as a downloadable CSV.
 *
 * One route for both, because they must be the same report: a download that
 * came from a different code path than the preview is how an export ends up
 * disagreeing with the screen above it.
 */
export const GET = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { slug } = await ctx.params;
  const reportSlug = reportSlugSchema.parse(slug);

  const params = new URL(request.url).searchParams;
  const format = reportFormatSchema.parse(params.get("format") ?? undefined);
  const query = reportQuerySchema.parse({
    ...(params.get("teamId") ? { teamId: params.get("teamId") } : {}),
    ...(params.get("seasonId") ? { seasonId: params.get("seasonId") } : {}),
    ...(params.get("from") ? { from: params.get("from") } : {}),
    ...(params.get("to") ? { to: params.get("to") } : {}),
  });

  const report = await runReport(caller, reportSlug, query);

  if (format === "csv") {
    const body = toCsv(report.columns, report.rows);

    return new Response(body, {
      headers: {
        // `charset=utf-8` as well as the BOM: the header is what a browser
        // reads, the BOM is what Excel reads, and they disagree often enough
        // that both are worth stating.
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${csvFilename(report.slug, new Date())}"`,
        // A report is a snapshot of records that change; a cached copy is a
        // wrong copy, and it is one that contains other people's data.
        "cache-control": "no-store",
      },
    });
  }

  return ok(
    {
      slug: report.slug,
      title: report.title,
      description: report.description,
      scopeLabel: report.scopeLabel,
      columns: report.columns.map((column) => ({
        header: column.header,
        numeric: column.numeric ?? false,
      })),
      rows: report.rows.map((row) =>
        report.columns.map((column) => displayCell(column, row)),
      ),
    },
    { total: report.rows.length },
  );
});
