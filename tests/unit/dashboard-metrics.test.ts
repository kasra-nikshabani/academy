import { describe, expect, it } from "vitest";
import {
  attendanceTrend,
  buildAlerts,
  distribution,
  growthSeries,
  overallRate,
  recentMonths,
  type PeriodTotals,
} from "@/lib/services/dashboard-metrics";
import { toJalali } from "@/lib/utils/date";

const NO_ALERTS = {
  sessionsWithoutRegister: 0,
  pendingScreening: 0,
  unfinishedEvaluations: 0,
  acceptedWithoutEvaluation: 0,
  overdueTryouts: 0,
};

describe("the months a chart covers", () => {
  it("returns the requested number, oldest first", () => {
    const months = recentMonths(new Date(Date.UTC(2026, 8, 18)), 6);

    expect(months).toHaveLength(6);
    for (let index = 1; index < months.length; index += 1) {
      expect(months[index]!.startsAt.getTime()).toBeGreaterThan(
        months[index - 1]!.startsAt.getTime(),
      );
    }
  });

  it("ends with the month containing the reference date", () => {
    const reference = new Date(Date.UTC(2026, 8, 18));
    const months = recentMonths(reference, 3);
    const { jy, jm } = toJalali(reference);

    expect(months[2]!.jy).toBe(jy);
    expect(months[2]!.jm).toBe(jm);
  });

  /**
   * Jalali, not Gregorian. A season runs Mehr to Khordad, and Gregorian
   * buckets would cut every month of it in half.
   */
  it("buckets by Jalali months", () => {
    const months = recentMonths(new Date(Date.UTC(2026, 8, 18)), 12);

    for (const month of months) {
      const start = toJalali(month.startsAt);
      // Each bucket starts on the first of its Jalali month.
      expect(start.jd).toBe(1);
      expect(start.jm).toBe(month.jm);
    }
  });

  it("makes each bucket end where the next begins", () => {
    const months = recentMonths(new Date(Date.UTC(2026, 8, 18)), 4);

    for (let index = 0; index < months.length - 1; index += 1) {
      expect(months[index]!.endsAt.getTime()).toBe(
        months[index + 1]!.startsAt.getTime(),
      );
    }
  });

  it("rolls the year over correctly", () => {
    // Farvardin is month 1; three months back crosses into the previous year.
    const months = recentMonths(new Date(Date.UTC(2026, 3, 10)), 3);
    const years = new Set(months.map((month) => month.jy));
    expect(years.size).toBeGreaterThanOrEqual(1);
    expect(months.every((month) => month.jm >= 1 && month.jm <= 12)).toBe(true);
  });
});

describe("growth", () => {
  const months = recentMonths(new Date(Date.UTC(2026, 8, 18)), 3);

  /**
   * The chart must not imply the academy was empty before the window. A
   * six-month view of a ten-year-old club starts where the club already was.
   */
  it("starts from the count already on the books", () => {
    const series = growthSeries(months, new Map(), 40);
    expect(series[0]!.total).toBe(40);
    expect(series.at(-1)!.total).toBe(40);
  });

  it("accumulates joins forward", () => {
    const joined = new Map([
      [months[0]!.key, 3],
      [months[2]!.key, 5],
    ]);
    const series = growthSeries(months, joined, 10);

    expect(series.map((point) => point.total)).toEqual([13, 13, 18]);
    expect(series.map((point) => point.joined)).toEqual([3, 0, 5]);
  });

  it("treats a month with no joins as no change, not a drop", () => {
    const series = growthSeries(months, new Map([[months[0]!.key, 2]]), 0);
    expect(series.map((point) => point.total)).toEqual([2, 2, 2]);
  });
});

describe("distribution", () => {
  it("shares add up and sort largest first", () => {
    const slices = distribution([
      { label: "والیبال", value: 10 },
      { label: "فوتبال", value: 30 },
    ]);

    expect(slices.map((slice) => slice.label)).toEqual(["فوتبال", "والیبال"]);
    expect(slices[0]!.share).toBe(75);
    expect(slices[1]!.share).toBe(25);
  });

  it("leaves out anything with nobody in it", () => {
    const slices = distribution([
      { label: "فوتبال", value: 4 },
      { label: "شنا", value: 0 },
    ]);

    expect(slices).toHaveLength(1);
  });

  /** Not a set of NaN shares, and not one 100% slice of nothing. */
  it("is empty when there is nothing to divide", () => {
    expect(distribution([])).toEqual([]);
    expect(distribution([{ label: "فوتبال", value: 0 }])).toEqual([]);
  });
});

