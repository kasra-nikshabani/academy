import type {
  EvaluationDimension,
  EvaluationRecommendation,
  EvaluationStatus,
} from "@/lib/generated/prisma/enums";

/** How the evaluation engine reads in Persian. Presentation, not contract. */

export const DIMENSION_LABEL: Record<EvaluationDimension, string> = {
  TECHNICAL: "فنی",
  PHYSICAL: "بدنی",
  MENTAL: "ذهنی",
  OVERALL: "کلی",
};

/** The order CLAUDE.md §14 lists them in, which is how the club reads them. */
export const DIMENSION_ORDER = [
  "TECHNICAL",
  "PHYSICAL",
  "MENTAL",
  "OVERALL",
] as const satisfies readonly EvaluationDimension[];

export const EVALUATION_STATUS_LABEL: Record<EvaluationStatus, string> = {
  DRAFT: "در انتظار تکمیل",
  SUBMITTED: "ثبت نهایی شد",
};

export const RECOMMENDATION_LABEL: Record<EvaluationRecommendation, string> = {
  ACCEPT: "پیشنهاد پذیرش",
  WAITLIST: "فهرست انتظار",
  REJECT: "پیشنهاد عدم پذیرش",
  MORE_OBSERVATION: "نیاز به مشاهده بیشتر",
};

export const RECOMMENDATION_CLASS: Record<EvaluationRecommendation, string> = {
  ACCEPT: "bg-success text-success-foreground",
  WAITLIST: "bg-warning text-warning-foreground",
  REJECT: "bg-destructive/15 text-destructive",
  MORE_OBSERVATION: "bg-muted text-muted-foreground",
};

/**
 * The colour a mark carries, on the 0–10 scale every overall lands on.
 *
 * Three bands, not a gradient: a coach reading a list wants to see which
 * players stand out, and eleven shades of amber says nothing at a glance.
 */
export function scoreTone(score: number | null): string {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 7.5) return "bg-success text-success-foreground";
  if (score >= 5) return "bg-brand text-brand-foreground";
  return "bg-destructive/15 text-destructive";
}
