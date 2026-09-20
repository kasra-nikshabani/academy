import type { AttendanceStatus } from "@/lib/generated/prisma/enums";

/**
 * The Persian words themselves live in `@/lib/labels` — the same word
 * appears on a badge, in an exported CSV and in a notification body, so it
 * is domain vocabulary rather than a design decision. The colour maps below
 * genuinely are presentation, and stay here.
 */
export {
  TRAINING_TYPE_LABEL,
  TRAINING_STATUS_LABEL,
  ATTENDANCE_STATUS_LABEL,
} from "@/lib/labels";

/**
 * How training reads in Persian.
 *
 * Kept on the presentation side rather than returned by the API: an enum is
 * the contract, a label is a design decision, and the two should be free to
 * change independently.
 */

/**
 * The four statuses in the order a coach reads them — best to worst, with
 * «موجه» last because it is an administrative answer rather than a worse one.
 */
export const ATTENDANCE_STATUS_ORDER = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "EXCUSED",
] as const satisfies readonly AttendanceStatus[];

export const ATTENDANCE_STATUS_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: "bg-success text-success-foreground",
  LATE: "bg-warning text-warning-foreground",
  ABSENT: "bg-destructive/15 text-destructive",
  EXCUSED: "bg-muted text-muted-foreground",
};
