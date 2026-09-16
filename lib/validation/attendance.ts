import { z } from "zod";

/**
 * Taking the register.
 *
 * The shape follows how it is actually done: the coach marks the whole squad
 * present and then corrects the handful who were not. So one request carries
 * a `defaultStatus` for everyone in the squad and the exceptions by name —
 * rather than the client sending a row per player and the two halves of the
 * register arriving as separate, interruptible writes.
 */

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "EXCUSED",
] as const;

/** Beyond this a player did not arrive late, they arrived for the next one. */
const MAX_MINUTES_LATE = 240;

export const attendanceEntrySchema = z.object({
  playerId: z.string().trim().min(1),
  status: z.enum(ATTENDANCE_STATUSES),
  minutesLate: z.coerce.number().int().min(1).max(MAX_MINUTES_LATE).optional(),
  note: z.string().trim().max(500).optional(),
});

export const saveAttendanceSchema = z
  .object({
    /**
     * Applied to every squad member the entries do not mention. Omit it to
     * touch only the players named — used when correcting one row after the
     * register has already been taken.
     */
    defaultStatus: z.enum(ATTENDANCE_STATUSES).optional(),
    entries: z.array(attendanceEntrySchema).max(60).default([]),
  })
  .refine(
    (input) => input.defaultStatus !== undefined || input.entries.length > 0,
    { message: "هیچ موردی برای ثبت ارسال نشده است." },
  )
  .refine(
    (input) =>
      new Set(input.entries.map((entry) => entry.playerId)).size ===
      input.entries.length,
    { message: "برای هر بازیکن فقط یک وضعیت قابل ثبت است." },
  );

export const playerAttendanceQuerySchema = z.object({
  seasonId: z.string().trim().min(1).optional(),
  teamId: z.string().trim().min(1).optional(),
});

export type AttendanceEntryInput = z.infer<typeof attendanceEntrySchema>;
export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;
export type PlayerAttendanceQuery = z.infer<typeof playerAttendanceQuerySchema>;
