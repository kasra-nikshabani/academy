"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_AXIS } from "@/components/ui/chart-palette";
import { metricColor } from "./performance-meta";
import { metricDefinition } from "@/lib/services/performance-metrics";
import { valueDomain } from "@/lib/services/performance-trend";
import { formatJalali, formatJalaliNumeric } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import type { PerformanceMetric } from "@/lib/generated/prisma/enums";

export interface PerformancePoint {
  value: number;
  measuredAt: string;
}

export interface PerformanceChartProps {
  metric: PerformanceMetric;
  points: readonly PerformancePoint[];
}

interface Datum {
  value: number;
  time: number;
  label: string;
  long: string;
}

/**
 * One metric's trend.
 *
 * **One chart per metric, never one chart for all of them.** Height is in
 * centimetres, the Cooper test in metres and the sprint in seconds; drawing
 * them together needs either one axis that means nothing or two that mean
 * different things, and a two-axis chart lets a reader infer any relationship
 * they like by choosing the scales. Six separate axes is not a compromise, it
 * is the only honest reading (docs/UI_UX.md §9).
 *
 * The value axis does not start at zero. A season of growth from 168cm to
 * 174cm is the entire subject of the chart, and on a zero-based axis it is a
 * flat line in the top twentieth of the card.
 */
export function PerformanceChart({ metric, points }: PerformanceChartProps) {
  const definition = metricDefinition(metric);
  const color = metricColor(metric);

  const data = React.useMemo<Datum[]>(
    () =>
      points.map((point) => {
        const date = new Date(point.measuredAt);
        return {
          value: point.value,
          time: date.getTime(),
          label: formatJalaliNumeric(date),
          long: formatJalali(date),
        };
      }),
    [points],
  );

  const domain = React.useMemo(
    () =>
      valueDomain(
        metric,
        points.map((point) => ({
          value: point.value,
          measuredAt: new Date(point.measuredAt),
        })),
      ),
    [metric, points],
  );

  if (data.length === 0) return null;

  const label = `${definition.label} بر حسب ${definition.unit} در طول زمان`;

  return (
    <ChartContainer label={label} height={240}>
      <LineChart
        data={data}
        // The value axis takes the right. The left margin is half a date
        // label wide, because the first point sits on the plot's left edge and
        // Recharts drops a tick it cannot draw inside the box — at 12px the
        // series silently lost the date it starts on.
        margin={{ top: 12, right: 4, bottom: 4, left: 34 }}
      >
        <CartesianGrid
          vertical={false}
          stroke={CHART_AXIS.stroke}
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: CHART_AXIS.stroke }}
          tick={CHART_AXIS.tick}
          tickFormatter={(value: string) => toPersianDigits(value)}
          minTickGap={16}
        />
        <YAxis
          // **The value axis goes on the right.** Recharts draws in SVG
          // coordinates, which do not flip under `dir="rtl"`, so the default
          // puts the scale at the far left — where a Persian reader looks
          // last. Time still runs left to right, because a timeline is not a
          // writing direction; the scale is, and it belongs where the reading
          // starts. Caught by looking at the rendered page, not by a test.
          orientation="right"
          domain={domain}
          tickLine={false}
          axisLine={false}
          tick={CHART_AXIS.tick}
          width={48}
          tickFormatter={(value: number) =>
            toPersianDigits(value.toFixed(definition.decimals))
          }
        />
        <Tooltip
          cursor={{ stroke: CHART_AXIS.stroke, strokeWidth: 1 }}
          content={(props) => {
            const entry = props.payload?.[0]?.payload as Datum | undefined;
            if (!entry) return null;

            return (
              <ChartTooltipContent
                title={toPersianDigits(entry.long)}
                rows={[
                  {
                    label: definition.label,
                    value: `${toPersianDigits(entry.value.toFixed(definition.decimals))} ${definition.unit}`,
                    color,
                  },
                ]}
              />
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          // Markers on every reading: a testing day is a real event, and the
          // count of them is information a coach reads off the line.
          dot={{
            r: 4,
            fill: color,
            stroke: "var(--color-card)",
            strokeWidth: 2,
          }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
