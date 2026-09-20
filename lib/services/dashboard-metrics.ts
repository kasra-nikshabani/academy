import {
  JALALI_MONTH_NAMES,
  addJalaliMonths,
  fromJalali,
  toJalali,
} from "@/lib/utils/date";

/**
 * The arithmetic behind the dashboard.
 *
 * Pure, because these are the numbers a manager makes decisions on and quotes
 * in a meeting, and they should be checkable without a database.
 *
 * ## The rule this module is built around
 *
 * **A gap is not a zero.**
 *
 * A week with no training is not a week of 0% attendance. A month before the
 * academy existed is not a month with no players. Drawing either as zero
 * produces a chart that is confidently wrong in exactly the places a reader
 * looks hardest — the dips. Every series here can say "no answer here" with
 * `null`, and the chart leaves a gap rather than a plunge to the floor.
 *
 * This is the same rule as `attendanceRate` returning `null` (Phase 9) and
 * `improved` returning `null` for height (Phase 14). It keeps arriving because
 * it keeps being true.
 */

// --- growth -----------------------------------------------------------------

export interface MonthBucket {
  /** Jalali year and month, which is how the academy counts a season. */
  jy: number;
  jm: number;
  /** `1405/06` — sortable, and the key a query result is matched on. */
  key: string;
  /** `شهریور ۱۴۰۵` — the full name, for a tooltip. */
  label: string;
  /**
   * `شهریور` — the axis tick.
   *
   * Without the year, because six ticks reading «… ۱۴۰۵» five times over spend
   * most of the axis repeating something the reader already knows. The
   * tooltip carries the year for the one point being looked at.
   */
  shortLabel: string;
  /** Start of the month, UTC, for querying. */
  startsAt: Date;
  /** Start of the next month — an exclusive upper bound. */
  endsAt: Date;
}

/**
 * The last `count` Jalali months, oldest first, ending with the one containing
 * `reference`.
 *
 * Jalali rather than Gregorian because a season runs Mehr to Khordad and a
 * chart bucketed by Gregorian months would cut every one of them in half.
 */
export function recentMonths(reference: Date, count: number): MonthBucket[] {
  const { jy, jm } = toJalali(reference);
  const buckets: MonthBucket[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const month = addJalaliMonths(jy, jm, -offset);
    const next = addJalaliMonths(month.jy, month.jm, 1);

    buckets.push({
      jy: month.jy,
      jm: month.jm,
      key: `${month.jy}/${String(month.jm).padStart(2, "0")}`,
      label: `${JALALI_MONTH_NAMES[month.jm - 1]} ${month.jy}`,
      shortLabel: `${JALALI_MONTH_NAMES[month.jm - 1]}`,
      startsAt: fromJalali(month.jy, month.jm, 1),
      endsAt: fromJalali(next.jy, next.jm, 1),
    });
  }

  return buckets;
}

export interface GrowthPoint {
  key: string;
  label: string;
  shortLabel: string;
  /** Players who joined during this month. */
  joined: number;
  /** Everyone on the books at the end of it. */
  total: number;
}

/**
 * Cumulative player growth.
 *
 * Takes the count already on the books before the window opens, so a chart of
 * the last six months does not start from zero and imply the academy was empty
 * in Farvardin.
 */
export function growthSeries(
  months: readonly MonthBucket[],
  joinedPerMonth: ReadonlyMap<string, number>,
  startingTotal: number,
): GrowthPoint[] {
  let running = startingTotal;

  return months.map((month) => {
    const joined = joinedPerMonth.get(month.key) ?? 0;
    running += joined;
    return {
      key: month.key,
      label: month.label,
      shortLabel: month.shortLabel,
      joined,
      total: running,
    };
  });
}

// --- distribution -----------------------------------------------------------

export interface DistributionSlice {
  label: string;
  value: number;
  /** Share of the whole, 0–100, to one decimal. */
  share: number;
}

/**
 * Shares of a whole, largest first.
 *
 * Returns an empty list when there is nothing to divide, rather than a set of
 * `NaN` shares or a single 100% slice of nothing.
 */
