import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

const SESSION_INCLUDE = {
  team: {
    select: {
      id: true,
      name: true,
      slug: true,
      ageGroup: { select: { code: true, name: true } },
    },
  },
  season: { select: { id: true, name: true } },
  plan: { select: { id: true, title: true, type: true } },
} satisfies Prisma.TrainingSessionInclude;

const PLAN_INCLUDE = {
  team: { select: { id: true, name: true } },
  exercises: { orderBy: { displayOrder: "asc" } },
  _count: { select: { sessions: true } },
} satisfies Prisma.TrainingPlanInclude;

// --- sessions ---------------------------------------------------------------

/**
 * Builds the `where` for a session list.
 *
 * `allowedTeamIds` is applied **inside** the query, never after it: filtering
 * a page of results afterwards still leaks the true count through `meta.total`
 * (docs/PERMISSIONS.md §2).
 */
function sessionWhere(params: {
  allowedTeamIds: readonly string[] | null;
  teamId?: string | undefined;
  status?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}): Prisma.TrainingSessionWhereInput {
  const startsAt: Prisma.DateTimeFilter = {};
  if (params.from) startsAt.gte = params.from;
  if (params.to) startsAt.lt = params.to;

  return {
    ...(params.allowedTeamIds === null
      ? {}
      : { teamId: { in: [...params.allowedTeamIds] } }),
    ...(params.teamId ? { teamId: params.teamId } : {}),
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.from || params.to ? { startsAt } : {}),
  };
}

export async function listSessions(params: {
  allowedTeamIds: readonly string[] | null;
  teamId?: string | undefined;
  status?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  skip: number;
  take: number;
}) {
  const where = sessionWhere(params);

  const [items, total] = await prisma.$transaction([
    prisma.trainingSession.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { startsAt: "asc" },
      include: SESSION_INCLUDE,
    }),
    prisma.trainingSession.count({ where }),
  ]);

  return { items, total };
}

/** The calendar reads a whole week at once; no paging, but still scoped. */
export function listSessionsInRange(params: {
  allowedTeamIds: readonly string[] | null;
  teamId?: string | undefined;
  from: Date;
  to: Date;
}) {
  return prisma.trainingSession.findMany({
    where: sessionWhere(params),
    orderBy: { startsAt: "asc" },
    include: SESSION_INCLUDE,
  });
}

export function findSessionById(id: string) {
  return prisma.trainingSession.findUnique({
    where: { id },
    include: {
      ...SESSION_INCLUDE,
      plan: { include: { exercises: { orderBy: { displayOrder: "asc" } } } },
    },
  });
}

/**
 * The first session of the same team that shares any time with the span.
 *
 * Half-open comparison, matching `overlaps` in lib/services/training-time.ts:
 * a session that ends exactly when another begins is not a clash. Cancelled
 * sessions are ignored — the slot they held is free again.
 *
 * Selects columns rather than including relations, and not only for speed: a
 * read with nested relations inside an interactive transaction makes the
 * Prisma pg adapter issue a second query on a client that is still busy, which
 * node-postgres deprecates and pg 9 will reject outright. The check needs a
 * start time and an id, so there is nothing to include.
 */
export function findOverlappingSession(
  params: {
    teamId: string;
    startsAt: Date;
    endsAt: Date;
    excludeId?: string | undefined;
  },
  tx?: Db,
) {
  return dbOr(tx).trainingSession.findFirst({
    where: {
      teamId: params.teamId,
      status: { not: "CANCELLED" },
      startsAt: { lt: params.endsAt },
      endsAt: { gt: params.startsAt },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true, status: true },
  });
}

/**
 * Holds the schedule of one team for the rest of the transaction.
 *
 * The clash check is a read followed by a write, and two coaches saving at the
 * same moment can both read a free slot — the same race that once handed two
 * players the same code. An advisory lock keyed on the team serialises only
 * the sessions of that team, so the rest of the academy keeps writing.
 *
 * `pg_advisory_xact_lock` is released when the transaction ends, committed or
 * rolled back; there is nothing to unlock by hand.
 */
