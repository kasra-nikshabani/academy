import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { requireUser } from "@/lib/auth";
import {
  getPerformanceLanding,
  getSquadPerformance,
} from "@/lib/services/performance.service";
import {
  METRIC_ORDER,
  metricDefinition,
} from "@/lib/services/performance-metrics";
import { metricColor } from "@/components/performance/performance-meta";
import { formatJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "عملکرد" };
export const dynamic = "force-dynamic";

interface SearchParams {
  teamId?: string;
}

/**
 * The squad's numbers.
 *
 * The team lives in the URL rather than in component state (CLAUDE.md §25),
 * so a coach can send «وضعیت آمادگی U16» as a link.
 *
 * Every player in the squad gets a row, measured or not. The blanks are the
 * point: they are the list of who still has to be tested, and a table that
 * quietly dropped them would hide exactly what a coach opens this page to
 * find.
 */
export default async function PerformancePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const caller = await requireUser();
  const { teamId } = await props.searchParams;

  const { teams, ownPlayers } = await getPerformanceLanding(caller);
  const selected = teamId ?? teams[0]?.id ?? null;

  const rows = selected
    ? await getSquadPerformance(caller, selected).catch(() => [])
    : [];

  // A player or a parent has no squad to inspect, and an empty table would
  // read as a permission failure. Point them at the record they came for.
  if (teams.length === 0) {
    return (
      <>
        <PageHeader
          title="عملکرد"
          description="اندازه‌گیری‌های بدنی و روند آن‌ها"
        />

        {ownPlayers.length === 0 ? (
          <EmptyState
            title="رکورد عملکردی در دسترس نیست"
            description="هنوز بازیکنی به حساب شما متصل نشده است."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">پرونده‌های شما</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {ownPlayers.map((player) => (
                  <li key={player.id}>
                    <Link
                      href={`/dashboard/people/players/${player.id}`}
                      className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent/50"
                    >
                      <span className="font-medium">
                        {player.firstName} {player.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        مشاهده روند عملکرد
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  const measured = rows.filter(
    (row) => Object.keys(row.latest).length > 0,
  ).length;

  return (
    <>
      <PageHeader
        title="عملکرد"
        description="آخرین اندازه‌گیری هر بازیکن؛ برای دیدن روند، پرونده بازیکن را باز کنید"
        actions={
          <Badge variant="secondary">
            {toPersianDigits(measured)} از {toPersianDigits(rows.length)}{" "}
            اندازه‌گیری‌شده
          </Badge>
        }
      />

      {teams.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/dashboard/performance?teamId=${team.id}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                team.id === selected
                  ? "border-brand-strong bg-accent/50 font-medium"
                  : "border-border hover:bg-accent/30",
              )}
            >
              {team.name}
            </Link>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="بازیکنی در این تیم نیست"
          description="برای ثبت اندازه‌گیری، ابتدا بازیکنان را به تیم اضافه کنید."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Wide table, narrow phone: the table scrolls inside its own box
                rather than pushing the page sideways. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="p-3 text-start font-medium">بازیکن</th>
                    {METRIC_ORDER.map((metric) => {
                      const definition = metricDefinition(metric);
                      return (
                        <th
                          key={metric}
                          className="p-3 text-center font-medium whitespace-nowrap"
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-[2px]"
                              style={{ background: metricColor(metric) }}
                            />
                            {definition.label}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.playerId}
                      className="border-b border-border last:border-0 hover:bg-accent/30"
                    >
                      <td className="p-3">
                        <Link
                          href={`/dashboard/people/players/${row.playerId}`}
                          className="font-medium hover:underline"
                        >
                          {row.jerseyNumber ? (
                            <span className="me-2 text-muted-foreground tabular-nums">
                              {toPersianDigits(row.jerseyNumber)}
                            </span>
                          ) : null}
                          {row.firstName} {row.lastName}
                        </Link>
                      </td>

                      {METRIC_ORDER.map((metric) => {
                        const definition = metricDefinition(metric);
                        const reading = row.latest[metric];

                        return (
                          <td
                            key={metric}
                            className="p-3 text-center tabular-nums"
                          >
                            {reading ? (
                              <>
                                <span className="font-medium">
                                  {toPersianDigits(
                                    reading.value.toFixed(definition.decimals),
                                  )}
                                </span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {toPersianDigits(
                                    formatJalali(reading.measuredAt),
                                  )}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
