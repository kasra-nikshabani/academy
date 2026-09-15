import { describe, expect, it } from "vitest";
import {
  ageInSeason,
  birthYearWindow,
  describeBirthYearWindow,
  findBandForBirthYear,
  isBirthYearEligible,
  isEligible,
} from "@/lib/services/age-group";
import { fromJalali } from "@/lib/utils/date";

const U12 = { minAge: 10, maxAge: 11 };
const U14 = { minAge: 12, maxAge: 13 };
const U16 = { minAge: 14, maxAge: 15 };

describe("age by season", () => {
  it("is the season year minus the birth year", () => {
    expect(ageInSeason(1405, 1392)).toBe(13);
    expect(ageInSeason(1405, 1390)).toBe(15);
  });
});

describe("birth-year window", () => {
  it("maps a band onto the years it admits", () => {
    // U14 in season 1405 admits players who turn 12 or 13 that year.
    expect(birthYearWindow(U14, 1405)).toEqual({ from: 1392, to: 1393 });
  });

  it("older ages produce earlier birth years", () => {
    const window = birthYearWindow(U16, 1405);
    expect(window.from).toBeLessThan(window.to);
    expect(window).toEqual({ from: 1390, to: 1391 });
  });

  /** The reason the band is stored as ages and not as years. */
  it("moves with the season", () => {
    expect(birthYearWindow(U14, 1405)).toEqual({ from: 1392, to: 1393 });
    expect(birthYearWindow(U14, 1406)).toEqual({ from: 1393, to: 1394 });
    expect(birthYearWindow(U14, 1407)).toEqual({ from: 1394, to: 1395 });
  });

  it("describes itself in Persian", () => {
    expect(describeBirthYearWindow(U14, 1405).label).toBe("متولد ۱۳۹۲ تا ۱۳۹۳");
    expect(describeBirthYearWindow({ minAge: 9, maxAge: 9 }, 1405).label).toBe(
      "متولد ۱۳۹۶",
    );
  });
});

describe("eligibility", () => {
  it("admits the years inside the band", () => {
    expect(isBirthYearEligible(U14, 1405, 1392)).toBe(true);
    expect(isBirthYearEligible(U14, 1405, 1393)).toBe(true);
  });

  it("rejects the years either side", () => {
    expect(isBirthYearEligible(U14, 1405, 1391)).toBe(false); // too old
    expect(isBirthYearEligible(U14, 1405, 1394)).toBe(false); // too young
  });

  /**
   * The deliberate consequence of banding by year: two players born eleven
   * months apart fall in different bands when Nowruz sits between them.
   */
  it("ignores the month of birth", () => {
    const lateInYear = fromJalali(1392, 12, 29); // just before Nowruz
    const earlyNextYear = fromJalali(1393, 1, 1); // the next day

    expect(isEligible(U14, 1405, lateInYear)).toBe(true);
    expect(isEligible(U14, 1405, earlyNextYear)).toBe(true);

    // …and a player one day older than the band's oldest is out.
    expect(isEligible(U14, 1405, fromJalali(1391, 12, 29))).toBe(false);
  });

  it("works from a date of birth", () => {
    expect(isEligible(U14, 1405, fromJalali(1392, 6, 15))).toBe(true);
    expect(isEligible(U16, 1405, fromJalali(1392, 6, 15))).toBe(false);
  });
});

describe("choosing a band", () => {
  const bands = [U12, U14, U16];

  it("finds the band a birth year belongs to", () => {
    expect(findBandForBirthYear(bands, 1405, 1392)).toEqual(U14);
    expect(findBandForBirthYear(bands, 1405, 1395)).toEqual(U12);
    expect(findBandForBirthYear(bands, 1405, 1390)).toEqual(U16);
  });

  it("returns null when nothing fits", () => {
    expect(findBandForBirthYear(bands, 1405, 1370)).toBeNull(); // far too old
    expect(findBandForBirthYear(bands, 1405, 1402)).toBeNull(); // far too young
  });

  it("prefers the narrower band when two overlap", () => {
    const wide = { minAge: 10, maxAge: 15 };
    const narrow = { minAge: 12, maxAge: 13 };
    expect(findBandForBirthYear([wide, narrow], 1405, 1392)).toEqual(narrow);
    expect(findBandForBirthYear([narrow, wide], 1405, 1392)).toEqual(narrow);
  });
});
