import { buildPaginationMeta, type PaginationQuery } from "@/lib/api";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  assertWithinScope,
  isUnscoped,
  requirePermission,
  resolveScheduleTeamIds,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import {
  findSeasonForDate,
  findTeamById,
  listTeamsByIds,
} from "@/lib/repositories/academy.repository";
import * as repo from "@/lib/repositories/training.repository";
import { runInTransaction, type Db } from "@/lib/repositories/transaction";
import { formatJalaliDateTime } from "@/lib/utils/date";
import type {
  CreateTrainingPlanInput,
  CreateTrainingSessionInput,
  TrainingExerciseInput,
  TrainingSessionQuery,
  UpdateTrainingPlanInput,
  UpdateTrainingSessionInput,
} from "@/lib/validation/training";
import { durationMinutes, sessionEnd } from "./training-time";

/**
 * Training: the calendar a coach lives in, and the plans behind it.
 *
 * Two different scopes are at work here, and keeping them apart is the whole
 * of the authorization story:
 *
 *   **reading**  — `resolveScheduleTeamIds`: assigned teams, plus the squads
 *                  the caller's own children or player record belong to. A
 *                  parent must be able to see when their child trains.
 *   **writing**  — `scope.teamIds`: assigned teams only. A parent seeing the
 *                  calendar is not a parent editing it.
 *
 * Nothing is deleted. A session that will not happen is cancelled, keeping the
 * row and the reason (CLAUDE.md §2).
 */

/** Statuses a session can no longer be edited out of. */
const FINAL_STATUSES = new Set(["CANCELLED"]);

/**
 * Re-reads a session with its team, season and plan.
 *
 * Writes return the bare row from inside their transaction, so every mutation
 * ends here — which also means a POST and a PATCH answer with exactly the
 * shape a GET does.
 */
async function readSession(id: string) {
  const session = await repo.findSessionById(id);
  if (!session) throw new NotFoundError("جلسه تمرین یافت نشد.");
  return session;
}

async function requireSeasonFor(startsAt: Date) {
  const season = await findSeasonForDate(startsAt);
  if (!season) {
    throw new ValidationError(
      "تاریخ جلسه در هیچ فصل تعریف‌شده‌ای قرار نمی‌گیرد؛ ابتدا فصل مربوطه را ثبت کنید.",
      { startsAt: startsAt.toISOString() },
    );
  }
  return season;
}

/** The team must exist, be active, and be one the caller may write for. */
async function requireWritableTeam(caller: AuthorizedUser, teamId: string) {
  const scope = await resolveScope(caller);
  assertWithinScope(scope.teamIds, teamId);

  const team = await findTeamById(teamId);
  if (!team) throw new ValidationError("تیم انتخاب‌شده وجود ندارد.");
  if (!team.isActive) {
    throw new ValidationError(
      "این تیم غیرفعال است و جلسه‌ای برای آن ثبت نمی‌شود.",
    );
  }
  return team;
}

/**
 * Refuses a session that shares any time with another session of the same team.
 *
 * A squad cannot be in two places at once, and a double-booked slot is found
 * at the pitch, not in the software. Touching sessions are allowed: one ending
 * at 17:30 and the next starting at 17:30 is an ordinary afternoon.
 *
 * Always called inside the transaction that then writes, and after
 * `lockTeamSchedule` — a read-then-write check that two callers can enter at
 * once is not a check.
 */
async function assertNoClash(
  params: {
    teamId: string;
    startsAt: Date;
    endsAt: Date;
    excludeId?: string | undefined;
  },
  tx: Db,
) {
  const clash = await repo.findOverlappingSession(params, tx);
  if (clash) {
    throw new ConflictError(
      `این تیم در همین بازه جلسه دیگری دارد: ${formatJalaliDateTime(clash.startsAt)}`,
      { sessionId: clash.id, startsAt: clash.startsAt, endsAt: clash.endsAt },
    );
  }
}

// --- sessions ---------------------------------------------------------------

