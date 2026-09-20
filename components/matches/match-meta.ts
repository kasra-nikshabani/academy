import type { MatchStatus } from "@/lib/generated/prisma/enums";
import type { MatchOutcome } from "@/lib/services/match-result";

/**
 * The Persian words themselves live in `@/lib/labels` — the same word
 * appears on a badge, in an exported CSV and in a notification body, so it
 * is domain vocabulary rather than a design decision. The colour maps below
 * genuinely are presentation, and stay here.
 */
export {
  MATCH_STATUS_LABEL,
  HOME_AWAY_LABEL,
  OUTCOME_LABEL,
  LINEUP_ROLE_LABEL,
} from "@/lib/labels";

/** How the competition module reads in Persian. Presentation, not contract. */

export const MATCH_STATUS_CLASS: Record<MatchStatus, string> = {
  SCHEDULED: "bg-brand text-brand-foreground",
  LIVE: "bg-destructive/15 text-destructive",
  COMPLETED: "bg-success text-success-foreground",
  POSTPONED: "bg-warning text-warning-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};

export const OUTCOME_CLASS: Record<MatchOutcome, string> = {
  WIN: "bg-success text-success-foreground",
  DRAW: "bg-muted text-muted-foreground",
  LOSS: "bg-destructive/15 text-destructive",
};