export async function lockTeamSchedule(teamId: string, tx: Db): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${teamId}, 0))`;
}

/**
 * Writes the row and returns it bare.
 *
 * No `include` on purpose. This runs inside the locked transaction, and a
 * query that needs several statements — which is what an `include` compiles to
 * — issued after `$executeRaw` on the same connection makes the pg adapter
 * reuse a client that is still busy. The caller re-reads the session with its
 * relations once the transaction has committed.
 */
export function createSession(
  data: {
    teamId: string;
    seasonId: string;
    planId?: string | undefined;
    type: Prisma.TrainingSessionCreateInput["type"];
    status: Prisma.TrainingSessionCreateInput["status"];
    startsAt: Date;
    endsAt: Date;
    location?: string | undefined;
    notes?: string | undefined;
    createdById?: string | undefined;
  },
  tx?: Db,
) {
  return dbOr(tx).trainingSession.create({
    data: {
      team: { connect: { id: data.teamId } },
      season: { connect: { id: data.seasonId } },
      ...(data.planId ? { plan: { connect: { id: data.planId } } } : {}),
      type: data.type,
      status: data.status,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      ...(data.location ? { location: data.location } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      ...(data.createdById ? { createdById: data.createdById } : {}),
    },
  });
}

/** Bare for the same reason as `createSession`. */
export function updateSession(
  id: string,
  data: Prisma.TrainingSessionUpdateInput,
  tx?: Db,
) {
  return dbOr(tx).trainingSession.update({ where: { id }, data });
}

export function countSessionsForTeam(teamId: string, from: Date, to: Date) {
  return prisma.trainingSession.count({
    where: {
      teamId,
      status: { not: "CANCELLED" },
      startsAt: { gte: from, lt: to },
    },
  });
}

// --- plans and exercises ----------------------------------------------------

export async function listPlans(params: {
  allowedTeamIds: readonly string[] | null;
  teamId?: string | undefined;
  includeInactive: boolean;
  skip: number;
  take: number;
}) {
  const where: Prisma.TrainingPlanWhereInput = {
    ...(params.includeInactive ? {} : { isActive: true }),
    ...(params.teamId ? { teamId: params.teamId } : {}),
    // A plan with no team belongs to the academy and is visible to everyone
    // who may read training at all.
    ...(params.allowedTeamIds === null || params.teamId
      ? {}
      : {
          OR: [
            { teamId: null },
            { teamId: { in: [...params.allowedTeamIds] } },
          ],
        }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.trainingPlan.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: PLAN_INCLUDE,
    }),
    prisma.trainingPlan.count({ where }),
  ]);

  return { items, total };
}

export function findPlanById(id: string) {
  return prisma.trainingPlan.findUnique({
    where: { id },
    include: PLAN_INCLUDE,
  });
}

export function createPlan(
  data: {
    teamId?: string | null | undefined;
    title: string;
    description?: string | undefined;
    type: Prisma.TrainingPlanCreateInput["type"];
    createdById?: string | undefined;
    exercises: ReadonlyArray<{
      title: string;
      description?: string | undefined;
      durationMinutes?: number | undefined;
      focus?: string | undefined;
      displayOrder: number;
    }>;
  },
  tx?: Db,
) {
  return dbOr(tx).trainingPlan.create({
    data: {
      ...(data.teamId ? { team: { connect: { id: data.teamId } } } : {}),
      title: data.title,
      ...(data.description ? { description: data.description } : {}),
      type: data.type,
      ...(data.createdById ? { createdById: data.createdById } : {}),
      exercises: {
        create: data.exercises.map((exercise) => ({
          title: exercise.title,
          displayOrder: exercise.displayOrder,
          ...(exercise.description
            ? { description: exercise.description }
            : {}),
          ...(exercise.durationMinutes === undefined
            ? {}
            : { durationMinutes: exercise.durationMinutes }),
          ...(exercise.focus ? { focus: exercise.focus } : {}),
        })),
      },
    },
    include: PLAN_INCLUDE,
  });
}

export function updatePlan(id: string, data: Prisma.TrainingPlanUpdateInput) {
  return prisma.trainingPlan.update({
    where: { id },
    data,
    include: PLAN_INCLUDE,
  });
}

export async function nextExerciseOrder(planId: string): Promise<number> {
  const last = await prisma.trainingExercise.findFirst({
    where: { planId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  return (last?.displayOrder ?? -1) + 1;
}

export function addExercise(data: {
  planId: string;
  title: string;
  description?: string | undefined;
  durationMinutes?: number | undefined;
  focus?: string | undefined;
  displayOrder: number;
}) {
  return prisma.trainingExercise.create({
    data: {
      plan: { connect: { id: data.planId } },
      title: data.title,
      displayOrder: data.displayOrder,
      ...(data.description ? { description: data.description } : {}),
      ...(data.durationMinutes === undefined
        ? {}
        : { durationMinutes: data.durationMinutes }),
      ...(data.focus ? { focus: data.focus } : {}),
    },
  });
}

export function findExerciseById(id: string) {
  return prisma.trainingExercise.findUnique({
    where: { id },
    include: { plan: { select: { id: true, teamId: true, title: true } } },
  });
}

export function updateExercise(
  id: string,
  data: Prisma.TrainingExerciseUpdateInput,
) {
  return prisma.trainingExercise.update({ where: { id }, data });
}

/**
 * Removes an exercise.
 *
 * The one deletion in this module, and it is deliberate: an exercise is a line
 * in a plan the coach is still writing, not a record of something that
 * happened. What happened is carried by the session (CLAUDE.md §2).
 */
export function deleteExercise(id: string) {
  return prisma.trainingExercise.delete({ where: { id } });
}
