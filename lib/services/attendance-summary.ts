import type { AttendanceStatus } from "@/lib/generated/prisma/enums";

/**
 * Counting a register.
 *
 * Pure, so the arithmetic that a parent reads as «۸۵٪ حضور» can be tested
 * without a database — including the two cases that are easy to get wrong:
 * nobody has trained yet, and an excused absence.
 */

export interface AttendanceTotals {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Every recorded row, whatever its status. */
  total: number;
}

export const EMPTY_TOTALS: AttendanceTotals = {
  present: 0,
  late: 0,
  absent: 0,
  excused: 0,
  total: 0,
};

export function tally(
  statuses: readonly AttendanceStatus[],
): AttendanceTotals {
  const totals = { ...EMPTY_TOTALS };

  for (const status of statuses) {
    totals.total += 1;
    if (status === "PRESENT") totals.present += 1;
    else if (status === "LATE") totals.late += 1;
    else if (status === "ABSENT") totals.absent += 1;
    else totals.excused += 1;
  }

  return totals;
}

/**
 * The share of sessions the player turned up to, 0–100.
 *
 * **An excused absence is not counted against the player, and not for them
 * either** — it leaves the denominator. A player who missed four of five
 * sessions with the club's permission has not attended 20%; they have
 * attended the one session that was asked of them. Counting an excused
 * absence as a miss would turn an agreed rest week into a discipline figure,
 * which is the sort of number that ends up in a conversation with a parent.
 *
 * Arriving late still counts as turning up. Lateness is reported on its own.
 */
export function attendanceRate(totals: AttendanceTotals): number | null {
  const counted = totals.present + totals.late + totals.absent;
  if (counted === 0) return null;
  return Math.round(((totals.present + totals.late) / counted) * 100);
}
