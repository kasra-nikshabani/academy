import type {
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
