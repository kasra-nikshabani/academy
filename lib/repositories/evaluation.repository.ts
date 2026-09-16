import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

const TEMPLATE_INCLUDE = {
  sport: { select: { id: true, name: true } },
  ageGroup: { select: { id: true, code: true, name: true } },
  criteria: { orderBy: { displayOrder: "asc" } },
  _count: { select: { evaluations: true } },
} satisfies Prisma.EvaluationTemplateInclude;

const EVALUATION_INCLUDE = {
  player: {
    select: {
      id: true,
      playerCode: true,
      person: {
        select: { firstName: true, lastName: true, dateOfBirth: true },
      },
    },
  },
  evaluator: {
    select: {
      id: true,
      person: { select: { firstName: true, lastName: true } },
    },
  },
  template: {
    select: {
      id: true,
      title: true,
      criteria: { orderBy: { displayOrder: "asc" } },
    },
  },
  scores: true,
  application: {
    select: {
      id: true,
      trackingCode: true,
      tryout: { select: { id: true, title: true } },
    },
  },
} satisfies Prisma.EvaluationInclude;

// --- templates --------------------------------------------------------------

export function listTemplates(params: {
  sportId?: string | undefined;
  includeInactive: boolean;
}) {
  return prisma.evaluationTemplate.findMany({
    where: {
      ...(params.sportId ? { sportId: params.sportId } : {}),
      ...(params.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: TEMPLATE_INCLUDE,
  });
}

export function findTemplateById(id: string) {
  return prisma.evaluationTemplate.findUnique({
    where: { id },
    include: TEMPLATE_INCLUDE,
  });
}

/**
 * Writes the row, then reads it back with its relations.
 *
 * The read is a second query on purpose. An `include` carrying several
 * relations — or a `_count`, which is its own aggregate — makes Prisma answer
 * the write with more than one statement, and it wraps those in an implicit
 * transaction. The pg adapter then issues the second statement on a client
 * that is still busy, which node-postgres deprecates and pg 9 will reject.
 * Splitting the write from the read costs one round trip on a rare path and
 * keeps the driver on the supported road (docs/ARCHITECTURE.md §6.8).
 */
export function createTemplate(data: {
  sportId: string;
  ageGroupId?: string | null | undefined;
  title: string;
  description?: string | undefined;
  createdById?: string | undefined;
  criteria: ReadonlyArray<{
    dimension: Prisma.EvaluationCriterionCreateInput["dimension"];
    title: string;
    description?: string | undefined;
    maxScore: number;
    weight: number;
    displayOrder: number;
  }>;
}) {
  return createTemplateRow(data).then((row) =>
    prisma.evaluationTemplate.findUniqueOrThrow({
      where: { id: row.id },
      include: TEMPLATE_INCLUDE,
    }),
  );
}

function createTemplateRow(data: {
  sportId: string;
  ageGroupId?: string | null | undefined;
  title: string;
  description?: string | undefined;
  createdById?: string | undefined;
  criteria: ReadonlyArray<{
    dimension: Prisma.EvaluationCriterionCreateInput["dimension"];
    title: string;
    description?: string | undefined;
    maxScore: number;
    weight: number;
    displayOrder: number;
  }>;
}) {
  return prisma.evaluationTemplate.create({
    data: {
      sport: { connect: { id: data.sportId } },
      ...(data.ageGroupId
        ? { ageGroup: { connect: { id: data.ageGroupId } } }
        : {}),
      title: data.title,
      ...(data.description ? { description: data.description } : {}),
      ...(data.createdById ? { createdById: data.createdById } : {}),
      criteria: {
        create: data.criteria.map((criterion) => ({
          dimension: criterion.dimension,
          title: criterion.title,
          ...(criterion.description
            ? { description: criterion.description }
            : {}),
          maxScore: criterion.maxScore,
          weight: criterion.weight,
          displayOrder: criterion.displayOrder,
        })),
      },
    },
    select: { id: true },
  });
}

// --- evaluations ------------------------------------------------------------

export function listEvaluations(params: {
  evaluatorId?: string | undefined;
  allowedPlayerIds?: readonly string[] | null;
  status?: string | undefined;
  playerId?: string | undefined;
  applicationId?: string | undefined;
}) {
  const where: Prisma.EvaluationWhereInput = {
    ...(params.evaluatorId ? { evaluatorId: params.evaluatorId } : {}),
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.playerId ? { playerId: params.playerId } : {}),
    ...(params.applicationId ? { applicationId: params.applicationId } : {}),
  };

  // A caller narrowed to a set of players sees their evaluations and no more;
  // one narrowed to nothing sees only what is assigned to them, which the
  // service supplies as `evaluatorId`.
  if (params.allowedPlayerIds != null && !params.evaluatorId) {
    where.playerId = { in: [...params.allowedPlayerIds] };
  }

  return prisma.evaluation.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: EVALUATION_INCLUDE,
  });
}

