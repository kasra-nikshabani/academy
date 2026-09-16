import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

// --- scope source -----------------------------------------------------------

/**
 * Players belonging to any of the given teams in the active season.
 *
 * This is what widens a coach's reach from "my teams" to "the players in my
 * teams" (docs/PERMISSIONS.md §5). Released and inactive memberships are
 * excluded — a coach keeps the history of a squad, not access to a player who
 * has left it.
 */
export async function findPlayerIdsInTeams(
  teamIds: readonly string[],
  seasonId: string,
): Promise<string[]> {
  if (teamIds.length === 0) return [];

  const rows = await prisma.teamMembership.findMany({
    where: {
      teamId: { in: [...teamIds] },
      seasonId,
      status: "ACTIVE",
      leftAt: null,
    },
    select: { playerId: true },
  });

  return [...new Set(rows.map((row) => row.playerId))];
}

/**
 * The teams a given set of players belong to in a season.
 *
 * The mirror of `findPlayerIdsInTeams`, and what lets a player or a parent see
 * a training calendar at all: they hold no `StaffTeam` row, so their team
 * reach has to come from the squads they are actually in.
 */
export async function findTeamIdsForPlayers(
  playerIds: readonly string[],
  seasonId: string,
): Promise<string[]> {
  if (playerIds.length === 0) return [];

  const rows = await prisma.teamMembership.findMany({
    where: {
      playerId: { in: [...playerIds] },
      seasonId,
      status: "ACTIVE",
      leftAt: null,
    },
    select: { teamId: true },
  });

  return [...new Set(rows.map((row) => row.teamId))];
}

// --- school enrolment -------------------------------------------------------

export function findSchoolEnrollment(
  playerId: string,
  schoolId: string,
  seasonId: string,
) {
  return prisma.schoolEnrollment.findUnique({
    where: {
      playerId_schoolId_seasonId: { playerId, schoolId, seasonId },
    },
  });
}

export function listEnrollmentsForPlayer(playerId: string) {
  return prisma.schoolEnrollment.findMany({
    where: { playerId },
    orderBy: { createdAt: "desc" },
    include: {
      school: { select: { id: true, name: true } },
      season: { select: { id: true, name: true, startYear: true } },
    },
  });
}

export async function listEnrollments(params: {
  schoolId?: string | undefined;
  seasonId?: string | undefined;
  status?: string | undefined;
  allowedPlayerIds: readonly string[] | null;
  skip: number;
  take: number;
}) {
  const where: Prisma.SchoolEnrollmentWhereInput = {
    ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    ...(params.seasonId ? { seasonId: params.seasonId } : {}),
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.allowedPlayerIds === null
      ? {}
      : { playerId: { in: [...params.allowedPlayerIds] } }),
  };

  // Paired, not transactional — see the note in ./transaction.ts.
  const [items, total] = await Promise.all([
    prisma.schoolEnrollment.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" },
      include: {
        player: {
          include: { person: { select: { firstName: true, lastName: true } } },
        },
        school: { select: { id: true, name: true } },
        season: { select: { id: true, name: true } },
      },
    }),
    prisma.schoolEnrollment.count({ where }),
  ]);

  return { items, total };
}

export function createSchoolEnrollment(
  data: {
    playerId: string;
    schoolId: string;
    seasonId: string;
    status: Prisma.SchoolEnrollmentCreateInput["status"];
    notes?: string | undefined;
  },
  tx?: Db,
) {
  return dbOr(tx).schoolEnrollment.create({
    data: {
      player: { connect: { id: data.playerId } },
      school: { connect: { id: data.schoolId } },
      season: { connect: { id: data.seasonId } },
      status: data.status,
      ...(data.notes ? { notes: data.notes } : {}),
    },
    include: {
      school: { select: { id: true, name: true } },
      season: { select: { id: true, name: true } },
    },
  });
}

