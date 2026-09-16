import { toJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

/**
 * Age-group eligibility, by **birth year**.
 *
 * A player's age for a season is `season.startYear − birthYear`, using the
 * Jalali year of birth alone and ignoring the month. That is how youth
 * football bands are drawn: everyone born in a given year moves up together,
 * so the boundaries of a band stay fixed for the whole season instead of
 * shifting under a player on their birthday.
 *
 * The consequence is deliberate: two players eleven months apart can land in
 * different bands if they fall either side of Nowruz. The alternative —
 * exact-date age — reshuffles squads mid-season and does not match how the
 * federation runs competitions.
 *
 * Decided with the club, recorded in docs/BUSINESS_RULES.md §4.
 */

export interface AgeBand {
  minAge: number;
  maxAge: number;
}

export interface BirthYearWindow {
  /** Earliest Jalali birth year admitted (the oldest players). */
  from: number;
  /** Latest Jalali birth year admitted (the youngest players). */
  to: number;
}

/** Age a player reaches during the season, by birth year alone. */
export function ageInSeason(
  seasonStartYear: number,
  birthYear: number,
): number {
  return seasonStartYear - birthYear;
}

/**
 * The birth years a band admits in a given season.
 *
 * The older a player, the earlier they were born — so `maxAge` produces the
 * *earliest* birth year and `minAge` the latest.
 */
export function birthYearWindow(
  band: AgeBand,
  seasonStartYear: number,
): BirthYearWindow {
  return {
    from: seasonStartYear - band.maxAge,
    to: seasonStartYear - band.minAge,
  };
}

export function isBirthYearEligible(
  band: AgeBand,
  seasonStartYear: number,
  birthYear: number,
): boolean {
  const age = ageInSeason(seasonStartYear, birthYear);
  return age >= band.minAge && age <= band.maxAge;
}

/** Same check from a date of birth, read in Tehran. */
export function isEligible(
  band: AgeBand,
  seasonStartYear: number,
  dateOfBirth: Date,
): boolean {
  return isBirthYearEligible(band, seasonStartYear, toJalali(dateOfBirth).jy);
}

/**
 * Picks the band a birth year belongs to.
 *
 * Bands are expected not to overlap; if they do, the narrowest match wins, so
 * a deliberately tighter band (say a trial squad) takes precedence over a wide
 * catch-all rather than the order of rows deciding it.
 */
export function findBandForBirthYear<T extends AgeBand>(
  bands: readonly T[],
  seasonStartYear: number,
  birthYear: number,
): T | null {
  const matches = bands.filter((band) =>
    isBirthYearEligible(band, seasonStartYear, birthYear),
  );
  if (matches.length === 0) return null;

  return matches.reduce((narrowest, candidate) =>
    candidate.maxAge - candidate.minAge < narrowest.maxAge - narrowest.minAge
      ? candidate
      : narrowest,
  );
}

/** `U14` with ages 12–13 in season 1405 → «متولد ۱۳۹۲ تا ۱۳۹۳». */
export function describeBirthYearWindow(
  band: AgeBand,
  seasonStartYear: number,
): BirthYearWindow & { label: string } {
  const window = birthYearWindow(band, seasonStartYear);
  return {
    ...window,
    label:
      window.from === window.to
        ? `متولد ${toPersianDigits(window.from)}`
        : `متولد ${toPersianDigits(window.from)} تا ${toPersianDigits(window.to)}`,
  };
}
