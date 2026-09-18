"use client";

import * as React from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

/**
 * The charting surface.
 *
 * One place where Recharts is set up, so the dashboards and reports of later
 * phases inherit the same axes, the same grid weight and the same tooltip
 * rather than each rediscovering them.
 *
 * The palette itself lives in `./chart-palette`, which carries no `"use
 * client"` and no Recharts import — a Server Component that needs a swatch
 * colour must be able to have one without the charting library coming with it.
 *
 * ## RTL
 *
 * Recharts lays its axes out in SVG coordinates, which do not flip with
 * `dir="rtl"`. A time axis is therefore drawn left-to-right — and should be:
 * a Persian reader reads a timeline the same way they read a clock face, and
 * mirroring it would put last month to the right of this one. The **labels**
 * are Persian; the arrow of time is not a writing direction.
 */

export { CHART_AXIS, CHART_SLOTS, chartSlot } from "./chart-palette";

export interface ChartContainerProps extends React.ComponentProps<"figure"> {
  /** Named for screen readers, which cannot read the plot. */
  label: string;
  /** Height in pixels; the width always fills the card. */
  height?: number;
  children: React.ReactElement;
}

/**
 * Sizes a chart and names it.
 *
 * `ResponsiveContainer` needs a parent with a resolved height, which is the
 * one thing a caller forgets; putting it here means no chart is ever rendered
 * into a zero-height box and silently invisible.
 */
export function ChartContainer({
  label,
  height = 260,
  className,
  children,
  ...props
}: ChartContainerProps) {
  return (
    <figure
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label={label}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </figure>
  );
}

export interface ChartTooltipRow {
  label: string;
  value: string;
  color?: string | undefined;
}

/**
 * The tooltip body.
 *
 * Values wear text tokens rather than the series colour; the swatch beside
 * them carries the identity. Colour-as-text is the first thing to fail for a
 * reader with low vision, and it is never the only thing carrying meaning
 * here.
 */
export function ChartTooltipContent({
  title,
  rows,
}: {
  title: string;
  rows: readonly ChartTooltipRow[];
}) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.color ? (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: row.color }}
              />
            ) : null}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ms-auto font-medium text-popover-foreground tabular-nums">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
