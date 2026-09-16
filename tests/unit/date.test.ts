import { describe, expect, it } from "vitest";
import {
  ACADEMY_TIME_ZONE,
  addDays,
  addJalaliMonths,
  formatJalali,
  formatJalaliLong,
  formatJalaliNumeric,
  fromJalali,
  getJalaliMonthGrid,
  iranianWeekday,
  isJalaliLeapYear,
  isSameJalaliDay,
  isValidJalaliDate,
  jalaliMonthLength,
  formatTime,
  startOfDay,
  startOfWeek,
  toJalali,
  weekDays,
} from "@/lib/utils/date";

describe("Jalali conversion", () => {
  it("converts known anchor dates", () => {
    // Nowruz — the Persian new year always falls on 20/21 March.
    expect(toJalali(new Date("2026-03-21T09:00:00Z"))).toEqual({
      jy: 1405,
      jm: 1,
      jd: 1,
    });
    expect(toJalali(new Date("2025-03-21T09:00:00Z"))).toEqual({
      jy: 1404,
      jm: 1,
      jd: 1,
    });
    expect(toJalali(new Date("2026-09-15T09:00:00Z"))).toEqual({
      jy: 1405,
      jm: 6,
      jd: 24,
    });
  });

  it("round-trips Jalali → Date → Jalali", () => {
    for (let jy = 1350; jy <= 1420; jy += 7) {
      for (let jm = 1; jm <= 12; jm++) {
        for (const jd of [1, 15, jalaliMonthLength(jy, jm)]) {
          expect(toJalali(fromJalali(jy, jm, jd))).toEqual({ jy, jm, jd });
        }
      }
    }
  });

  /**
   * jalaali-js (Borkowski) and the ICU `persian` calendar use different
   * leap-year rules beyond Jalali 1634. Inside the range this product cares
   * about they must agree exactly — if they ever drift, this fails.
   */
  it("agrees with the platform Intl Persian calendar", () => {
    const intl = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      timeZone: ACADEMY_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const start = Date.UTC(1960, 0, 1, 9);
    const dayMs = 24 * 60 * 60 * 1000;

    for (let index = 0; index < 900; index++) {
      const date = new Date(start + index * 37 * dayMs);
      const parts = Object.fromEntries(
        intl.formatToParts(date).map((part) => [part.type, part.value]),
      );

      expect(toJalali(date)).toEqual({
        jy: Number(parts["year"]),
        jm: Number(parts["month"]),
        jd: Number(parts["day"]),
      });
    }
  });

  it("keeps a date-only value stable across the day", () => {
    // A birth date must not slide to the previous day near midnight.
    const birthDate = fromJalali(1390, 5, 12);
    expect(toJalali(birthDate)).toEqual({ jy: 1390, jm: 5, jd: 12 });
    expect(toJalali(new Date(birthDate.getTime() - 6 * 3600 * 1000))).toEqual({
      jy: 1390,
      jm: 5,
      jd: 12,
    });
    expect(toJalali(new Date(birthDate.getTime() + 6 * 3600 * 1000))).toEqual({
      jy: 1390,
      jm: 5,
      jd: 12,
    });
  });
});

describe("Jalali month facts", () => {
  it("knows month lengths", () => {
    expect(jalaliMonthLength(1405, 1)).toBe(31); // فروردین
    expect(jalaliMonthLength(1405, 7)).toBe(30); // مهر
    expect(jalaliMonthLength(1403, 12)).toBe(30); // اسفند in a leap year
    expect(jalaliMonthLength(1404, 12)).toBe(29);
  });

  it("identifies leap years", () => {
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(isJalaliLeapYear(1404)).toBe(false);
  });

  it("validates dates", () => {
    expect(isValidJalaliDate(1405, 6, 31)).toBe(true); // months 1–6 have 31
    expect(isValidJalaliDate(1405, 7, 31)).toBe(false); // months 7–11 have 30
    expect(isValidJalaliDate(1404, 12, 30)).toBe(false); // not a leap year
    expect(isValidJalaliDate(1403, 12, 30)).toBe(true);
  });

  it("adds months across year boundaries", () => {
    expect(addJalaliMonths(1405, 12, 1)).toEqual({ jy: 1406, jm: 1 });
    expect(addJalaliMonths(1405, 1, -1)).toEqual({ jy: 1404, jm: 12 });
    expect(addJalaliMonths(1405, 6, 12)).toEqual({ jy: 1406, jm: 6 });
  });
});

