import type { PerformanceMetric } from "@/lib/generated/prisma/enums";
import {
  METRIC_ORDER,
  isImprovement,
  metricDefinition,
  roundToMetric,
} from "./performance-metrics";

/**
 * Reading a set of measurements.
 *
 * Pure, because these numbers end up on a player's card and in a conversation
 * with a parent, and they should be checkable without a database.
 */

export interface Measurement {
  metric: PerformanceMetric;
  value: number;
  measuredAt: Date;
}

export interface SeriesPoint {
  value: number;
  measuredAt: Date;
}

export interface MetricTrend {
  metric: PerformanceMetric;
  points: SeriesPoint[];
  /** The most recent reading. Never null — a trend with no points is not built. */
  latest: SeriesPoint;
  /** The reading before it, or null when this is the first. */
  previous: SeriesPoint | null;
  /**
   * Change since the previous reading, at the metric's own precision. Null on
   * a first measurement, which has nothing to be a change from — not zero,
   * which would draw a "no change" a coach never reported.
   */
  delta: number | null;
  /**
   * Whether that change is progress. Null covers two different things, both of
   * which mean "draw no arrow": there is no previous reading, or the metric
   * has no better direction (height, weight).
   */
  improved: boolean | null;
  /**
   * The best reading on record, or null for a metric with no direction. A
   * personal best in height is just the most recent measurement wearing a
   * medal.
   */
  best: SeriesPoint | null;
}

/** Sorts a metric's readings oldest first. */
function sortPoints(points: readonly SeriesPoint[]): SeriesPoint[] {
  return [...points].sort(
    (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime(),
  );
}

/**
 * Groups measurements by metric, oldest first within each.
 *
 * Returned in catalogue order rather than in whatever order the rows arrived,
 * so a player's card is laid out identically on every visit.
 */
export function groupByMetric(
  measurements: readonly Measurement[],
): Map<PerformanceMetric, SeriesPoint[]> {
  const grouped = new Map<PerformanceMetric, SeriesPoint[]>();

  for (const measurement of measurements) {
    const points = grouped.get(measurement.metric) ?? [];
    points.push({
      value: measurement.value,
      measuredAt: measurement.measuredAt,
    });
    grouped.set(measurement.metric, points);
  }

  const ordered = new Map<PerformanceMetric, SeriesPoint[]>();
  for (const metric of METRIC_ORDER) {
    const points = grouped.get(metric);
    if (points && points.length > 0) ordered.set(metric, sortPoints(points));
  }
  return ordered;
}

/** The best reading, by the metric's own direction. */
export function personalBest(
  metric: PerformanceMetric,
  points: readonly SeriesPoint[],
): SeriesPoint | null {
  const { direction } = metricDefinition(metric);
  if (direction === "NONE" || points.length === 0) return null;

  return points.reduce((best, point) =>
    direction === "UP"
      ? point.value > best.value
        ? point
        : best
      : point.value < best.value
        ? point
        : best,
  );
}

/** One metric's story: where it is now, and which way it moved. */
export function buildTrend(
  metric: PerformanceMetric,
  points: readonly SeriesPoint[],
): MetricTrend | null {
  if (points.length === 0) return null;

  const sorted = sortPoints(points);
  const latest = sorted[sorted.length - 1]!;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2]! : null;

  const delta =
    previous === null
      ? null
      : roundToMetric(metric, latest.value - previous.value);

  return {
    metric,
    points: sorted,
    latest,
    previous,
    delta,
    improved: delta === null ? null : isImprovement(metric, delta),
    best: personalBest(metric, sorted),
  };
}

/** Every metric the player has a reading for, in catalogue order. */
export function buildTrends(
  measurements: readonly Measurement[],
): MetricTrend[] {
  const trends: MetricTrend[] = [];

  for (const [metric, points] of groupByMetric(measurements)) {
    const trend = buildTrend(metric, points);
    if (trend) trends.push(trend);
  }

  return trends;
}

/**
 * The domain a chart's value axis should cover.
 *
 * **Not anchored at zero.** A player's height moving from 168 to 174 over a
 * season is the whole point of the chart, and on a zero-based axis it is a
 * flat line near the top. Padding is a tenth of the spread, so a genuinely
 * flat series still reads as flat rather than as noise magnified to fill the
 * card.
 */
export function valueDomain(
  metric: PerformanceMetric,
  points: readonly SeriesPoint[],
): [number, number] {
  if (points.length === 0) return [0, 1];

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);

  if (low === high) {
    const pad = Math.abs(low) * 0.05 || 1;
    return [
      roundToMetric(metric, low - pad),
      roundToMetric(metric, high + pad),
    ];
  }

  const pad = (high - low) * 0.1;
  return [roundToMetric(metric, low - pad), roundToMetric(metric, high + pad)];
}

/**
 * Formats a value with its unit, ready to read.
 *
 * Latin digits: turning them Persian is the presentation layer's job, and
 * doing it here would make the result impossible to compare or test against a
 * number.
 */
export function formatValue(metric: PerformanceMetric, value: number): string {
  const { decimals, unit } = metricDefinition(metric);
  return `${value.toFixed(decimals)} ${unit}`;
}

/** A signed change, with an explicit `+` so a gain reads as one. */
export function formatDelta(metric: PerformanceMetric, delta: number): string {
  const { decimals } = metricDefinition(metric);
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${Math.abs(delta).toFixed(decimals)}`;
}