/**
 * Evaluations assigned to a staff member **or** about a player they can
 * already see. Written as one `OR` rather than two queries so the list comes
 * back in one order, already paged by the database.
 */
export function listEvaluationsForCoach(params: {
  evaluatorId: string;
  allowedPlayerIds: readonly string[];
  status?: string | undefined;
}) {
  return prisma.evaluation.findMany({
    where: {
      ...(params.status ? { status: params.status as never } : {}),
      OR: [
        { evaluatorId: params.evaluatorId },
        ...(params.allowedPlayerIds.length > 0
          ? [{ playerId: { in: [...params.allowedPlayerIds] } }]
          : []),
      ],
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: EVALUATION_INCLUDE,
  });
}

export function findEvaluationById(id: string) {
  return prisma.evaluation.findUnique({
    where: { id },
    include: EVALUATION_INCLUDE,
  });
}

export function findEvaluationsForPlayer(playerId: string) {
  return prisma.evaluation.findMany({
    where: { playerId, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    include: EVALUATION_INCLUDE,
  });
}

/** Bare, then re-read — see the note on `createTemplate`. */
export async function createEvaluation(data: {
  playerId: string;
  templateId: string;
  evaluatorId: string;
  assignedById?: string | undefined;
  applicationId?: string | undefined;
  trainingSessionId?: string | undefined;
}) {
  const created = await prisma.evaluation.create({
    data: {
      player: { connect: { id: data.playerId } },
      template: { connect: { id: data.templateId } },
      evaluator: { connect: { id: data.evaluatorId } },
      ...(data.assignedById ? { assignedById: data.assignedById } : {}),
      ...(data.applicationId
        ? { application: { connect: { id: data.applicationId } } }
        : {}),
      ...(data.trainingSessionId
        ? { trainingSession: { connect: { id: data.trainingSessionId } } }
        : {}),
    },
    select: { id: true },
  });

  return prisma.evaluation.findUniqueOrThrow({
    where: { id: created.id },
    include: EVALUATION_INCLUDE,
  });
}

export function upsertScore(
  data: {
    evaluationId: string;
    criterionId: string;
    score: number;
    note?: string | undefined;
  },
  tx?: Db,
) {
  return dbOr(tx).evaluationScore.upsert({
    where: {
      evaluationId_criterionId: {
        evaluationId: data.evaluationId,
        criterionId: data.criterionId,
      },
    },
    update: { score: data.score, note: data.note ?? null },
    create: {
      evaluationId: data.evaluationId,
      criterionId: data.criterionId,
      score: data.score,
      note: data.note ?? null,
    },
  });
}

export function updateEvaluation(
  id: string,
  data: Prisma.EvaluationUpdateInput,
  tx?: Db,
) {
  return dbOr(tx).evaluation.update({ where: { id }, data });
}

/** Scores with their criterion, for computing an overall. */
export function listScoresWithCriteria(evaluationId: string, tx?: Db) {
  return dbOr(tx).evaluationScore.findMany({
    where: { evaluationId },
    select: {
      score: true,
      criterion: {
        select: { maxScore: true, weight: true, dimension: true },
      },
    },
  });
}

/** The evaluation summary shown beside a tryout application. */
export async function summariseForApplications(applicationIds: string[]) {
  if (applicationIds.length === 0)
    return new Map<string, { submitted: number; average: number | null }>();

  const rows = await prisma.evaluation.findMany({
    where: { applicationId: { in: applicationIds }, status: "SUBMITTED" },
    select: { applicationId: true, overallScore: true },
  });

  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.applicationId) continue;
    const bucket = grouped.get(row.applicationId) ?? [];
    if (row.overallScore !== null) bucket.push(row.overallScore);
    grouped.set(row.applicationId, bucket);
  }

  return new Map(
    [...grouped].map(([applicationId, scores]) => [
      applicationId,
      {
        submitted: scores.length,
        average:
          scores.length === 0
            ? null
            : Math.round(
                (scores.reduce((sum, value) => sum + value, 0) /
                  scores.length) *
                  10,
              ) / 10,
      },
    ]),
  );
}