export function updateSchoolEnrollment(
  id: string,
  data: Prisma.SchoolEnrollmentUpdateInput,
  tx?: Db,
) {
  return dbOr(tx).schoolEnrollment.update({
    where: { id },
    data,
    include: {
      school: { select: { id: true, name: true } },
      season: { select: { id: true, name: true } },
    },
  });
}

export function findEnrollmentById(id: string) {
  return prisma.schoolEnrollment.findUnique({
    where: { id },
    include: { school: true, season: true },
  });
}

// --- team membership --------------------------------------------------------

export function listMembershipsForPlayer(playerId: string) {
  return prisma.teamMembership.findMany({
    where: { playerId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    include: {
      team: {
        select: {
          id: true,
          name: true,
          ageGroup: { select: { code: true, name: true } },
        },
      },
      season: { select: { id: true, name: true, startYear: true } },
    },
  });
}

export async function listTeamRoster(params: {
  teamId: string;
  seasonId: string;
}) {
  return prisma.teamMembership.findMany({
    where: {
      teamId: params.teamId,
      seasonId: params.seasonId,
      status: "ACTIVE",
      leftAt: null,
    },
    orderBy: { jerseyNumber: "asc" },
    include: {
      player: {
        include: {
          person: {
            select: { firstName: true, lastName: true, dateOfBirth: true },
          },
        },
      },
    },
  });
}

export function findMembership(
  playerId: string,
  teamId: string,
  seasonId: string,
) {
  return prisma.teamMembership.findUnique({
    where: { playerId_teamId_seasonId: { playerId, teamId, seasonId } },
  });
}

export function findMembershipById(id: string) {
  return prisma.teamMembership.findUnique({
    where: { id },
    include: { team: true, season: true },
  });
}

/**
 * Creates or reactivates a membership.
 *
 * When the new membership is primary, any other primary for that player and
 * season is demoted in the same transaction — a player with two "home" teams
 * would make attendance and reporting ambiguous.
 */
export async function upsertMembership(
  data: {
    playerId: string;
    teamId: string;
    seasonId: string;
    isPrimary: boolean;
    jerseyNumber?: number | undefined;
    notes?: string | undefined;
  },
  tx?: Db,
) {
  const db = dbOr(tx);

  if (data.isPrimary) {
    await db.teamMembership.updateMany({
      where: {
        playerId: data.playerId,
        seasonId: data.seasonId,
        isPrimary: true,
        teamId: { not: data.teamId },
      },
      data: { isPrimary: false },
    });
  }

  return db.teamMembership.upsert({
    where: {
      playerId_teamId_seasonId: {
        playerId: data.playerId,
        teamId: data.teamId,
        seasonId: data.seasonId,
      },
    },
    update: {
      status: "ACTIVE",
      leftAt: null,
      isPrimary: data.isPrimary,
      ...(data.jerseyNumber === undefined
        ? {}
        : { jerseyNumber: data.jerseyNumber }),
      ...(data.notes === undefined ? {} : { notes: data.notes }),
    },
    create: {
      playerId: data.playerId,
      teamId: data.teamId,
      seasonId: data.seasonId,
      isPrimary: data.isPrimary,
      ...(data.jerseyNumber === undefined
        ? {}
        : { jerseyNumber: data.jerseyNumber }),
      ...(data.notes === undefined ? {} : { notes: data.notes }),
    },
    include: {
      team: { select: { id: true, name: true } },
      season: { select: { id: true, name: true } },
    },
  });
}

/** Ends a membership without deleting it — the squad history stays. */
export function endMembership(
  id: string,
  status: "INACTIVE" | "RELEASED",
  tx?: Db,
) {
  return dbOr(tx).teamMembership.update({
    where: { id },
    data: { status, leftAt: new Date(), isPrimary: false },
    include: {
      team: { select: { id: true, name: true } },
      season: { select: { id: true, name: true } },
    },
  });
}

export function countActiveMemberships(playerId: string, seasonId: string) {
  return prisma.teamMembership.count({
    where: { playerId, seasonId, status: "ACTIVE", leftAt: null },
  });
}
