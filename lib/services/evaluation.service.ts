import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  isUnscoped,
  requirePermission,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import {
  findAgeGroupById,
  findSportById,
} from "@/lib/repositories/academy.repository";
import * as repo from "@/lib/repositories/evaluation.repository";
import {
  findPlayerById,
  findStaffIdForUser,
} from "@/lib/repositories/people.repository";
import { runInTransaction } from "@/lib/repositories/transaction";
import type {
  CreateTemplateInput,
  EvaluationQuery,
  RequestEvaluationInput,
  SaveEvaluationInput,
} from "@/lib/validation/evaluation";
import {
  dimensionAverages,
  isScoreInRange,
  weightedOverall,
} from "./evaluation-scoring";
import { recordJourneyEvent } from "./journey.service";

/**
 * The evaluation engine.
 *
 * ## How a coach reaches a trial player without a tryout permission
 *
 * A coach holds no `tryout:*` permission at all — the talent pipeline is the
 * academy manager's (CLAUDE.md §21). But somebody has to watch the player
 * play, and that somebody is a coach.
 *
 * The bridge is the assignment. The manager asks for an evaluation and names
 * the coach; from then on the coach can open **that evaluation** — the
 * player, the criteria, the sheet — without ever being able to list
 * applications, see the funnel, or touch a decision. The narrowest thing that
 * lets them do the job, and nothing more.
 *
 * And what they produce is a **recommendation**, not a decision. `ACCEPT` from
 * a coach is advice; only `tryout:decide` accepts anybody.
 */

/** What a caller is allowed to reach: their assignments, plus their squads. */
async function evaluationAccess(caller: AuthorizedUser) {
  if (isUnscoped(caller)) {
    return { unrestricted: true as const, staffId: null, playerIds: null };
  }

  const [staffId, scope] = await Promise.all([
    findStaffIdForUser(caller.id),
    resolveScope(caller),
  ]);

  return {
    unrestricted: false as const,
    staffId,
    playerIds: scope.playerIds ?? [],
  };
}

async function requireReachableEvaluation(caller: AuthorizedUser, id: string) {
  const evaluation = await repo.findEvaluationById(id);
  if (!evaluation) throw new NotFoundError("ارزیابی یافت نشد.");

  const access = await evaluationAccess(caller);
  if (access.unrestricted) return evaluation;

  const isAssignee =
    access.staffId !== null && evaluation.evaluatorId === access.staffId;
  const isOwnSquadPlayer = access.playerIds.includes(evaluation.playerId);

  if (!isAssignee && !isOwnSquadPlayer) {
    // Same answer as an evaluation that does not exist, so a coach cannot
    // discover who else is being assessed by trying ids.
    throw new NotFoundError("ارزیابی یافت نشد.");
  }

  return evaluation;
}

// --- templates --------------------------------------------------------------

export async function listEvaluationTemplates(
  caller: AuthorizedUser,
  filters: { sportId?: string | undefined; includeInactive?: boolean } = {},
) {
  requirePermission(caller, "evaluation:read");
  return repo.listTemplates({
    sportId: filters.sportId,
    includeInactive: filters.includeInactive ?? false,
  });
}

export async function getEvaluationTemplate(
  caller: AuthorizedUser,
  id: string,
) {
  requirePermission(caller, "evaluation:read");
  const template = await repo.findTemplateById(id);
  if (!template) throw new NotFoundError("الگوی ارزیابی یافت نشد.");
  return template;
}

/**
 * Writes a template.
 *
 * Restricted to unscoped callers: a template is the club's yardstick, and a
 * coach who could write their own would be marking their own homework.
 */
export async function createEvaluationTemplate(
  caller: AuthorizedUser,
  input: CreateTemplateInput,
) {
  requirePermission(caller, "evaluation:write");

  if (!isUnscoped(caller)) {
    throw new ValidationError(
      "الگوی ارزیابی فقط توسط مدیر آکادمی تعریف می‌شود.",
    );
  }

  const [sport, ageGroup] = await Promise.all([
    findSportById(input.sportId),
    input.ageGroupId ? findAgeGroupById(input.ageGroupId) : null,
  ]);

  if (!sport) throw new ValidationError("رشته ورزشی انتخاب‌شده وجود ندارد.");
  if (input.ageGroupId && !ageGroup) {
    throw new ValidationError("رده سنی انتخاب‌شده وجود ندارد.");
  }
  if (ageGroup && ageGroup.sportId !== sport.id) {
    throw new ValidationError("رده سنی انتخاب‌شده متعلق به این رشته نیست.");
  }

  const template = await repo.createTemplate({
    sportId: sport.id,
    ageGroupId: input.ageGroupId ?? null,
    title: input.title,
    description: input.description,
    createdById: caller.id,
    criteria: input.criteria.map((criterion, index) => ({
      dimension: criterion.dimension,
      title: criterion.title,
      description: criterion.description,
      maxScore: criterion.maxScore,
      weight: criterion.weight,
      displayOrder: criterion.displayOrder ?? index,
    })),
  });

  logger.info("evaluation template created", {
    templateId: template.id,
    criteria: template.criteria.length,
    actorId: caller.id,
  });

  return template;
}

