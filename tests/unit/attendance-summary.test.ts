import { describe, expect, it } from "vitest";
import {
  EMPTY_TOTALS,
  attendanceRate,
  tally,
} from "@/lib/services/attendance-summary";
import type { AttendanceStatus } from "@/lib/generated/prisma/enums";

const statuses = (...list: AttendanceStatus[]): AttendanceStatus[] => list;

describe("counting a register", () => {
  it("counts nothing as nothing", () => {
    expect(tally([])).toEqual(EMPTY_TOTALS);
  });

  it("counts each status once and totals them", () => {
    const totals = tally(
      statuses("PRESENT", "PRESENT", "LATE", "ABSENT", "EXCUSED"),
    );

    expect(totals).toEqual({
      present: 2,
      late: 1,
      absent: 1,
      excused: 1,
      total: 5,
    });
  });
});

describe("the attendance rate", () => {
  it("is null before anything has been recorded", () => {
    expect(attendanceRate(EMPTY_TOTALS)).toBeNull();
  });

  it("counts a late arrival as turning up", () => {
    expect(attendanceRate(tally(statuses("PRESENT", "LATE")))).toBe(100);
  });

  /**
   * The rule worth stating in a test: an excused absence leaves the sum
   * entirely. A player who missed four of five sessions with the club's
   * permission attended the one session asked of them — reporting that as 20%
   * would turn an agreed rest week into a discipline figure.
   */
  it("leaves an excused absence out of the sum, not on the wrong side of it", () => {
    const excusedHeavy = tally(
      statuses("PRESENT", "EXCUSED", "EXCUSED", "EXCUSED", "EXCUSED"),
    );

    expect(attendanceRate(excusedHeavy)).toBe(100);
    // …and the absences are still counted, so the page can show them.
    expect(excusedHeavy.excused).toBe(4);
    expect(excusedHeavy.total).toBe(5);
  });

  it("is null when every recorded session was excused", () => {
    expect(attendanceRate(tally(statuses("EXCUSED", "EXCUSED")))).toBeNull();
  });

  it("counts an unexcused absence against the player", () => {
    expect(attendanceRate(tally(statuses("PRESENT", "ABSENT")))).toBe(50);
    expect(
      attendanceRate(tally(statuses("PRESENT", "PRESENT", "PRESENT", "ABSENT"))),
    ).toBe(75);
  });

  it("rounds to a whole percent", () => {
    // 2 of 3 is 66.66…
    expect(attendanceRate(tally(statuses("PRESENT", "PRESENT", "ABSENT")))).toBe(
      67,
    );
  });

  it("reports zero when nobody turned up at all", () => {
    expect(attendanceRate(tally(statuses("ABSENT", "ABSENT")))).toBe(0);
  });
});