export async function listTrainingSessions(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
  filters: TrainingSessionQuery = {},
) {
  requirePermission(caller, "training:read");

  const allowedTeamIds = await resolveScheduleTeamIds(caller);
  if (filters.teamId) assertWithinScope(allowedTeamIds, filters.teamId);

  const { items, total } = await repo.listSessions({
    ...filters,
    allowedTeamIds,
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

/** A week of the calendar. Same scope rule, no paging. */
export async function listTrainingWeek(
  caller: AuthorizedUser,
  from: Date,
  to: Date,
  teamId?: string,
) {
  requirePermission(caller, "training:read");

  const allowedTeamIds = await resolveScheduleTeamIds(caller);
  if (teamId) assertWithinScope(allowedTeamIds, teamId);

  return repo.listSessionsInRange({
    allowedTeamIds,
    ...(teamId ? { teamId } : {}),
    from,
    to,
  });
}

/** The teams whose calendar the caller may open — the filter's options. */
export async function listScheduleTeams(caller: AuthorizedUser) {
  requirePermission(caller, "training:read");
  return listTeamsByIds(await resolveScheduleTeamIds(caller));
}

export async function getTrainingSession(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "training:read");

  const session = await repo.findSessionById(id);
  if (!session) throw new NotFoundError("جلسه تمرین یافت نشد.");

  const allowedTeamIds = await resolveScheduleTeamIds(caller);
  assertWithinScope(allowedTeamIds, session.teamId);

  return session;
}

export async function createTrainingSession(
  caller: AuthorizedUser,
  input: CreateTrainingSessionInput,
) {
  requirePermission(caller, "training:write");

  const team = await requireWritableTeam(caller, input.teamId);
  const season = await requireSeasonFor(input.startsAt);
  const endsAt = sessionEnd(input.startsAt, input.durationMinutes);

  if (input.planId) await requireReadablePlan(caller, input.planId);

  const session = await runInTransaction(async (tx) => {
    await repo.lockTeamSchedule(input.teamId, tx);
    await assertNoClash(
      { teamId: input.teamId, startsAt: input.startsAt, endsAt },
      tx,
    );

    return repo.createSession(
      {
        teamId: input.teamId,
        seasonId: season.id,
        planId: input.planId,
        type: input.type,
        status: input.status,
        startsAt: input.startsAt,
        endsAt,
        location: input.location,
        notes: input.notes,
        createdById: caller.id,
      },
      tx,
    );
  });

  logger.info("training session created", {
    sessionId: session.id,
    teamId: team.id,
    startsAt: session.startsAt,
    actorId: caller.id,
  });

  return readSession(session.id);
}

export async function updateTrainingSession(
  caller: AuthorizedUser,
  id: string,
  input: UpdateTrainingSessionInput,
) {
  requirePermission(caller, "training:write");

  const session = await repo.findSessionById(id);
  if (!session) throw new NotFoundError("جلسه تمرین یافت نشد.");

  await requireWritableTeam(caller, session.teamId);

  if (FINAL_STATUSES.has(session.status)) {
    throw new ConflictError(
      "جلسه لغوشده قابل ویرایش نیست؛ در صورت نیاز جلسه تازه‌ای ثبت کنید.",
    );
  }

  const reschedules =
    input.startsAt !== undefined || input.durationMinutes !== undefined;

  // A session that has already been held cannot be moved. Its date is part of
  // the record of what happened — and from Phase 9 it is what the attendance
  // hangs on.
  if (reschedules && session.status === "COMPLETED") {
    throw new ConflictError(
      "جلسه برگزارشده جابه‌جا نمی‌شود؛ فقط یادداشت و برنامه آن قابل ویرایش است.",
    );
  }

  const startsAt = input.startsAt ?? session.startsAt;
  const minutes =
    input.durationMinutes ??
    durationMinutes({ startsAt: session.startsAt, endsAt: session.endsAt });
  const endsAt = sessionEnd(startsAt, minutes);

  if (input.planId) await requireReadablePlan(caller, input.planId);

  const data = {
    ...(input.type === undefined ? {} : { type: input.type }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(reschedules ? { startsAt, endsAt } : {}),
    ...(input.location === undefined ? {} : { location: input.location }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.planId === undefined
      ? {}
      : input.planId === null
        ? { plan: { disconnect: true } }
        : { plan: { connect: { id: input.planId } } }),
  };

  const updated = await runInTransaction(async (tx) => {
    if (reschedules) {
      await repo.lockTeamSchedule(session.teamId, tx);
      await assertNoClash(
        { teamId: session.teamId, startsAt, endsAt, excludeId: id },
        tx,
      );
    }

    return repo.updateSession(id, data, tx);
  });

  logger.info("training session updated", {
    sessionId: id,
    rescheduled: reschedules,
    status: updated.status,
    actorId: caller.id,
  });

  return readSession(id);
}

/**
 * Cancels a session.
 *
 * The row stays. A squad that turned up to a cancelled session is part of the
 * record, and so is the reason it was called off.
 */
export async function cancelTrainingSession(
  caller: AuthorizedUser,
  id: string,
  reason?: string,
) {
  requirePermission(caller, "training:write");

  const session = await repo.findSessionById(id);
  if (!session) throw new NotFoundError("جلسه تمرین یافت نشد.");

  await requireWritableTeam(caller, session.teamId);

  if (session.status === "CANCELLED") {
    throw new ConflictError("این جلسه پیش از این لغو شده است.");
  }

  logger.info("training session cancelled", {
    sessionId: id,
    teamId: session.teamId,
    actorId: caller.id,
  });

  await repo.updateSession(id, {
    status: "CANCELLED",
    ...(reason ? { cancelReason: reason } : {}),
  });

  return readSession(id);
}

// --- plans and exercises ----------------------------------------------------

/** A plan the caller may at least read: their team's, or the academy's. */
async function requireReadablePlan(caller: AuthorizedUser, planId: string) {
  const plan = await repo.findPlanById(planId);
  if (!plan) throw new NotFoundError("برنامه تمرین یافت نشد.");

  if (plan.teamId !== null) {
    const allowedTeamIds = await resolveScheduleTeamIds(caller);
    assertWithinScope(allowedTeamIds, plan.teamId);
  }

  return plan;
}

/**
 * A plan the caller may change.
 *
 * An academy-wide plan — one with no team — is everybody's, so only an
 * unscoped caller may touch it. A coach edits plans for their own teams.
 */
async function requireWritablePlan(caller: AuthorizedUser, planId: string) {
  const plan = await repo.findPlanById(planId);
  if (!plan) throw new NotFoundError("برنامه تمرین یافت نشد.");

  if (plan.teamId === null) {
    if (!isUnscoped(caller)) {
      throw new ValidationError(
        "برنامه عمومی آکادمی فقط توسط مدیر آکادمی ویرایش می‌شود.",
      );
    }
    return plan;
  }

  await requireWritableTeam(caller, plan.teamId);
  return plan;
}

export async function listTrainingPlans(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
  filters: { teamId?: string | undefined; includeInactive?: boolean } = {},
) {
  requirePermission(caller, "training:read");

  const allowedTeamIds = await resolveScheduleTeamIds(caller);
  if (filters.teamId) assertWithinScope(allowedTeamIds, filters.teamId);

  const { items, total } = await repo.listPlans({
    allowedTeamIds,
    ...(filters.teamId ? { teamId: filters.teamId } : {}),
    includeInactive: filters.includeInactive ?? false,
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

export async function getTrainingPlan(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "training:read");
  return requireReadablePlan(caller, id);
}

export async function createTrainingPlan(
  caller: AuthorizedUser,
  input: CreateTrainingPlanInput,
) {
  requirePermission(caller, "training:write");

  if (input.teamId) {
    await requireWritableTeam(caller, input.teamId);
  } else if (!isUnscoped(caller)) {
    // Otherwise a coach could publish a plan into every team's list.
    throw new ValidationError(
      "برنامه بدون تیم، برنامه عمومی آکادمی است و فقط مدیر آکادمی آن را ثبت می‌کند.",
    );
  }

  const plan = await repo.createPlan({
    teamId: input.teamId ?? null,
    title: input.title,
    description: input.description,
    type: input.type,
    createdById: caller.id,
    exercises: (input.exercises ?? []).map((exercise, index) => ({
      ...exercise,
      displayOrder: exercise.displayOrder ?? index,
    })),
  });

  logger.info("training plan created", {
    planId: plan.id,
    teamId: plan.teamId,
    exercises: plan.exercises.length,
    actorId: caller.id,
  });

  return plan;
}

export async function updateTrainingPlan(
  caller: AuthorizedUser,
  id: string,
  input: UpdateTrainingPlanInput,
) {
  requirePermission(caller, "training:write");
  await requireWritablePlan(caller, id);

  const plan = await repo.updatePlan(id, {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    ...(input.type === undefined ? {} : { type: input.type }),
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
  });

  logger.info("training plan updated", { planId: id, actorId: caller.id });
  return plan;
}

export async function addPlanExercise(
  caller: AuthorizedUser,
  planId: string,
  input: TrainingExerciseInput,
) {
  requirePermission(caller, "training:write");
  await requireWritablePlan(caller, planId);

  const displayOrder =
    input.displayOrder ?? (await repo.nextExerciseOrder(planId));

  return repo.addExercise({
    planId,
    title: input.title,
    description: input.description,
    durationMinutes: input.durationMinutes,
    focus: input.focus,
    displayOrder,
  });
}

export async function updatePlanExercise(
  caller: AuthorizedUser,
  exerciseId: string,
  input: Partial<TrainingExerciseInput>,
) {
  requirePermission(caller, "training:write");

  const exercise = await repo.findExerciseById(exerciseId);
  if (!exercise) throw new NotFoundError("تمرین یافت نشد.");
  await requireWritablePlan(caller, exercise.planId);

  return repo.updateExercise(exerciseId, {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    ...(input.durationMinutes === undefined
      ? {}
      : { durationMinutes: input.durationMinutes }),
    ...(input.focus === undefined ? {} : { focus: input.focus }),
    ...(input.displayOrder === undefined
      ? {}
      : { displayOrder: input.displayOrder }),
  });
}

export async function removePlanExercise(
  caller: AuthorizedUser,
  exerciseId: string,
) {
  requirePermission(caller, "training:write");

  const exercise = await repo.findExerciseById(exerciseId);
  if (!exercise) throw new NotFoundError("تمرین یافت نشد.");
  await requireWritablePlan(caller, exercise.planId);

  logger.info("training exercise removed", {
    exerciseId,
    planId: exercise.planId,
    actorId: caller.id,
  });

  return repo.deleteExercise(exerciseId);
}
