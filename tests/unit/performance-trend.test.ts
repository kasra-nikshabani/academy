import { describe, expect, it } from "vitest";
import {
  buildTrend,
  buildTrends,
  formatDelta,
  formatValue,
  groupByMetric,
  personalBest,
  valueDomain,
  type Measurement,
} from "@/lib/services/performance-trend";

const day = (n: number) => new Date(Date.UTC(2026, 5, n, 6, 0));

function reading(
  metric: Measurement["metric"],
  value: number,
  n: number,
): Measurement {
  return { metric, value, measuredAt: day(n) };
}

describe("grouping readings", () => {
  it("sorts each metric oldest first, whatever order they arrived in", () => {
    const grouped = groupByMetric([
      reading("HEIGHT_CM", 172, 20),
      reading("HEIGHT_CM", 168, 1),
      reading("HEIGHT_CM", 170, 10),
    ]);

    expect(grouped.get("HEIGHT_CM")?.map((point) => point.value)).toEqual([
      168, 170, 172,
    ]);
  });

  /** So a player's card lays its tiles out the same way on every visit. */
  it("returns metrics in catalogue order, not arrival order", () => {
    const grouped = groupByMetric([
      reading("COOPER_TEST_M", 2200, 1),
      reading("HEIGHT_CM", 168, 1),
      reading("SPRINT_20M_S", 3.3, 1),
    ]);

    expect([...grouped.keys()]).toEqual([
      "HEIGHT_CM",
      "SPRINT_20M_S",
      "COOPER_TEST_M",
    ]);
  });

  it("leaves out a metric with no readings", () => {
    const grouped = groupByMetric([reading("HEIGHT_CM", 168, 1)]);
    expect(grouped.has("WEIGHT_KG")).toBe(false);
  });
});

describe("a metric's trend", () => {
  it("is null with nothing to report", () => {
    expect(buildTrend("HEIGHT_CM", [])).toBeNull();
  });

  /**
   * Not zero. A first measurement has nothing to be a change from, and drawing
   * "no change" would report a comparison the coach never made.
   */
  it("has no delta on a first reading", () => {
    const trend = buildTrend("HEIGHT_CM", [{ value: 168, measuredAt: day(1) }]);

    expect(trend?.delta).toBeNull();
    expect(trend?.improved).toBeNull();
    expect(trend?.previous).toBeNull();
  });

  it("measures the delta against the previous reading, not the first", () => {
    const trend = buildTrend("VERTICAL_JUMP_CM", [
      { value: 36, measuredAt: day(1) },
      { value: 41, measuredAt: day(10) },
      { value: 43, measuredAt: day(20) },
    ]);

    expect(trend?.latest.value).toBe(43);
    expect(trend?.delta).toBe(2);
    expect(trend?.improved).toBe(true);
  });

  it("reads a faster sprint as an improvement even though the number fell", () => {
    const trend = buildTrend("SPRINT_20M_S", [
      { value: 3.32, measuredAt: day(1) },
      { value: 3.18, measuredAt: day(20) },
    ]);

    expect(trend?.delta).toBe(-0.14);
    expect(trend?.improved).toBe(true);
  });

  it("draws no conclusion from a growing child", () => {
    const trend = buildTrend("HEIGHT_CM", [
      { value: 168, measuredAt: day(1) },
      { value: 172, measuredAt: day(20) },
    ]);

    expect(trend?.delta).toBe(4);
    expect(trend?.improved).toBeNull();
    expect(trend?.best).toBeNull();
  });

  it("rounds the delta to the metric's own precision", () => {
    const trend = buildTrend("SPRINT_20M_S", [
      { value: 3.3, measuredAt: day(1) },
      { value: 3.19, measuredAt: day(2) },
    ]);

    // 3.19 − 3.3 is −0.11000000000000032 in binary floating point.
    expect(trend?.delta).toBe(-0.11);
  });

  it("orders by date, not by the order the rows arrived", () => {
    const trend = buildTrend("COOPER_TEST_M", [
      { value: 2400, measuredAt: day(20) },
      { value: 2200, measuredAt: day(1) },
    ]);

    expect(trend?.latest.value).toBe(2400);
    expect(trend?.delta).toBe(200);
  });
});

describe("a personal best", () => {
  it("is the lowest time and the highest distance", () => {
    const times = [
      { value: 3.3, measuredAt: day(1) },
      { value: 3.18, measuredAt: day(10) },
      { value: 3.25, measuredAt: day(20) },
    ];
    expect(personalBest("SPRINT_20M_S", times)?.value).toBe(3.18);

    const distances = [
      { value: 2200, measuredAt: day(1) },
      { value: 2450, measuredAt: day(10) },
      { value: 2380, measuredAt: day(20) },
    ];
    expect(personalBest("COOPER_TEST_M", distances)?.value).toBe(2450);
  });

  /** A best height is just the newest one wearing a medal. */
  it("does not exist for a metric with no direction", () => {
    expect(
      personalBest("HEIGHT_CM", [{ value: 172, measuredAt: day(1) }]),
    ).toBeNull();
    expect(
      personalBest("WEIGHT_KG", [{ value: 55, measuredAt: day(1) }]),
    ).toBeNull();
  });

  it("is null with no readings", () => {
    expect(personalBest("SPRINT_20M_S", [])).toBeNull();
  });
});

describe("the value axis", () => {
  /**
   * A season of growth from 168 to 174 is the entire subject of the chart, and
   * a zero-based axis flattens it into a line in the top twentieth.
   */
  it("frames the data rather than starting at zero", () => {
    const [low, high] = valueDomain("HEIGHT_CM", [
      { value: 168, measuredAt: day(1) },
      { value: 174, measuredAt: day(20) },
    ]);

    expect(low).toBeGreaterThan(160);
    expect(high).toBeLessThan(180);
    expect(low).toBeLessThan(168);
    expect(high).toBeGreaterThan(174);
  });

  it("keeps a flat series looking flat", () => {
    const [low, high] = valueDomain("WEIGHT_KG", [
      { value: 55, measuredAt: day(1) },
      { value: 55, measuredAt: day(20) },
    ]);

    expect(low).toBeLessThan(55);
    expect(high).toBeGreaterThan(55);
    // A pad proportional to the value, not to a spread of zero — otherwise
    // the domain collapses and the line disappears.
    expect(high - low).toBeGreaterThan(0);
  });
});

describe("formatting", () => {
  it("writes the value with its unit at the right precision", () => {
    expect(formatValue("SPRINT_20M_S", 3.2)).toBe("3.20 ثانیه");
    expect(formatValue("COOPER_TEST_M", 2413)).toBe("2413 متر");
  });

  it("signs a delta so a gain reads as one", () => {
    expect(formatDelta("VERTICAL_JUMP_CM", 2)).toBe("+2.0");
    expect(formatDelta("SPRINT_20M_S", -0.14)).toBe("−0.14");
    expect(formatDelta("HEIGHT_CM", 0)).toBe("0.0");
  });
});

describe("building every trend at once", () => {
  it("returns one trend per metric, in catalogue order", () => {
    const trends = buildTrends([
      reading("COOPER_TEST_M", 2200, 1),
      reading("COOPER_TEST_M", 2400, 20),
      reading("HEIGHT_CM", 168, 1),
    ]);

    expect(trends.map((trend) => trend.metric)).toEqual([
      "HEIGHT_CM",
      "COOPER_TEST_M",
    ]);
    expect(trends[1]?.points).toHaveLength(2);
  });

  it("is empty for a player who has never been measured", () => {
    expect(buildTrends([])).toEqual([]);
  });
});
