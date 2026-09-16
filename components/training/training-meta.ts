import type {
  AttendanceStatus,
  TrainingStatus,
  TrainingType,
} from "@/lib/generated/prisma/enums";

/**
 * How training reads in Persian.
 *
 * Kept on the presentation side rather than returned by the API: an enum is
 * the contract, a label is a design decision, and the two should be free to
 * change independently.
 */

export const TRAINING_TYPE_LABEL: Record<TrainingType, string> = {
  TECHNICAL: "فنی",
  PHYSICAL: "بدنی",
  TACTICAL: "تاکتیکی",
  RECOVERY: "ریکاوری",
  MIXED: "ترکیبی",
  OTHER: "سایر",
};

export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  DRAFT: "پیش‌نویس",
  SCHEDULED: "برنامه‌ریزی‌شده",
  COMPLETED: "برگزار شد",
  CANCELLED: "لغو شد",
};

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "حاضر",
  LATE: "تأخیر",
  ABSENT: "غایب",
  EXCUSED: "موجه",
};

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
