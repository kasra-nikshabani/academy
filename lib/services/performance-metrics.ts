import type { PerformanceMetric } from "@/lib/generated/prisma/enums";

/**
 * What each metric knows about itself.
 *
 * This file is the source of truth for the performance module, in the same way
 * `lib/permissions/catalogue.ts` is for permissions: the enum names the metric,
 * and everything else about it is here, in code, once.
 *
 * Nothing in this file touches the database, so every rule it expresses — is
 * this value plausible, did the player improve, what is the unit — can be
 * checked in a unit test.
 *
 * ## Why `direction` is three-valued and not a boolean
 *
 * The obvious model is `higherIsBetter: boolean`. It is wrong twice over.
 *
 * A **sprint time** improves by going *down*. Written as a boolean with the
 * default `true`, a forgotten flag turns a tenth of a second gained into a
 * tenth of a second lost, and the arrow on the card points confidently the
 * wrong way — the worst kind of bug, because it is legible and plausible.
 *
 * **Height and weight have no better direction at all.** A fourteen-year-old
 * who grew four centimetres did not improve; he grew. Forcing growth onto a
 * good/bad axis tells a parent their child is doing well at being tall, and
 * tells a heavier player he is doing badly. `NONE` says the honest thing: here
 * is the change, draw no conclusion from its sign.
 */

/** Which way is progress — or that the question does not apply. */
export type MetricDirection = "UP" | "DOWN" | "NONE";

/**
 * What the test measures. Grouping lives here rather than in a column: it is a
 * property of the metric, and a copy per row is a copy that can disagree.
 */
export type MetricCategory =
  "ANTHROPOMETRIC" | "SPEED" | "AGILITY" | "POWER" | "ENDURANCE";

export interface MetricDefinition {
  /** Persian label, as a coach would say it. */
  label: string;
  /** Persian unit, shown beside the value and never inside it. */
  unit: string;
  category: MetricCategory;
  direction: MetricDirection;
  /**
   * The plausible range for a youth athlete. Wide on purpose — this rejects
   * typing mistakes and nonsense, not unusual results. A range narrow enough
   * to be interesting would refuse the exceptional player the academy exists
   * to find.
   */
  min: number;
  max: number;
  /** Decimal places the value is read and stored to. */
  decimals: number;
}

export const METRIC_CATEGORY_LABEL: Record<MetricCategory, string> = {
  ANTHROPOMETRIC: "پیکرسنجی",
  SPEED: "سرعت",
  AGILITY: "چابکی",
  POWER: "توان",
  ENDURANCE: "استقامت",
};

export const PERFORMANCE_METRICS: Record<PerformanceMetric, MetricDefinition> =
  {
    HEIGHT_CM: {
      label: "قد",
      unit: "سانتی‌متر",
      category: "ANTHROPOMETRIC",
      direction: "NONE",
      min: 90,
      max: 230,
      decimals: 1,
    },
    WEIGHT_KG: {
      label: "وزن",
      unit: "کیلوگرم",
      category: "ANTHROPOMETRIC",
      direction: "NONE",
      min: 20,
      max: 160,
      decimals: 1,
    },
    SPRINT_20M_S: {
      label: "سرعت ۲۰ متر",
      unit: "ثانیه",
      category: "SPEED",
      // Faster is a smaller number. The whole reason `direction` exists.
      direction: "DOWN",
      min: 2,
      max: 8,
      decimals: 2,
    },
    AGILITY_505_S: {
      label: "چابکی ۵-۰-۵",
      unit: "ثانیه",
      category: "AGILITY",
      direction: "DOWN",
      min: 1.5,
      max: 6,
      decimals: 2,
    },
    VERTICAL_JUMP_CM: {
      label: "پرش عمودی",
      unit: "سانتی‌متر",
      category: "POWER",
      direction: "UP",
      min: 5,
      max: 110,
      decimals: 1,
    },
    COOPER_TEST_M: {
      label: "تست کوپر",
      unit: "متر",
      category: "ENDURANCE",
      direction: "UP",
      min: 400,
      max: 5000,
      decimals: 0,
    },
  };

/**
 * The display order.
 *
 * Fixed, and taken from the enum rather than from whatever the database
 * returns, so a player's card lays its tiles out the same way every time and a
 * coach can find the number they want without reading the labels.
 */
export const METRIC_ORDER = Object.keys(
  PERFORMANCE_METRICS,
) as PerformanceMetric[];

export function metricDefinition(metric: PerformanceMetric): MetricDefinition {
  return PERFORMANCE_METRICS[metric];
}

export function isPerformanceMetric(value: string): value is PerformanceMetric {
  return Object.hasOwn(PERFORMANCE_METRICS, value);
}

/** Whether a reading is inside the metric's plausible range. */
export function isValueInRange(
  metric: PerformanceMetric,
  value: number,
): boolean {
  const definition = PERFORMANCE_METRICS[metric];
  return (
    Number.isFinite(value) && value >= definition.min && value <= definition.max
  );
}

/** Rounds to the metric's own precision. A Cooper test has no centimetres. */
export function roundToMetric(
  metric: PerformanceMetric,
  value: number,
): number {
  const factor = 10 ** PERFORMANCE_METRICS[metric].decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Whether a change is an improvement, or `null` when the metric has no
 * direction.
 *
 * `null` is not "no change" — it is "that question does not apply here", and
 * the two must not collapse. A card that renders `null` as a flat arrow tells
 * a parent their child's height held steady when what happened is that height
 * is not a score.
 */
export function isImprovement(
  metric: PerformanceMetric,
  delta: number,
): boolean | null {
  const { direction } = PERFORMANCE_METRICS[metric];
  if (direction === "NONE") return null;
  if (delta === 0) return false;
  return direction === "UP" ? delta > 0 : delta < 0;
}