// --- evaluations ------------------------------------------------------------

export async function listEvaluations(
  caller: AuthorizedUser,
  filters: EvaluationQuery = {},
) {
  requirePermission(caller, "evaluation:read");

  const access = await evaluationAccess(caller);

  if (access.unrestricted) {
    return repo.listEvaluations({
      status: filters.status,
      playerId: filters.playerId,
      applicationId: filters.applicationId,
      allowedPlayerIds: null,
    });
  }

  // A coach with no staff record has no assignments; they still see their own
  // squad's evaluations, and an empty list is the correct answer for someone
  // with neither.
  return repo.listEvaluationsForCoach({
    evaluatorId: access.staffId ?? "",
    allowedPlayerIds: access.playerIds,
    status: filters.status,
  });
}

export async function getEvaluation(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "evaluation:read");
  const evaluation = await requireReachableEvaluation(caller, id);

  return {
    ...evaluation,
    dimensions: dimensionAverages(
      evaluation.scores.flatMap((score) => {
        const criterion = evaluation.template.criteria.find(
          (item) => item.id === score.criterionId,
        );
        return criterion
          ? [
              {
                score: score.score,
                maxScore: criterion.maxScore,
                weight: criterion.weight,
                dimension: criterion.dimension,
              },
            ]
          : [];
      }),
    ),
  };
}

/** Submitted evaluations on a player's record. */
export async function listPlayerEvaluations(
  caller: AuthorizedUser,
  playerId: string,
) {
  requirePermission(caller, "evaluation:read");

  const access = await evaluationAccess(caller);
  if (!access.unrestricted && !access.playerIds.includes(playerId)) {
    // A coach may hold an assignment for this player even when the player is
    // outside their squad; that is the trial case, and it is allowed.
    const assigned = await repo.listEvaluations({
      evaluatorId: access.staffId ?? "",
      playerId,
    });
    if (assigned.length === 0) {
      throw new NotFoundError("ارزیابی‌ای برای این بازیکن یافت نشد.");
    }
  }

  return repo.findEvaluationsForPlayer(playerId);
}

/**
 * Asks a named coach to evaluate a player.
 *
 * Assigning across the academy — to another person, or against a tryout
 * application — is an unscoped caller's job. Otherwise a coach could hand
 * themselves a trial player and walk around the tryout permission they do not
 * have, which is exactly what this design is built to prevent.
 */
export async function requestEvaluation(
  caller: AuthorizedUser,
  input: RequestEvaluationInput,
) {
  requirePermission(caller, "evaluation:write");

  const access = await evaluationAccess(caller);

  if (!access.unrestricted) {
    if (input.applicationId) {
      throw new ValidationError(
        "ارزیابی برای درخواست استعدادیابی فقط توسط مدیر آکادمی ثبت می‌شود.",
      );
    }
    if (access.staffId === null || input.evaluatorId !== access.staffId) {
      throw new ValidationError(
        "فقط مدیر آکادمی می‌تواند ارزیابی را به شخص دیگری بسپارد.",
      );
    }
    if (!access.playerIds.includes(input.playerId)) {
      throw new ValidationError("این بازیکن در تیم‌های شما نیست.");
    }
  }

  const [player, template] = await Promise.all([
    findPlayerById(input.playerId),
    repo.findTemplateById(input.templateId),
  ]);

  if (!player) throw new ValidationError("بازیکن انتخاب‌شده وجود ندارد.");
  if (!template)
    throw new ValidationError("الگوی ارزیابی انتخاب‌شده وجود ندارد.");
  if (!template.isActive) {
    throw new ValidationError("این الگوی ارزیابی بایگانی شده است.");
  }

  const evaluation = await repo.createEvaluation({
    playerId: input.playerId,
    templateId: input.templateId,
    evaluatorId: input.evaluatorId,
    assignedById: caller.id,
    applicationId: input.applicationId,
    trainingSessionId: input.trainingSessionId,
  });

  logger.info("evaluation requested", {
    evaluationId: evaluation.id,
    evaluatorId: input.evaluatorId,
    applicationId: input.applicationId,
    actorId: caller.id,
  });

  return evaluation;
}

