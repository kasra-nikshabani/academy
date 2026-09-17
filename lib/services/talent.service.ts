import { ValidationError } from "@/lib/errors";
import { requirePermission, type AuthorizedUser } from "@/lib/permissions";
import {
  findActiveSeason,
  findSeasonById,
} from "@/lib/repositories/academy.repository";
import * as repo from "@/lib/repositories/tryout.repository";
import type {
  PipelineQueue,
  PipelineScope,
} from "@/lib/repositories/tryout.repository";
import {
  acceptedWithoutEvaluation,
  conversionRate,
  funnelStages,
  stillOpen,
  type PipelineCounts,
} from "./talent-funnel";

/**
 * The talent pipeline: every trial at once.
 *
 * Phase 10 gave each trial its own funnel. This is the view across all of
 * them, and it is deliberately more than a chart — the useful half is the
 * three queues, because the pipeline is not something a manager looks at, it
 * is something a manager works through:
 *
 *   waiting for screening    — nobody has checked the paperwork
 *   waiting for an evaluator — past screening, nobody asked to watch them
 *   waiting for a decision   — watched, and now sitting on someone's desk
 *
 * The middle one is the queue that would otherwise be invisible. An applicant
 * who passed screening and was never assigned to a coach waits forever with
 * nothing in any list saying so.
 */

/** How many rows of each queue a page asks for. */
const QUEUE_LIMIT = 25;

export interface TalentPipelineFilters {
  seasonId?: string | undefined;
  sportId?: string | undefined;
  tryoutId?: string | undefined;
  /** Omit the season filter entirely and count every season ever run. */
  allSeasons?: boolean;
}

async function resolveScope(
  filters: TalentPipelineFilters,
): Promise<{ scope: PipelineScope; seasonName: string | null }> {
  if (filters.allSeasons) {
    return {
      scope: {
        sportId: filters.sportId,
        tryoutId: filters.tryoutId,
      },
      seasonName: null,
    };
  }

  const season = filters.seasonId
    ? await findSeasonById(filters.seasonId)
    : await findActiveSeason();

  if (!season) {
    throw new ValidationError(
      "فصل فعالی تعریف نشده است؛ ابتدا فصل جاری را مشخص کنید.",
    );
  }

  return {
    scope: {
      seasonId: season.id,
      sportId: filters.sportId,
      tryoutId: filters.tryoutId,
    },
    seasonName: season.name,
  };
}

export async function getTalentPipeline(
  caller: AuthorizedUser,
  filters: TalentPipelineFilters = {},
) {
  requirePermission(caller, "tryout:read");

  const { scope, seasonName } = await resolveScope(filters);

  const [raw, openTryouts, unfinishedEvaluations] = await Promise.all([
    repo.countPipeline(scope),
    repo.countOpenTryouts(scope),
    repo.countUnfinishedEvaluations(scope),
  ]);

  const counts: PipelineCounts = {
    applied: raw.applied,
    passedScreening: raw.passedScreening,
    evaluated: raw.evaluated,
    accepted: raw.accepted,
    rejectedAtScreening: raw.rejectedAtScreening,
    rejectedAfterScreening: raw.rejectedAfterScreening,
    waitlisted: raw.waitlisted,
    cancelled: raw.cancelled,
    pendingScreening: raw.pendingScreening,
    awaitingEvaluator: raw.awaitingEvaluator,
    awaitingDecision: raw.awaitingDecision,
  };

  return {
    seasonName,
    counts,
    stages: funnelStages(counts),
    conversion: conversionRate(counts),
    stillOpen: stillOpen(counts),
    openTryouts,
    unfinishedEvaluations,
    /**
     * Surfaced rather than smoothed away: a funnel whose last bar is taller
     * than the one before it looks broken, and the honest reason is worth
     * saying out loud (lib/services/talent-funnel.ts).
     */
    acceptedWithoutEvaluation: acceptedWithoutEvaluation(
      raw.accepted,
      raw.acceptedAndEvaluated,
    ),
  };
}

/** One of the three queues, oldest application first. */
export async function getPipelineQueue(
  caller: AuthorizedUser,
  queue: PipelineQueue,
  filters: TalentPipelineFilters = {},
) {
  requirePermission(caller, "tryout:read");
  const { scope } = await resolveScope(filters);

  return repo.listPipelineQueue({ queue, scope, take: QUEUE_LIMIT });
}

/** All three at once, for the page that shows them side by side. */
export async function getPipelineQueues(
  caller: AuthorizedUser,
  filters: TalentPipelineFilters = {},
) {
  requirePermission(caller, "tryout:read");
  const { scope } = await resolveScope(filters);

  const [awaitingScreening, awaitingEvaluator, awaitingDecision] =
    await Promise.all([
      repo.listPipelineQueue({
        queue: "awaitingScreening",
        scope,
        take: QUEUE_LIMIT,
      }),
      repo.listPipelineQueue({
        queue: "awaitingEvaluator",
        scope,
        take: QUEUE_LIMIT,
      }),
      repo.listPipelineQueue({
        queue: "awaitingDecision",
        scope,
        take: QUEUE_LIMIT,
      }),
    ]);

  return { awaitingScreening, awaitingEvaluator, awaitingDecision };
}
