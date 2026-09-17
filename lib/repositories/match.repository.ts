import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

const MATCH_INCLUDE = {
  team: {
    select: {
      id: true,
      name: true,
      slug: true,
      ageGroup: { select: { code: true, name: true } },
    },
  },
  season: { select: { id: true, name: true } },
  _count: { select: { lineup: true } },
} satisfies Prisma.MatchInclude;

const PLAYER_SELECT = {
  id: true,
  playerCode: true,
  person: { select: { firstName: true, lastName: true } },
} satisfies Prisma.PlayerSelect;

function matchWhere(params: {
  allowedTeamIds: readonly string[] | null;
  teamId?: string | undefined;
  status?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}): Prisma.MatchWhereInput {
  const kickoffAt: Prisma.DateTimeFilter = {};
  if (params.from) kickoffAt.gte = params.from;
  if (params.to) kickoffAt.lt = params.to;

  return {
    // Narrowed inside the query; a post-filter leaks the count
    // (docs/PERMISSIONS.md §2).
    ...(params.allowedTeamIds === null
      ? {}
      : { teamId: { in: [...params.allowedTeamIds] } }),
    ...(params.teamId ? { teamId: params.teamId } : {}),
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.from || params.to ? { kickoffAt } : {}),
  };
}

export async function listMatches(params: {
  allowedTeamIds: readonly string[] | null;
  teamId?: string | undefined;
  status?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  skip: number;
  take: number;
}) {
  const where = matchWhere(params);

  // Paired, not transactional — see the note in ./transaction.ts.
  const [items, total] = await Promise.all([
    prisma.match.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { kickoffAt: "desc" },
      include: MATCH_INCLUDE,
    }),
    prisma.match.count({ where }),
  ]);

  return { items, total };
}

export function findMatchById(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      ...MATCH_INCLUDE,
      lineup: {
        orderBy: [{ role: "asc" }, { shirtNumber: "asc" }],
        include: { player: { select: PLAYER_SELECT } },
      },
      stats: {
        orderBy: { minutesPlayed: "desc" },
        include: { player: { select: PLAYER_SELECT } },
      },
    },
  });
}

/**
 * The first match of the same team sharing any time with the span.
 *
 * Half-open, so a fixture that kicks off exactly when another ends is not a
 * clash. Cancelled and postponed fixtures are ignored — the slot they held is
 * free again.
 *
 * Selects columns rather than relations: this runs inside the locked
 * transaction, and a relation read there makes the pg adapter reuse a busy
 * client (docs/ARCHITECTURE.md §6.8).
 */
