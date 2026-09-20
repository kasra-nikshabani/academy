"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_AXIS, chartSlot } from "@/components/ui/chart-palette";
import { toPersianDigits } from "@/lib/utils/number";

export interface GrowthChartPoint {
  key: string;
  label: string;
  shortLabel: string;
  joined: number;
  total: number;
}

/**
 * Players on the books, month by month.
 *
 * **One series, so an area rather than a line** — the filled shape says
 * "how many there are", which is what a cumulative count means, where a bare
 * line reads as a rate.
 *
 * The axis starts at zero here, unlike the performance charts. A head count is
 * a magnitude and zero is a real, meaningful floor; a player's height is a
 * position on a scale where zero never occurs and framing at it would flatten
 * the whole subject (docs/UI_UX.md §10).
 */
export function GrowthChart({
  points,
}: {
  points: readonly GrowthChartPoint[];
}) {
  if (points.length === 0) return null;

  const color = chartSlot(0);

  return (
    <ChartContainer
      label="روند تعداد بازیکنان آکادمی در شش ماه گذشته"
      height={220}
    >
      <AreaChart
        data={[...points]}
        margin={{ top: 12, right: 4, bottom: 4, left: 28 }}
      >
        <defs>
          <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          vertical={false}
          stroke={CHART_AXIS.stroke}
          strokeDasharray="3 3"
        />
        <XAxis
          // The short name on the axis, the full one in the tooltip: six ticks
          // repeating the same year is most of an axis spent saying nothing.
          dataKey="shortLabel"
          tickLine={false}
          axisLine={{ stroke: CHART_AXIS.stroke }}
          tick={CHART_AXIS.tick}
          minTickGap={12}
        />
        <YAxis
          orientation="right"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={CHART_AXIS.tick}
          width={40}
          tickFormatter={(value: number) => toPersianDigits(value)}
        />
        <Tooltip
          cursor={{ stroke: CHART_AXIS.stroke, strokeWidth: 1 }}
          content={(props) => {
            const entry = props.payload?.[0]?.payload as
              GrowthChartPoint | undefined;
            if (!entry) return null;

            return (
              <ChartTooltipContent
                title={entry.label}
                rows={[
                  {
                    label: "کل بازیکنان",
                    value: toPersianDigits(entry.total),
                    color,
                  },
                  {
                    label: "پیوسته در این ماه",
                    value: toPersianDigits(entry.joined),
                  },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke={color}
          strokeWidth={2}
          fill="url(#growth-fill)"
          dot={{
            r: 3,
            fill: color,
            stroke: "var(--color-card)",
            strokeWidth: 2,
          }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