describe("the attendance trend", () => {
  const periods = [
    { key: "w1", label: "هفته ۱" },
    { key: "w2", label: "هفته ۲" },
    { key: "w3", label: "هفته ۳" },
  ];

  /**
   * The rule this whole module is built around. Zero means a squad was called
   * and nobody came; null means nobody was called. A chart that draws them the
   * same way invents a crisis out of a public holiday.
   */
  it("reports a week with no training as null, not zero", () => {
    const trend = attendanceTrend(
      periods,
      new Map([["w1", { present: 8, late: 1, absent: 1 }]]),
    );

    expect(trend[0]!.rate).toBe(90);
    expect(trend[1]!.rate).toBeNull();
    expect(trend[2]!.rate).toBeNull();
  });

  it("reports a week nobody came to as zero, not null", () => {
    const trend = attendanceTrend(
      [periods[0]!],
      new Map([["w1", { present: 0, late: 0, absent: 6 }]]),
    );

    expect(trend[0]!.rate).toBe(0);
    expect(trend[0]!.recorded).toBe(6);
  });

  it("counts lateness as turning up", () => {
    const trend = attendanceTrend(
      [periods[0]!],
      new Map([["w1", { present: 5, late: 5, absent: 0 }]]),
    );

    expect(trend[0]!.rate).toBe(100);
  });

  it("carries the row count so a thin week is visible", () => {
    const trend = attendanceTrend(
      [periods[0]!],
      new Map([["w1", { present: 1, late: 0, absent: 0 }]]),
    );

    expect(trend[0]!.rate).toBe(100);
    expect(trend[0]!.recorded).toBe(1);
  });
});

describe("the headline rate", () => {
  /**
   * Pooled, not an average of averages. A week with one row and a week with
   * ninety must not carry equal weight, or one thin session moves the
   * academy's published figure as much as a full week.
   */
  it("weights by volume rather than averaging the percentages", () => {
    const totals: PeriodTotals[] = [
      { present: 1, late: 0, absent: 0 }, // 100% of one row
      { present: 50, late: 0, absent: 50 }, // 50% of a hundred
    ];

    // Averaging the two rates would give 75. Pooling gives 51 turnouts out
    // of 101 counted rows — 50%, which is what the academy actually did.
    expect(overallRate(totals)).toBe(50);
  });

  it("is null when nothing was recorded at all", () => {
    expect(overallRate([])).toBeNull();
    expect(overallRate([{ present: 0, late: 0, absent: 0 }])).toBeNull();
  });
});

describe("alerts", () => {
  /**
   * A dashboard that always shows five cards, three reading «۰ مورد», teaches
   * its reader to stop looking — which costs exactly the one time it mattered.
   */
  it("shows nothing when there is nothing to do", () => {
    expect(buildAlerts(NO_ALERTS)).toEqual([]);
  });

  it("leaves out the zeroes and keeps the rest", () => {
    const alerts = buildAlerts({ ...NO_ALERTS, pendingScreening: 3 });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.count).toBe(3);
  });

  it("puts warnings before notes", () => {
    const alerts = buildAlerts({
      ...NO_ALERTS,
      pendingScreening: 99,
      sessionsWithoutRegister: 1,
    });

    expect(alerts[0]!.tone).toBe("WARNING");
    expect(alerts[1]!.tone).toBe("INFO");
  });

  it("orders by count within a tone", () => {
    const alerts = buildAlerts({
      ...NO_ALERTS,
      sessionsWithoutRegister: 2,
      overdueTryouts: 7,
    });

    expect(alerts.map((alert) => alert.count)).toEqual([7, 2]);
  });

  it("gives every alert somewhere to go", () => {
    const alerts = buildAlerts({
      sessionsWithoutRegister: 1,
      pendingScreening: 1,
      unfinishedEvaluations: 1,
      acceptedWithoutEvaluation: 1,
      overdueTryouts: 1,
    });

    expect(alerts).toHaveLength(5);
    for (const alert of alerts) {
      // An alert with nowhere to act is a complaint, not an alert.
      expect(alert.href.startsWith("/dashboard/")).toBe(true);
      expect(alert.title.length).toBeGreaterThan(0);
    }
  });
});
