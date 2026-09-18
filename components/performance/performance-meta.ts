import type { PerformanceMetric } from "@/lib/generated/prisma/enums";
import { chartSlot } from "@/components/ui/chart-palette";
import { METRIC_ORDER } from "@/lib/services/performance-metrics";

/**
 * Presentation-only facts about a metric.
 *
 * The label, the unit and the direction live in the service catalogue, because
 * they are domain knowledge and the server enforces them. What belongs here is
 * only how a metric is *painted* — and colour follows the metric, never its
 * rank in a filtered list, so a coach who narrows the page to three metrics
 * still sees the sprint in the colour the sprint has always been.
 */

const SLOT_BY_METRIC = new Map<PerformanceMetric, string>(
  METRIC_ORDER.map((metric, index) => [metric, chartSlot(index)]),
);

export function metricColor(metric: PerformanceMetric): string {
  return SLOT_BY_METRIC.get(metric) ?? chartSlot(0);
}

/**
 * How an improvement is coloured — and the thing it must never do.
 *
 * A metric with no direction gets muted ink, not green and not red. Painting a
 * growing child's height green says they are winning at being tall; painting a
 * heavier player's weight red says something worse and just as untrue.
 */
export const TREND_CLASS: Record<"UP" | "DOWN" | "FLAT", string> = {
  UP: "text-success",
  DOWN: "text-destructive",
  FLAT: "text-muted-foreground",
};

export function trendTone(improved: boolean | null): "UP" | "DOWN" | "FLAT" {
  if (improved === null) return "FLAT";
  return improved ? "UP" : "DOWN";
}

/**
 * The arrow.
 *
 * Shape as well as colour, so the direction survives a colour-blind reader, a
 * greyscale print and a forced-colors mode — colour is never the only channel
 * carrying the meaning.
 */
export function trendArrow(
  improved: boolean | null,
  delta: number | null,
): string {
  if (delta === null) return "";
  if (delta === 0) return "→";
  if (improved === null) return delta > 0 ? "↑" : "↓";
  return improved ? "▲" : "▼";
}
