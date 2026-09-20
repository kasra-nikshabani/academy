import {
  isLeapJalaaliYear,
  isValidJalaaliDate as isValidJalaali,
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
} from "jalaali-js";
import { toPersianDigits } from "./number";

/**
 * Jalali (Persian) calendar support.
 *
 * Two sources are used on purpose:
 *  - **Display** goes through `Intl.DateTimeFormat` with the `persian`
 *    calendar. It is built into Node and the browser, knows month and weekday
 *    names, and handles the time zone correctly — no dependency needed.
 *  - **Arithmetic** (month lengths, building a calendar grid, turning a user's
 *    pick back into a `Date`) goes through `jalaali-js`, the reference
 *    implementation of the conversion algorithm.
 *
 * The two agree: `tests/unit/date.test.ts` cross-checks them across a 50-year
 * range, so a drift between them would fail the build rather than ship.
 *
 * Storage stays UTC everywhere (docs/DATABASE.md §8); Jalali exists only at the
 * presentation edge.
 */

/** All academy dates are interpreted in Iran's civil time. */
export const ACADEMY_TIME_ZONE = "Asia/Tehran";

export interface JalaliDate {
  /** Jalali year, e.g. 1405 */
  jy: number;
  /** Jalali month, 1–12 */
  jm: number;
  /** Jalali day of month, 1–31 */
  jd: number;
}

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** The Iranian week starts on Saturday. */
export const WEEKDAY_NAMES = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
] as const;

export const WEEKDAY_SHORT_NAMES = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

/** Reads the Gregorian Y/M/D of an instant *as seen in Tehran*. */
function gregorianPartsInTehran(date: Date): {
  gy: number;
  gm: number;
  gd: number;
} {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone: ACADEMY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);

  return { gy: read("year"), gm: read("month"), gd: read("day") };
}

/** Gregorian instant → the Jalali calendar day it falls on in Tehran. */
export function toJalali(date: Date): JalaliDate {
  const { gy, gm, gd } = gregorianPartsInTehran(date);
  return toJalaali(gy, gm, gd);
}

/**
 * Jalali calendar day → a `Date`.
 *
 * Anchored at **noon Tehran** rather than midnight: a date-only value pinned to
 * midnight can slide into the previous day under a different offset, which
 * would silently shift a player's birth date. Noon leaves ~12 hours of slack in
 * both directions, so `toJalali(fromJalali(x))` always returns `x`.
 */
export function fromJalali(jy: number, jm: number, jd: number): Date {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  // Tehran is UTC+03:30 (Iran no longer observes DST).
  return new Date(Date.UTC(gy, gm - 1, gd, 12 - 3, 0 - 30, 0, 0));
}

export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  return isValidJalaali(jy, jm, jd);
}

export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

export function isJalaliLeapYear(jy: number): boolean {
  return isLeapJalaaliYear(jy);
}

/**
 * Iran is UTC+03:30 the year round — it no longer observes DST — so a day
 * boundary is a fixed offset rather than something that has to be looked up.
 */
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 0 = Saturday … 6 = Friday, matching the Iranian week. */
export function iranianWeekday(date: Date): number {
  const utcWeekday = new Date(
    date.toLocaleString("en-US", { timeZone: ACADEMY_TIME_ZONE }),
  ).getDay();
  return (utcWeekday + 1) % 7;
}

function jalaliFormatter(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: ACADEMY_TIME_ZONE,
    ...options,
  });
}

/** `۲۴ شهریور ۱۴۰۵` */
export function formatJalali(date: Date): string {
  return jalaliFormatter({
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * `سه‌شنبه ۲۴ شهریور ۱۴۰۵`
 *
 * Assembled from parts rather than handed to `Intl`: ICU orders a
 * weekday+long-date differently in Node and in Chrome, which would make the
 * same calendar day announce differently depending on where it is rendered.
 * This is the string screen readers read for each day cell, so it is pinned.
 */
export function formatJalaliLong(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  const weekday = WEEKDAY_NAMES[iranianWeekday(date)] ?? "";
  const month = JALALI_MONTH_NAMES[jm - 1] ?? "";
  return `${weekday} ${toPersianDigits(jd)} ${month} ${toPersianDigits(jy)}`;
}

/** `۱۴۰۵/۰۶/۲۴` — for dense tables where space is tight. */
export function formatJalaliNumeric(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return toPersianDigits(`${jy}/${pad(jm)}/${pad(jd)}`);
}

/** `۲۴ شهریور ۱۴۰۵، ۱۸:۳۰` */
export function formatJalaliDateTime(date: Date): string {
  return `${formatJalali(date)}، ${formatTime(date)}`;
}

/** `۱۸:۳۰` — the wall clock in Tehran. */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: ACADEMY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** `۱۶:۰۰ تا ۱۷:۳۰` */
export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} تا ${formatTime(end)}`;
}

/** Midnight in Tehran on the calendar day the instant falls on. */
export function startOfDay(date: Date): Date {
  const { jy, jm, jd } = toJalali(date);
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return new Date(Date.UTC(gy, gm - 1, gd, 0, 0, 0, 0) - TEHRAN_OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Midnight on the **Saturday** that opens the week containing the instant.
 *
 * The training calendar is built from this. Getting it from the Gregorian
 * weekday would open the week on Sunday and put Friday — the one day nothing
 * is scheduled — in the middle of the grid.
 */
export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -iranianWeekday(date));
}

/**
 * A week named by the Saturday that opens it — `۲۴ شهریور`.
 *
 * Short on purpose: this is an axis tick on a trend chart, where the year is
 * the same for every point and repeating it just crowds the axis.
 */
export function weekLabel(weekStart: Date): string {
  const { jm, jd } = toJalali(weekStart);
  return `${jd} ${JALALI_MONTH_NAMES[jm - 1]}`;
}

/** The seven days of the week containing the instant, Saturday first. */
export function weekDays(date: Date): Date[] {
  const saturday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(saturday, index));
}

export interface CalendarCell {
  date: Date;
  jalali: JalaliDate;
  /** False for the leading/trailing days borrowed from the adjacent months. */
  isCurrentMonth: boolean;
}

/**
 * A six-row Jalali month grid, Saturday-first, including the neighbouring days
 * needed to fill the first and last weeks. A fixed row count keeps the picker
 * from resizing as the user moves between months.
 */
export function getJalaliMonthGrid(jy: number, jm: number): CalendarCell[][] {
  const firstDay = fromJalali(jy, jm, 1);
  const leadingBlanks = iranianWeekday(firstDay);
  const daysInMonth = jalaliMonthLength(jy, jm);

  const cells: CalendarCell[] = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let index = 0; index < 42; index++) {
    const offset = index - leadingBlanks;
    const date = new Date(firstDay.getTime() + offset * dayMs);
    cells.push({
      date,
      jalali: toJalali(date),
      isCurrentMonth: offset >= 0 && offset < daysInMonth,
    });
  }

  const weeks: CalendarCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

/** Same calendar day in Tehran? */
export function isSameJalaliDay(a: Date, b: Date): boolean {
  const left = toJalali(a);
  const right = toJalali(b);
  return left.jy === right.jy && left.jm === right.jm && left.jd === right.jd;
}

export function addJalaliMonths(
  jy: number,
  jm: number,
  delta: number,
): { jy: number; jm: number } {
  const total = jy * 12 + (jm - 1) + delta;
  return { jy: Math.floor(total / 12), jm: (total % 12) + 1 };
}