/**
 * Saves marks, and optionally finishes the evaluation.
 *
 * Saving and submitting are one request because that is one action for the
 * coach: the last mark and "done" happen together at the side of a pitch.
 *
 * Submission computes the overall **once** and stores it. From then on the
 * evaluation is frozen — editing a template's weights next season must not
 * quietly restate what a coach concluded this one.
 */
export async function saveEvaluation(
  caller: AuthorizedUser,
  id: string,
  input: SaveEvaluationInput,
) {
  requirePermission(caller, "evaluation:write");

  const evaluation = await requireReachableEvaluation(caller, id);

  if (evaluation.status === "SUBMITTED") {
    throw new ConflictError(
      "این ارزیابی ثبت نهایی شده است و تغییر نمی‌کند؛ در صورت نیاز ارزیابی تازه‌ای ثبت کنید.",
    );
  }

  const criteria = new Map(
    evaluation.template.criteria.map((criterion) => [criterion.id, criterion]),
  );

  for (const score of input.scores) {
    const criterion = criteria.get(score.criterionId);
    if (!criterion) {
      throw new ValidationError("این معیار متعلق به الگوی این ارزیابی نیست.", {
        criterionId: score.criterionId,
      });
    }
    if (!isScoreInRange(score.score, criterion.maxScore)) {
      throw new ValidationError(
        `امتیاز «${criterion.title}» باید بین ۰ و ${criterion.maxScore} باشد.`,
        { criterionId: score.criterionId, maxScore: criterion.maxScore },
      );
    }
  }

  await runInTransaction(async (tx) => {
    for (const score of input.scores) {
      await repo.upsertScore(
        {
          evaluationId: id,
          criterionId: score.criterionId,
          score: score.score,
          note: score.note,
        },
        tx,
      );
    }

    if (!input.submit) {
      await repo.updateEvaluation(
        id,
        {
          ...(input.recommendation === undefined
            ? {}
            : { recommendation: input.recommendation }),
          ...(input.strengths === undefined
            ? {}
            : { strengths: input.strengths }),
          ...(input.weaknesses === undefined
            ? {}
            : { weaknesses: input.weaknesses }),
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
        tx,
      );
      return;
    }

    // Read the marks back inside the transaction rather than trusting the
    // request: a partial save earlier in the session counts too.
    const stored = await repo.listScoresWithCriteria(id, tx);

    if (stored.length === 0) {
      throw new ValidationError("ارزیابی بدون امتیاز ثبت نهایی نمی‌شود.");
    }
    if (stored.length < criteria.size) {
      throw new ValidationError("همه معیارها باید امتیاز داشته باشند.", {
        scored: stored.length,
        required: criteria.size,
      });
    }

    const overall = weightedOverall(
      stored.map((row) => ({
        score: row.score,
        maxScore: row.criterion.maxScore,
        weight: row.criterion.weight,
        dimension: row.criterion.dimension,
      })),
    );

    await repo.updateEvaluation(
      id,
      {
        status: "SUBMITTED",
        submittedAt: new Date(),
        overallScore: overall,
        ...(input.recommendation === undefined
          ? {}
          : { recommendation: input.recommendation }),
        ...(input.strengths === undefined
          ? {}
          : { strengths: input.strengths }),
        ...(input.weaknesses === undefined
          ? {}
          : { weaknesses: input.weaknesses }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
      },
      tx,
    );

    // Written with the submission, like every other event
    // (docs/BUSINESS_RULES.md §12).
    await recordJourneyEvent(
      {
        playerId: evaluation.playerId,
        type: "EVALUATION",
        title: `ارزیابی — ${evaluation.template.title}`,
        description:
          overall === null ? "بدون امتیاز کلی" : `امتیاز کلی ${overall} از ۱۰`,
        actorId: caller.id,
      },
      tx,
    );
  });

  logger.info("evaluation saved", {
    evaluationId: id,
    submitted: input.submit,
    actorId: caller.id,
  });

  return getEvaluation(caller, id);
}

/** The evaluation summary shown beside each application on a trial's page. */
export async function summariseApplicationEvaluations(
  caller: AuthorizedUser,
  applicationIds: string[],
) {
  requirePermission(caller, "evaluation:read");
  return repo.summariseForApplications(applicationIds);
}
