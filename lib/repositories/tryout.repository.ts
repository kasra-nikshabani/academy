import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

const TRYOUT_INCLUDE = {
  sport: { select: { id: true, name: true, slug: true } },
  ageGroup: { select: { id: true, code: true, name: true, minAge: true, maxAge: true } },
  season: { select: { id: true, name: true, startYear: true } },
  _count: { select: { applications: true } },
} satisfies Prisma.TryoutInclude;

const APPLICATION_INCLUDE = {
  player: {
    select: {
      id: true,
      playerCode: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          mobile: true,
          city: true,
        },
      },
    },
  },
  screening: true,
} satisfies Prisma.TryoutApplicationInclude;

// --- tryouts ----------------------------------------------------------------

export async function listTryouts(params: {
  status?: string | undefined;
  sportId?: string | undefined;
  /** Public listing: only what a visitor is allowed to find. */
  publicOnly?: boolean;
  skip: number;
  take: number;
}) {
  const where: Prisma.TryoutWhereInput = {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.sportId ? { sportId: params.sportId } : {}),
    ...(params.publicOnly ? { status: { in: ["OPEN", "CLOSED"] } } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.tryout.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: [{ status: "asc" }, { opensAt: "desc" }],
      include: TRYOUT_INCLUDE,
    }),
    prisma.tryout.count({ where }),
  ]);

  return { items, total };
}

export function findTryoutById(id: string) {
  return prisma.tryout.findUnique({ where: { id }, include: TRYOUT_INCLUDE });
}

export function findTryoutBySlug(slug: string) {
  return prisma.tryout.findUnique({
    where: { slug },
    include: TRYOUT_INCLUDE,
  });
}

export function createTryout(data: Prisma.TryoutCreateInput) {
  return prisma.tryout.create({ data, include: TRYOUT_INCLUDE });
}

export function updateTryout(id: string, data: Prisma.TryoutUpdateInput) {
  return prisma.tryout.update({
    where: { id },
    data,
    include: TRYOUT_INCLUDE,
  });
}

// --- applications -----------------------------------------------------------

export function listApplications(params: {
  tryoutId: string;
  status?: string | undefined;
}) {
  return prisma.tryoutApplication.findMany({
    where: {
      tryoutId: params.tryoutId,
      ...(params.status ? { status: params.status as never } : {}),
    },
    orderBy: { submittedAt: "asc" },
    include: APPLICATION_INCLUDE,
  });
}

export function findApplicationById(id: string) {
  return prisma.tryoutApplication.findUnique({
    where: { id },
    include: {
      ...APPLICATION_INCLUDE,
      tryout: { include: TRYOUT_INCLUDE },
    },
  });
}

export function findApplication(tryoutId: string, playerId: string) {
  return prisma.tryoutApplication.findUnique({
    where: { tryoutId_playerId: { tryoutId, playerId } },
  });
}

/**
 * The public status lookup: tracking code **and** the number it was
 * registered with. The code alone is unguessable, but requiring both means a
 * code seen over someone's shoulder still reveals nothing.
 */
export function findApplicationForTracking(
  trackingCode: string,
  mobile: string,
) {
  return prisma.tryoutApplication.findFirst({
    where: {
      trackingCode,
      OR: [
        { player: { person: { mobile } } },
        { player: { guardians: { some: { guardian: { person: { mobile } } } } } },
      ],
    },
    select: {
      trackingCode: true,
      status: true,
      submittedAt: true,
      decidedAt: true,
      decisionNote: true,
      screening: { select: { status: true, note: true } },
      tryout: {
        select: {
          title: true,
          slug: true,
          heldAt: true,
          venue: true,
          city: true,
        },
      },
      player: { select: { person: { select: { firstName: true, lastName: true } } } },
    },
  });
}

export function createApplication(
  data: {
    tryoutId: string;
    playerId: string;
    trackingCode: string;
    position?: string | undefined;
    dominantFoot?: string | undefined;
    heightCm?: number | undefined;
    weightKg?: number | undefined;
    previousClub?: string | undefined;
    notes?: string | undefined;
  },
  tx?: Db,
) {
  return dbOr(tx).tryoutApplication.create({
    data: {
      tryoutId: data.tryoutId,
      playerId: data.playerId,
      trackingCode: data.trackingCode,
      ...(data.position ? { position: data.position } : {}),
      ...(data.dominantFoot ? { dominantFoot: data.dominantFoot } : {}),
      ...(data.heightCm === undefined ? {} : { heightCm: data.heightCm }),
      ...(data.weightKg === undefined ? {} : { weightKg: data.weightKg }),
      ...(data.previousClub ? { previousClub: data.previousClub } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      // Every application starts its paperwork check waiting for a human.
      screening: { create: {} },
    },
  });
}

export function updateApplication(
  id: string,
  data: Prisma.TryoutApplicationUpdateInput,
  tx?: Db,
) {
  return dbOr(tx).tryoutApplication.update({ where: { id }, data });
}

export function upsertScreening(
  applicationId: string,
  data: {
    status: Prisma.ScreeningCreateInput["status"];
    ageEligible?: boolean | undefined;
    documentsComplete?: boolean | undefined;
    note?: string | undefined;
    checkedById?: string | undefined;
  },
  tx?: Db,
) {
  const fields = {
    status: data.status,
    ageEligible: data.ageEligible ?? null,
    documentsComplete: data.documentsComplete ?? null,
    note: data.note ?? null,
    checkedById: data.checkedById ?? null,
    checkedAt: new Date(),
  };

  return dbOr(tx).screening.upsert({
    where: { applicationId },
    update: fields,
    create: { applicationId, ...fields },
  });
}

/**
 * The funnel the academy manager watches: how many applications are at each
 * stage of one trial. Counted in the database rather than by loading every
 * application and grouping in memory.
 */
export async function countApplicationsByStatus(tryoutId: string) {
  const rows = await prisma.tryoutApplication.groupBy({
    by: ["status"],
    where: { tryoutId },
    _count: { _all: true },
  });

  return Object.fromEntries(
    rows.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<string, number>>;
}

export function countPendingScreenings(tryoutId: string) {
  return prisma.tryoutApplication.count({
    where: { tryoutId, screening: { status: "PENDING" } },
  });
}
