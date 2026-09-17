import type { HomeAway, MatchStatus } from "@/lib/generated/prisma/enums";
import type { MatchOutcome } from "@/lib/services/match-result";

/** How the competition module reads in Persian. Presentation, not contract. */

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: "برنامه‌ریزی‌شده",
  LIVE: "در حال برگزاری",
  COMPLETED: "برگزار شد",
  POSTPONED: "به تعویق افتاد",
  CANCELLED: "لغو شد",
};

export const MATCH_STATUS_CLASS: Record<MatchStatus, string> = {
  SCHEDULED: "bg-brand text-brand-foreground",
  LIVE: "bg-destructive/15 text-destructive",
  COMPLETED: "bg-success text-success-foreground",
  POSTPONED: "bg-warning text-warning-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};

export const HOME_AWAY_LABEL: Record<HomeAway, string> = {
  HOME: "خانه",
  AWAY: "خارج از خانه",
  NEUTRAL: "زمین بی‌طرف",
};

export const OUTCOME_LABEL: Record<MatchOutcome, string> = {
  WIN: "برد",
  DRAW: "مساوی",
  LOSS: "باخت",
};

export const OUTCOME_CLASS: Record<MatchOutcome, string> = {
  WIN: "bg-success text-success-foreground",
  DRAW: "bg-muted text-muted-foreground",
  LOSS: "bg-destructive/15 text-destructive",
};

export const LINEUP_ROLE_LABEL = {
  STARTER: "ترکیب اصلی",
  SUBSTITUTE: "ذخیره",
} as const;
