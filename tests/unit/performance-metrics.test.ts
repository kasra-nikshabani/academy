import { describe, expect, it } from "vitest";
import {
  METRIC_ORDER,
  PERFORMANCE_METRICS,
  isImprovement,
  isPerformanceMetric,
  isValueInRange,
  metricDefinition,
  roundToMetric,
} from "@/lib/services/performance-metrics";
import { metricColor } from "@/components/performance/performance-meta";

describe("the metric catalogue", () => {
  it("defines every metric the enum names", () => {
    expect(METRIC_ORDER).toHaveLength(6);
    for (const metric of METRIC_ORDER) {
      expect(metricDefinition(metric).label.length).toBeGreaterThan(0);
      expect(metricDefinition(metric).unit.length).toBeGreaterThan(0);
    }
  });

  it("gives every metric a plausible range", () => {
    for (const [metric, definition] of Object.entries(PERFORMANCE_METRICS)) {
      expect(definition.min, metric).toBeLessThan(definition.max);
      expect(definition.min, metric).toBeGreaterThan(0);
    }
  });

  it("rejects a name that is not a metric", () => {
    expect(isPerformanceMetric("HEIGHT_CM")).toBe(true);
    expect(isPerformanceMetric("FAVOURITE_COLOUR")).toBe(false);
    // `Object.hasOwn`, not `in` — a prototype key is not a metric.
    expect(isPerformanceMetric("toString")).toBe(false);
  });
});

describe("range checking, per metric", () => {
  /**
   * The reason the range lives on the metric and not on the schema: each of
   * these is nonsense, and no single numeric bound calls all of them out.
   */
  it("refuses values that are impossible for that test", () => {
    expect(isValueInRange("SPRINT_20M_S", 45)).toBe(false);
    expect(isValueInRange("COOPER_TEST_M", 4)).toBe(false);
    expect(isValueInRange("HEIGHT_CM", 12)).toBe(false);
    expect(isValueInRange("VERTICAL_JUMP_CM", 400)).toBe(false);
  });

  it("accepts an exceptional but real result", () => {
    // Wide on purpose: a range narrow enough to be interesting would refuse
    // the outlier the academy exists to find.
    expect(isValueInRange("SPRINT_20M_S", 2.4)).toBe(true);
    expect(isValueInRange("COOPER_TEST_M", 3400)).toBe(true);
  });

  it("refuses a value that is not a number at all", () => {
    expect(isValueInRange("HEIGHT_CM", Number.NaN)).toBe(false);
    expect(isValueInRange("HEIGHT_CM", Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("includes both ends of the range", () => {
    const { min, max } = metricDefinition("WEIGHT_KG");
    expect(isValueInRange("WEIGHT_KG", min)).toBe(true);
    expect(isValueInRange("WEIGHT_KG", max)).toBe(true);
  });
});

describe("rounding to the metric's own precision", () => {
  it("reads a Cooper test in whole metres and a sprint in hundredths", () => {
    expect(roundToMetric("COOPER_TEST_M", 2412.6)).toBe(2413);
    expect(roundToMetric("SPRINT_20M_S", 3.2849)).toBe(3.28);
    expect(roundToMetric("HEIGHT_CM", 172.34)).toBe(172.3);
  });
});

describe("which way is progress", () => {
  /** The defect a boolean `higherIsBetter` would have shipped. */
  it("treats a falling sprint time as an improvement", () => {
    expect(isImprovement("SPRINT_20M_S", -0.12)).toBe(true);
    expect(isImprovement("SPRINT_20M_S", 0.12)).toBe(false);
    expect(isImprovement("AGILITY_505_S", -0.05)).toBe(true);
  });

  it("treats a rising jump and a longer Cooper as improvements", () => {
    expect(isImprovement("VERTICAL_JUMP_CM", 2)).toBe(true);
    expect(isImprovement("VERTICAL_JUMP_CM", -2)).toBe(false);
    expect(isImprovement("COOPER_TEST_M", 120)).toBe(true);
  });

  /**
   * Growth is not a score. `null` is not "no change" — it is "that question
   * does not apply", and a card that collapsed the two would tell a parent
   * their child is doing well at being tall.
   */
  it("has no opinion about height or weight", () => {
    expect(isImprovement("HEIGHT_CM", 4)).toBeNull();
    expect(isImprovement("HEIGHT_CM", -4)).toBeNull();
    expect(isImprovement("WEIGHT_KG", 3)).toBeNull();
  });

  it("does not call standing still an improvement", () => {
    expect(isImprovement("SPRINT_20M_S", 0)).toBe(false);
    expect(isImprovement("COOPER_TEST_M", 0)).toBe(false);
  });
});

describe("the colour each metric is painted", () => {
  /**
   * The defect this test exists for: `chartSlot` repeats slot 1 past the end
   * of the palette rather than failing, so six metrics against five slots gave
   * قد and تست کوپر the same swatch. Nothing threw, nothing logged, and the
   * squad table quietly labelled two columns with one colour.
   */
  it("gives every metric a colour of its own", () => {
    const colors = METRIC_ORDER.map((metric) => metricColor(metric));
    expect(new Set(colors).size).toBe(METRIC_ORDER.length);
  });

  it("does not depend on how many metrics are being shown", () => {
    // Colour follows the metric, never its rank in a filtered list: narrowing
    // the page to three metrics must not repaint the survivors.
    const before = metricColor("COOPER_TEST_M");
    const subset = ["SPRINT_20M_S", "COOPER_TEST_M"] as const;
    expect(subset.map(metricColor)[1]).toBe(before);
  });
});
