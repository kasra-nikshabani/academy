import type { NotificationType } from "@/lib/generated/prisma/enums";

/** Presentation-only: what each kind of notification looks like. */

export const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  INFO: "اطلاع",
  SUCCESS: "موفقیت",
  WARNING: "هشدار",
  ALERT: "مهم",
  TRAINING: "تمرین",
  MATCH: "مسابقه",
  ATTENDANCE: "حضور و غیاب",
  EVALUATION: "ارزیابی",
  TRYOUT: "استعدادیابی",
  SYSTEM: "سامانه",
};

/**
 * The tone each kind carries.
 *
 * Only genuinely urgent kinds get a loud colour. If everything is `ALERT` red
 * then nothing is, and the one notification that actually needed attention is
 * the one that looks like all the others.
 */
export const NOTIFICATION_CLASS: Record<NotificationType, string> = {
  INFO: "bg-secondary text-secondary-foreground",
  SUCCESS: "bg-success text-success-foreground",
  WARNING: "bg-warning text-warning-foreground",
  ALERT: "bg-destructive text-destructive-foreground",
  TRAINING: "bg-secondary text-secondary-foreground",
  MATCH: "bg-secondary text-secondary-foreground",
  ATTENDANCE: "bg-secondary text-secondary-foreground",
  EVALUATION: "bg-secondary text-secondary-foreground",
  TRYOUT: "bg-brand text-brand-foreground",
  SYSTEM: "bg-muted text-muted-foreground",
};
