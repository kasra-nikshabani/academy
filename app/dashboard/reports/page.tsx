import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportTable } from "@/components/reports/report-table";
import { requireUser } from "@/lib/auth";
import {
  availableReports,
  listReportTeams,
  runReport,
  type ReportSlug,
} from "@/lib/services/report.service";
import { displayCell } from "@/lib/reports/definitions";
import { reportQuerySchema } from "@/lib/validation/report";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "گزارش‌ها" };
export const dynamic = "force-dynamic";

interface SearchParams {
  report?: string;
  teamId?: string;
  from?: string;
  to?: string;
}

/**
 * Reports: run one, look at it, take it away.
 *
 * Filters live in the URL (CLAUDE.md §25), which is what makes a report
 * shareable — «گزارش حضور U14 از مهر» is a link an academy manager sends to a
 * coach, and the download button is that same link with `&format=csv`.
 *
 * The preview and the file come from one definition, so what is on screen is
 * what arrives in the spreadsheet (lib/reports/definitions.ts).
 */
export default async function ReportsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const caller = await requireUser();
  const params = await props.searchParams;

  const reports = availableReports(caller);
  const teams = await listReportTeams(caller);

  const selected =
    reports.find((report) => report.slug === params.report)?.slug ??
    reports[0]?.slug;

  if (!selected) {
    return (
      <>
        <PageHeader
          title="گزارش‌ها"
          description="خروجی قابل استفاده در صفحه‌گسترده"
        />
        <EmptyState
          title="گزارشی در دسترس شما نیست"
          description="برای دیدن گزارش‌ها به مجوز مربوطه نیاز دارید."
        />
      </>
    );
  }

  const query = reportQuerySchema.parse({
    ...(params.teamId ? { teamId: params.teamId } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  });

  // A hand-edited filter must not blank the page; the message says what was
  // wrong with it.
  const report = await runReport(caller, selected as ReportSlug, query).catch(
    (error: unknown) => (error instanceof Error ? error : new Error("خطا")),
  );

  const search = new URLSearchParams();
  search.set("report", selected);
  if (params.teamId) search.set("teamId", params.teamId);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);

  const downloadHref = `/api/v1/reports/${selected}?${new URLSearchParams({
    ...Object.fromEntries(search),
    format: "csv",
  }).toString()}`;

  return (
    <>
      <PageHeader
        title="گزارش‌ها"
        description="آنچه در یک بازه اتفاق افتاده، به شکلی که بتوان بیرون برد"
      />

      <div className="flex flex-wrap gap-2">
        {reports.map((item) => {
          const href = new URLSearchParams({ report: item.slug });
          if (params.teamId) href.set("teamId", params.teamId);
          if (params.from) href.set("from", params.from);
          if (params.to) href.set("to", params.to);

          return (
            <Link
              key={item.slug}
              href={`/dashboard/reports?${href.toString()}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                item.slug === selected
                  ? "border-brand-strong bg-accent/50 font-medium"
                  : "border-border hover:bg-accent/30",
              )}
            >
              {item.title}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {report instanceof Error ? "گزارش" : report.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReportFilters
            slug={selected}
            teams={teams.map((team) => ({ id: team.id, name: team.name }))}
            teamId={params.teamId ?? ""}
            from={params.from ?? ""}
            to={params.to ?? ""}
          />

          {report instanceof Error ? (
            <p className="text-sm text-destructive">{report.message}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {report.scopeLabel}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {toPersianDigits(report.rows.length)} ردیف
                  </Badge>
                  {report.rows.length > 0 ? (
                    <Button asChild size="sm">
                      {/* A plain link, not a fetch-and-blob: the browser
                          already knows how to save a response that says it is
                          an attachment, and doing it by hand would drop the
                          filename the server chose. */}
                      <a href={downloadHref} download>
                        دریافت CSV
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>

              {report.rows.length === 0 ? (
                <EmptyState
                  title="داده‌ای در این بازه نیست"
                  description="بازه یا تیم را تغییر دهید."
                />
              ) : (
                <ReportTable
                  columns={report.columns.map((column) => ({
                    header: column.header,
                    numeric: column.numeric ?? false,
                  }))}
                  rows={report.rows.map((row) =>
                    report.columns.map((column) => displayCell(column, row)),
                  )}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