export function findOverlappingMatch(
  params: {
    teamId: string;
    kickoffAt: Date;
    endsAt: Date;
    excludeId?: string | undefined;
  },
  tx?: Db,
) {
  return dbOr(tx).match.findFirst({
    where: {
      teamId: params.teamId,
      status: { notIn: ["CANCELLED", "POSTPONED"] },
      kickoffAt: { lt: params.endsAt },
      endsAt: { gt: params.kickoffAt },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: { id: true, kickoffAt: true, endsAt: true, opponent: true },
  });
}

/** Serialises fixture changes for one team — see `lockTeamSchedule`. */
export async function lockTeamFixtures(teamId: string, tx: Db): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`match:${teamId}`}, 0))`;
}

export function createMatch(
  data: {
    teamId: string;
    seasonId: string;
    opponent: string;
    competition?: string | undefined;
    homeAway: Prisma.MatchCreateInput["homeAway"];
    venue?: string | undefined;
    kickoffAt: Date;
    endsAt: Date;
    status: Prisma.MatchCreateInput["status"];
    notes?: string | undefined;
    createdById?: string | undefined;
  },
  tx?: Db,
) {
  return dbOr(tx).match.create({
    data: {
      team: { connect: { id: data.teamId } },
      season: { connect: { id: data.seasonId } },
      opponent: data.opponent,
      ...(data.competition ? { competition: data.competition } : {}),
      homeAway: data.homeAway,
      ...(data.venue ? { venue: data.venue } : {}),
      kickoffAt: data.kickoffAt,
      endsAt: data.endsAt,
      status: data.status,
      ...(data.notes ? { notes: data.notes } : {}),
      ...(data.createdById ? { createdById: data.createdById } : {}),
    },
    select: { id: true },
  });
}

export function updateMatch(
  id: string,
  data: Prisma.MatchUpdateInput,
  tx?: Db,
) {
  return dbOr(tx).match.update({ where: { id }, data, select: { id: true } });
}

// --- team sheet -------------------------------------------------------------

export function listLineup(matchId: string, tx?: Db) {
  return dbOr(tx).matchLineup.findMany({
    where: { matchId },
    select: { playerId: true, role: true },
  });
}

/**
 * Replaces the whole team sheet.
 *
 * What arrives **is** the lineup: anyone missing from it is removed. That is
 * what redrawing a team sheet means, and the alternative — a second endpoint
 * for removals — is one somebody forgets to call.
 */
export async function replaceLineup(
  matchId: string,
  entries: ReadonlyArray<{
    playerId: string;
    role: Prisma.MatchLineupCreateInput["role"];
    shirtNumber?: number | undefined;
    position?: string | undefined;
  }>,
  tx: Db,
) {
  const keep = entries.map((entry) => entry.playerId);

  await tx.matchLineup.deleteMany({
    where: { matchId, ...(keep.length > 0 ? { playerId: { notIn: keep } } : {}) },
  });

  for (const entry of entries) {
    await tx.matchLineup.upsert({
      where: { matchId_playerId: { matchId, playerId: entry.playerId } },
      update: {
        role: entry.role,
        shirtNumber: entry.shirtNumber ?? null,
        position: entry.position ?? null,
      },
      create: {
        matchId,
        playerId: entry.playerId,
        role: entry.role,
        shirtNumber: entry.shirtNumber ?? null,
        position: entry.position ?? null,
      },
    });
  }
}

// --- statistics -------------------------------------------------------------

export function upsertStat(
  data: {
    matchId: string;
    playerId: string;
    minutesPlayed: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    notes?: string | undefined;
    recordedById?: string | undefined;
  },
  tx?: Db,
) {
  const fields = {
    minutesPlayed: data.minutesPlayed,
    goals: data.goals,
    assists: data.assists,
    yellowCards: data.yellowCards,
    redCards: data.redCards,
    notes: data.notes ?? null,
    recordedAt: new Date(),
    recordedById: data.recordedById ?? null,
  };

  return dbOr(tx).playerMatchStat.upsert({
    where: {
      matchId_playerId: { matchId: data.matchId, playerId: data.playerId },
    },
    update: fields,
    create: { matchId: data.matchId, playerId: data.playerId, ...fields },
  });
}

/** One player's matches, newest first — what a player or parent may read. */
export function listStatsForPlayer(params: {
  playerId: string;
  seasonId?: string | undefined;
  take?: number | undefined;
}) {
  return prisma.playerMatchStat.findMany({
    where: {
      playerId: params.playerId,
      ...(params.seasonId ? { match: { seasonId: params.seasonId } } : {}),
    },
    orderBy: { match: { kickoffAt: "desc" } },
    ...(params.take === undefined ? {} : { take: params.take }),
    include: {
      match: {
        select: {
          id: true,
          opponent: true,
          competition: true,
          homeAway: true,
          kickoffAt: true,
          status: true,
          goalsFor: true,
          goalsAgainst: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/** Whether each of those matches was a start — read from the team sheet. */
export async function findStartedMatchIds(
  playerId: string,
  matchIds: readonly string[],
): Promise<Set<string>> {
  if (matchIds.length === 0) return new Set();

  const rows = await prisma.matchLineup.findMany({
    where: { playerId, matchId: { in: [...matchIds] }, role: "STARTER" },
    select: { matchId: true },
  });

  return new Set(rows.map((row) => row.matchId));
}

/** Completed results for a team, for the record summary. */
export function listResultsForTeam(params: {
  teamId: string;
  seasonId?: string | undefined;
}) {
  return prisma.match.findMany({
    where: {
      teamId: params.teamId,
      ...(params.seasonId ? { seasonId: params.seasonId } : {}),
    },
    orderBy: { kickoffAt: "desc" },
    select: { status: true, goalsFor: true, goalsAgainst: true },
  });
}
