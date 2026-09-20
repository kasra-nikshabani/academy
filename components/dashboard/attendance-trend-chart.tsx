"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_AXIS, chartSlot } from "@/components/ui/chart-palette";
import { toPersianDigits } from "@/lib/utils/number";

export interface TrendChartPoint {
  key: string;
  label: string;
  /** Null for a week with nothing to measure — see below. */
  rate: number | null;
  recorded: number;
}

/**
 * Attendance, week by week.
 *
 * **A week with no training is a gap in the line, not a plunge to zero.**
 * Recharts leaves a break wherever the value is `null`, which is exactly
 * right: zero means a squad was called and nobody came, null means nobody was
 * called, and a chart that draws them the same way invents a crisis out of a
 * public holiday.
 *
 * `connectNulls` is deliberately **off**. Joining across the gap would draw a
 * straight segment through a week that has no value, which looks like data and
 * is not.
 *
 * The axis is fixed to 0–100 rather than framed to the data. A rate is a share
 * of a known whole, and rescaling it makes 88% and 92% look like a cliff.
 */
export function AttendanceTrendChart({
  points,
  target = 85,
}: {
  points: readonly TrendChartPoint[];
  /** The line the club aims at, drawn for reference. */
  target?: number;
}) {
  if (points.length === 0) return null;

  const color = chartSlot(1);

  // **Two points or it is not a trend.**
  //
  // With one measured week the line has nothing to join, and Recharts draws a
  // lone 3px dot in a corner — which reads as an empty chart rather than as a
  // single reading. The caller shows the figure as text instead. Same rule as
  // the performance panel in Phase 14, found the same way: by looking at it.
  const measured = points.filter((point) => point.rate !== null);
  if (measured.length < 2) return null;

  return (
    <ChartContainer label="روند نرخ حضور در هشت هفته گذشته" height={220}>
      <LineChart
        data={[...points]}
        margin={{ top: 12, right: 4, bottom: 4, left: 28 }}
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
          minTickGap={12}
          tickFormatter={(value: string) => toPersianDigits(value)}
        />
        <YAxis
          orientation="right"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickLine={false}
          axisLine={false}
          tick={CHART_AXIS.tick}
          width={40}
          tickFormatter={(value: number) => `${toPersianDigits(value)}٪`}
        />

        <ReferenceLine
          y={target}
          stroke={CHART_AXIS.stroke}
          strokeDasharray="4 4"
        />

        <Tooltip
          cursor={{ stroke: CHART_AXIS.stroke, strokeWidth: 1 }}
          content={(props) => {
            const entry = props.payload?.[0]?.payload as
              TrendChartPoint | undefined;
            if (!entry) return null;

            return (
              <ChartTooltipContent
                title={toPersianDigits(entry.label)}
                rows={[
                  {
                    label: "نرخ حضور",
                    value:
                      entry.rate === null
                        ? "تمرینی ثبت نشده"
                        : `${toPersianDigits(entry.rate)}٪`,
                    color,
                  },
                  {
                    label: "ردیف ثبت‌شده",
                    value: toPersianDigits(entry.recorded),
                  },
                ]}
              />
            );
          }}
        />

        <Line
          type="monotone"
          dataKey="rate"
          stroke={color}
          strokeWidth={2}
          connectNulls={false}
          dot={{
            r: 3,
            fill: color,
            stroke: "var(--color-card)",
            strokeWidth: 2,
          }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
