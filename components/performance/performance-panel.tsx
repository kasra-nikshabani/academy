"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TREND_CLASS,
  metricColor,
  trendArrow,
  trendTone,
} from "./performance-meta";
import { metricDefinition } from "@/lib/services/performance-metrics";
import { formatJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import type { PerformanceMetric } from "@/lib/generated/prisma/enums";

/**
 * The chart arrives separately.
 *
 * Recharts is around 350KB, and the tiles below are what most readers came
 * for — the current number and which way it moved. Loading the library up
 * front would hold the answer behind the illustration of it. Measured: the
 * chunk is requested only once a chart is actually drawn.
 */
const PerformanceChart = dynamic(
  () => import("./performance-chart").then((mod) => mod.PerformanceChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[240px] w-full rounded-md" />,
  },
);

export interface PanelTrend {
  metric: PerformanceMetric;
  points: { value: number; measuredAt: string }[];
  latest: { value: number; measuredAt: string };
  delta: number | null;
  improved: boolean | null;
  best: { value: number; measuredAt: string } | null;
}

export interface PerformancePanelProps {
  trends: readonly PanelTrend[];
}

/**
 * A player's measurements: the current numbers, then one of them in detail.
 *
 * The tiles are the answer to the question a coach or a parent actually opens
 * this page with — *where is he now, and which way is he going* — and a tile
 * answers it in one line where a chart needs a paragraph of reading. The chart
 * is for the follow-up question, about one metric at a time.
 *
 * A single reading gets a tile and no chart. Two points joined by a line look
 * like a trend and are not one; one point is not even two.
 */
export function PerformancePanel({ trends }: PerformancePanelProps) {
  const chartable = trends.filter((trend) => trend.points.length >= 2);
  const [selected, setSelected] = React.useState<PerformanceMetric | null>(
    () => chartable[0]?.metric ?? null,
  );

  const active =
    chartable.find((trend) => trend.metric === selected) ??
    chartable[0] ??
    null;

  return (
    <div className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trends.map((trend) => {
          const definition = metricDefinition(trend.metric);
          const tone = trendTone(trend.improved);
          const hasChart = trend.points.length >= 2;
          const isActive = active?.metric === trend.metric;

          const tile = (
            <>
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ background: metricColor(trend.metric) }}
                />
                {definition.label}
              </dt>

              <dd className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums">
                  {toPersianDigits(
                    trend.latest.value.toFixed(definition.decimals),
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {definition.unit}
                </span>

                {trend.delta === null ? null : (
                  <span
                    className={cn(
                      "ms-auto text-xs font-medium tabular-nums",
                      TREND_CLASS[tone],
                    )}
                  >
                    <span aria-hidden>
                      {trendArrow(trend.improved, trend.delta)}{" "}
                    </span>
                    {toPersianDigits(
                      Math.abs(trend.delta).toFixed(definition.decimals),
                    )}
                  </span>
                )}
              </dd>

              <dd className="mt-1 text-[11px] text-muted-foreground">
                {toPersianDigits(
                  formatJalali(new Date(trend.latest.measuredAt)),
                )}
                {trend.best &&
                trend.best.measuredAt === trend.latest.measuredAt ? (
                  <span className="ms-1.5 text-success">· بهترین رکورد</span>
                ) : null}
              </dd>
            </>
          );

          const shell =
            "rounded-lg border p-3 text-start transition-colors w-full";

          return hasChart ? (
            <button
              key={trend.metric}
              type="button"
              onClick={() => setSelected(trend.metric)}
              aria-pressed={isActive}
              className={cn(
                shell,
                "cursor-pointer hover:border-brand-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isActive
                  ? "border-brand-strong bg-accent/40"
                  : "border-border bg-card",
              )}
            >
              {tile}
            </button>
          ) : (
            <div
              key={trend.metric}
              className={cn(shell, "border-border bg-card")}
            >
              {tile}
            </div>
          );
        })}
      </dl>

      {active ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-sm font-medium">
            روند {metricDefinition(active.metric).label}
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              {toPersianDigits(active.points.length)} اندازه‌گیری
            </span>
          </p>

          <PerformanceChart metric={active.metric} points={active.points} />

          {/* The same numbers as text. A chart is a convenience; the reading
              itself must be reachable without one — for a screen reader, and
              for anyone who needs the exact figure rather than its shape. */}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              نمایش جدول مقادیر
            </summary>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {[...active.points].reverse().map((point) => (
                <li
                  key={point.measuredAt}
                  className="flex items-center justify-between px-2.5 py-1.5 text-xs"
                >
                  <span className="text-muted-foreground">
                    {toPersianDigits(formatJalali(new Date(point.measuredAt)))}
                  </span>
                  <span className="font-medium tabular-nums">
                    {toPersianDigits(
                      point.value.toFixed(
                        metricDefinition(active.metric).decimals,
                      ),
                    )}{" "}
                    {metricDefinition(active.metric).unit}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </div>
  );
}
