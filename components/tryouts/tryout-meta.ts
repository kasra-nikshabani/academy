import type { ApplicationStatus } from "@/lib/generated/prisma/enums";

/**
 * The Persian words themselves live in `@/lib/labels` — the same word
 * appears on a badge, in an exported CSV and in a notification body, so it
 * is domain vocabulary rather than a design decision. The colour maps below
 * genuinely are presentation, and stay here.
 */
export {
  TRYOUT_STATUS_LABEL,
  APPLICATION_STATUS_LABEL,
  SCREENING_STATUS_LABEL,
} from "@/lib/labels";

/** How the talent module reads in Persian. Presentation, not contract. */

export const APPLICATION_STATUS_CLASS: Record<ApplicationStatus, string> = {
  SUBMITTED: "bg-muted text-muted-foreground",
  SCREENING: "bg-brand-muted text-brand-foreground",
  EVALUATION: "bg-brand text-brand-foreground",
  ACCEPTED: "bg-success text-success-foreground",
  REJECTED: "bg-destructive/15 text-destructive",
  WAITLIST: "bg-warning text-warning-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};