export function distribution(
  entries: readonly { label: string; value: number }[],
): DistributionSlice[] {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (total === 0) return [];

  return entries
    .filter((entry) => entry.value > 0)
    .map((entry) => ({
      label: entry.label,
      value: entry.value,
      share: Math.round((entry.value / total) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value);
}

// --- attendance trend -------------------------------------------------------

export interface TrendPoint {
  key: string;
  label: string;
  /**
   * The rate, 0–100, or **null for a period with nothing to measure**.
   *
   * Null and zero are different facts and a chart must not merge them: zero
   * means a squad was called and nobody came, null means nobody was called.
   */
  rate: number | null;
  /** Rows the rate was computed from — what makes a thin week visible. */
  recorded: number;
}

export interface PeriodTotals {
  present: number;
  late: number;
  absent: number;
}

/**
 * Attendance per period.
 *
 * The rate is computed the same way as everywhere else in the system: an
 * excused absence leaves the denominator entirely (docs/BUSINESS_RULES.md
 * §14). Reimplementing it here with a different denominator would give a
 * manager a figure that disagrees with the one on a player's own record.
 */
export function attendanceTrend(
  periods: readonly { key: string; label: string }[],
  totalsPerPeriod: ReadonlyMap<string, PeriodTotals>,
): TrendPoint[] {
  return periods.map((period) => {
    const totals = totalsPerPeriod.get(period.key);
    const counted = totals ? totals.present + totals.late + totals.absent : 0;

    return {
      key: period.key,
      label: period.label,
      rate:
        counted === 0
          ? null
          : Math.round(((totals!.present + totals!.late) / counted) * 100),
      recorded: counted,
    };
  });
}

/**
 * The headline rate across every period that had one.
 *
 * Computed from the pooled totals, not as an average of the per-period rates:
 * a week with three rows and a week with ninety do not carry equal weight, and
 * averaging the percentages would let one thin week move the academy's figure
 * as much as a full one.
 */
export function overallRate(
  totalsPerPeriod: Iterable<PeriodTotals>,
): number | null {
  let present = 0;
  let late = 0;
  let absent = 0;

  for (const totals of totalsPerPeriod) {
    present += totals.present;
    late += totals.late;
    absent += totals.absent;
  }

  const counted = present + late + absent;
  if (counted === 0) return null;
  return Math.round(((present + late) / counted) * 100);
}

// --- alerts -----------------------------------------------------------------

export type AlertTone = "WARNING" | "INFO";

export interface DashboardAlert {
  key: string;
  tone: AlertTone;
  title: string;
  count: number;
  href: string;
}

export interface AlertInput {
  /** Sessions whose time has passed but whose register was never taken. */
  sessionsWithoutRegister: number;
  /** Applications still waiting on the paperwork check. */
  pendingScreening: number;
  /** Evaluations assigned and not submitted. */
  unfinishedEvaluations: number;
  /** Accepted without an evaluation on file — a decision with no record why. */
  acceptedWithoutEvaluation: number;
  /** Trials open with the closing date already past. */
  overdueTryouts: number;
}

/**
 * What needs doing, worst first.
 *
 * **Only things a person can act on**, and only when the count is above zero.
 * A dashboard that always shows five alert cards, three of them reading
 * "۰ مورد", teaches its reader to stop looking at the alerts — which costs
 * exactly the one time it mattered.
 */
export function buildAlerts(input: AlertInput): DashboardAlert[] {
  const candidates: DashboardAlert[] = [
    {
      key: "sessionsWithoutRegister",
      tone: "WARNING",
      title: "جلسه تمرین بدون حضور و غیاب",
      count: input.sessionsWithoutRegister,
      href: "/dashboard/training",
    },
    {
      key: "acceptedWithoutEvaluation",
      tone: "WARNING",
      title: "پذیرش بدون ارزیابی ثبت‌شده",
      count: input.acceptedWithoutEvaluation,
      href: "/dashboard/talent",
    },
    {
      key: "overdueTryouts",
      tone: "WARNING",
      title: "استعدادیابی باز با مهلت گذشته",
      count: input.overdueTryouts,
      href: "/dashboard/tryouts",
    },
    {
      key: "pendingScreening",
      tone: "INFO",
      title: "درخواست در انتظار غربالگری",
      count: input.pendingScreening,
      href: "/dashboard/talent",
    },
    {
      key: "unfinishedEvaluations",
      tone: "INFO",
      title: "ارزیابی تکمیل‌نشده",
      count: input.unfinishedEvaluations,
      href: "/dashboard/evaluations",
    },
  ];

  return candidates
    .filter((alert) => alert.count > 0)
    .sort((a, b) => {
      if (a.tone !== b.tone) return a.tone === "WARNING" ? -1 : 1;
      return b.count - a.count;
    });
}
