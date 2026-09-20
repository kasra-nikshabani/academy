import type {
  EvaluationDimension,
  EvaluationRecommendation,
} from "@/lib/generated/prisma/enums";

/**
 * The Persian words themselves live in `@/lib/labels` — the same word
 * appears on a badge, in an exported CSV and in a notification body, so it
 * is domain vocabulary rather than a design decision. The colour maps below
 * genuinely are presentation, and stay here.
 */
export {
  DIMENSION_LABEL,
  EVALUATION_STATUS_LABEL,
  RECOMMENDATION_LABEL,
} from "@/lib/labels";

/** How the evaluation engine reads in Persian. Presentation, not contract. */

/** The order CLAUDE.md §14 lists them in, which is how the club reads them. */
export const DIMENSION_ORDER = [
  "TECHNICAL",
  "PHYSICAL",
  "MENTAL",
  "OVERALL",
] as const satisfies readonly EvaluationDimension[];

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
