/**
 * The talent funnel: how far applications actually get.
 *
 * Pure, so the numbers a manager looks at before deciding who to take can be
 * checked without a database.
 *
 * The stages are counted **as they are**, not forced to nest. It is possible
 * to accept an applicant who was never evaluated — a manager who watched the
 * trial themselves may do exactly that — and a funnel that quietly reshaped
 * the numbers to slope downward would hide it. So the counts are reported
 * honestly, every share is measured against the applications rather than
 * against the previous stage, and the one case that would otherwise look like
 * a broken chart is surfaced as its own figure: how many were taken without
 * anybody filing an evaluation.
 */

export interface PipelineCounts {
  /** Every application, whatever became of it. */
  applied: number;
  /** Screening said yes. */
  passedScreening: number;
  /** At least one evaluation was submitted. */
  evaluated: number;
  accepted: number;

  // --- where people leave ---
  rejectedAtScreening: number;
  rejectedAfterScreening: number;
  waitlisted: number;
  cancelled: number;

  // --- what is waiting for someone ---
  pendingScreening: number;
  awaitingEvaluator: number;
  awaitingDecision: number;
}

export const EMPTY_COUNTS: PipelineCounts = {
  applied: 0,
  passedScreening: 0,
  evaluated: 0,
  accepted: 0,
  rejectedAtScreening: 0,
  rejectedAfterScreening: 0,
  waitlisted: 0,
  cancelled: 0,
  pendingScreening: 0,
  awaitingEvaluator: 0,
  awaitingDecision: 0,
};

export interface FunnelStage {
  key: "applied" | "passedScreening" | "evaluated" | "accepted";
  label: string;
  value: number;
  /** Share of all applications, 0–100. The bar's width. */
  share: number;
  /** How many were lost between the previous stage and this one, or null. */
  droppedFromPrevious: number | null;
}

const STAGE_LABELS: Record<FunnelStage["key"], string> = {
  applied: "درخواست ثبت‌شده",
  passedScreening: "عبور از غربالگری",
  evaluated: "ارزیابی‌شده",
  accepted: "پذیرفته‌شده",
};

function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function funnelStages(counts: PipelineCounts): FunnelStage[] {
  const order: Array<FunnelStage["key"]> = [
    "applied",
    "passedScreening",
    "evaluated",
    "accepted",
  ];

  return order.map((key, index) => {
    const value = counts[key];
    const previous = index === 0 ? null : counts[order[index - 1]!];

    return {
      key,
      label: STAGE_LABELS[key],
      value,
      share: percent(value, counts.applied),
      // Null when a stage is *larger* than the one before it: that is not a
      // drop, and calling it "-3 lost" would be nonsense.
      droppedFromPrevious:
        previous === null || value > previous ? null : previous - value,
    };
  });
}

/** Applications that became academy players, as a share of all of them. */
export function conversionRate(counts: PipelineCounts): number | null {
  if (counts.applied === 0) return null;
  return percent(counts.accepted, counts.applied);
}

/**
 * Applications still moving — nobody has decided, and they have not withdrawn.
 *
 * Worth its own number because the conversion rate is misleading while a lot
 * of applications are still open: a trial that closed yesterday will show a
 * terrible rate until the decisions are made.
 */
export function stillOpen(counts: PipelineCounts): number {
  return (
    counts.applied -
    counts.accepted -
    counts.rejectedAtScreening -
    counts.rejectedAfterScreening -
    counts.waitlisted -
    counts.cancelled
  );
}

/** How many were taken without anybody filing an evaluation. */
export function acceptedWithoutEvaluation(
  accepted: number,
  acceptedAndEvaluated: number,
): number {
  return Math.max(0, accepted - acceptedAndEvaluated);
}
