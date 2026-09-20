import type { NotificationType } from "@/lib/generated/prisma/enums";

/**
 * The Persian words themselves live in `@/lib/labels` — the same word
 * appears on a badge, in an exported CSV and in a notification body, so it
 * is domain vocabulary rather than a design decision. The colour maps below
 * genuinely are presentation, and stay here.
 */
export { NOTIFICATION_LABEL } from "@/lib/labels";

/** Presentation-only: what each kind of notification looks like. */

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
