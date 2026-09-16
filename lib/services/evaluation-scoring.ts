import type { EvaluationDimension } from "@/lib/generated/prisma/enums";

/**
 * Turning a sheet of marks into one number.
 *
 * Pure, because this is the number that goes on a player's record and into a
 * conversation with their family, and it should be possible to check it
 * without a database.
 *
 * Every criterion is normalised to its own maximum before being weighted, so
 * a template that marks sprint times out of five and first touch out of ten
 * does not quietly make the sprint worth half as much. The result is always
 * on a 0–10 scale, whatever the template underneath — otherwise two players
 * assessed on different templates could not be compared at all.
 */

export interface ScoredCriterion {
  score: number;
  maxScore: number;
  weight: number;
  dimension: EvaluationDimension;
}

const SCALE = 10;

/** One decimal place: `7.3` is a judgement, `7.3125` is a false precision. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The weighted overall, 0–10, or null when there is nothing to average.
 *
 * Null rather than zero. A player nobody has marked yet has not scored zero,
 * and the difference matters on a page that a coach reads quickly.
 */
export function weightedOverall(
  scored: readonly ScoredCriterion[],
): number | null {
  let weighted = 0;
  let totalWeight = 0;

  for (const item of scored) {
    if (item.maxScore <= 0 || item.weight <= 0) continue;
    weighted += (item.score / item.maxScore) * item.weight;
    totalWeight += item.weight;
  }

  if (totalWeight === 0) return null;
  return round((weighted / totalWeight) * SCALE);
}

/**
 * The same average per dimension — the four numbers the club reports on
 * (CLAUDE.md §14). Dimensions with nothing scored are absent rather than zero.
 */
export function dimensionAverages(
  scored: readonly ScoredCriterion[],
): Partial<Record<EvaluationDimension, number>> {
  const byDimension = new Map<EvaluationDimension, ScoredCriterion[]>();

  for (const item of scored) {
    const bucket = byDimension.get(item.dimension) ?? [];
    bucket.push(item);
    byDimension.set(item.dimension, bucket);
  }

  const result: Partial<Record<EvaluationDimension, number>> = {};
  for (const [dimension, items] of byDimension) {
    const average = weightedOverall(items);
    if (average !== null) result[dimension] = average;
  }

  return result;
}

/** Whether a mark is one this criterion accepts. */
export function isScoreInRange(score: number, maxScore: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= maxScore;
}