describe("calendar grid", () => {
  it("returns six Saturday-first weeks", () => {
    const grid = getJalaliMonthGrid(1405, 6);

    expect(grid).toHaveLength(6);
    for (const week of grid) expect(week).toHaveLength(7);

    // Every first column must be a Saturday — the Iranian week start.
    for (const week of grid) {
      expect(iranianWeekday(week[0]!.date)).toBe(0);
    }
  });

  it("marks the days borrowed from neighbouring months", () => {
    const grid = getJalaliMonthGrid(1405, 6);
    const cells = grid.flat();
    const current = cells.filter((cell) => cell.isCurrentMonth);

    expect(current).toHaveLength(jalaliMonthLength(1405, 6));
    expect(current[0]!.jalali).toEqual({ jy: 1405, jm: 6, jd: 1 });
    expect(current.every((cell) => cell.jalali.jm === 6)).toBe(true);
  });

  it("produces consecutive days with no gaps", () => {
    const cells = getJalaliMonthGrid(1405, 1).flat();

    for (let index = 1; index < cells.length; index++) {
      const gap =
        cells[index]!.date.getTime() - cells[index - 1]!.date.getTime();
      expect(gap).toBe(24 * 60 * 60 * 1000);
    }
  });
});

describe("formatting", () => {
  it("renders Persian month names", () => {
    expect(formatJalali(new Date("2026-09-15T09:00:00Z"))).toContain("شهریور");
  });

  /**
   * This exact string is the accessible name of every day cell in the
   * calendar, so its shape is part of the contract — not whatever ICU happens
   * to produce on a given engine.
   */
  it("renders a stable long date for screen readers", () => {
    expect(formatJalaliLong(new Date("2026-09-15T09:00:00Z"))).toBe(
      "سه‌شنبه ۲۴ شهریور ۱۴۰۵",
    );
  });

  it("renders a numeric date in Persian digits", () => {
    expect(formatJalaliNumeric(new Date("2026-09-15T09:00:00Z"))).toBe(
      "۱۴۰۵/۰۶/۲۴",
    );
  });

  it("compares calendar days, not instants", () => {
    const morning = new Date("2026-09-15T06:00:00Z");
    const evening = new Date("2026-09-15T19:00:00Z");
    expect(isSameJalaliDay(morning, evening)).toBe(true);
    expect(isSameJalaliDay(morning, new Date("2026-09-16T06:00:00Z"))).toBe(
      false,
    );
  });
});

describe("the Iranian week", () => {
  /** Saturday 21 Shahrivar 1405 = 12 September 2026. */
  const wednesday = new Date("2026-09-16T09:00:00Z");

  it("starts the week on Saturday, whatever day is given", () => {
    const expected = startOfWeek(wednesday).toISOString();
    for (let offset = 0; offset < 7; offset++) {
      const day = addDays(startOfWeek(wednesday), offset);
      expect(startOfWeek(day).toISOString()).toBe(expected);
    }
  });

  it("opens the week at midnight in Tehran, not UTC", () => {
    // Tehran is UTC+03:30 the year round, so local midnight is 20:30 the day
    // before in UTC. Getting this wrong shifts an evening session into the
    // previous day.
    expect(startOfWeek(wednesday).toISOString()).toBe(
      "2026-09-11T20:30:00.000Z",
    );
    expect(iranianWeekday(startOfWeek(wednesday))).toBe(0);
  });

  it("gives seven consecutive days, Saturday first", () => {
    const days = weekDays(wednesday);
    expect(days).toHaveLength(7);
    expect(iranianWeekday(days[0]!)).toBe(0);
    expect(iranianWeekday(days[6]!)).toBe(6);

    for (let index = 1; index < days.length; index++) {
      expect(days[index]!.getTime() - days[index - 1]!.getTime()).toBe(
        24 * 60 * 60 * 1000,
      );
    }
  });

  it("puts a late-evening instant on the day Tehran calls it", () => {
    // 23:00 Tehran on Wednesday is already Thursday in UTC.
    const lateWednesday = new Date("2026-09-16T19:30:00Z");
    expect(startOfDay(lateWednesday).toISOString()).toBe(
      "2026-09-15T20:30:00.000Z",
    );
  });
});

describe("clock times", () => {
  it("renders the Tehran wall clock in Persian digits", () => {
    expect(formatTime(new Date("2026-09-16T12:30:00Z"))).toBe("۱۶:۰۰");
  });

  it("renders midnight as 00:00, never 24:00", () => {
    expect(formatTime(new Date("2026-09-15T20:30:00Z"))).toBe("۰۰:۰۰");
  });
});
