import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

const PLAYER_SELECT = {
  id: true,
  playerCode: true,
  person: { select: { firstName: true, lastName: true } },
} satisfies Prisma.PlayerSelect;

/** Every row for one session, in squad-number order like the team sheet. */
export function listForSession(trainingSessionId: string) {
  return prisma.attendance.findMany({
    where: { trainingSessionId },
    orderBy: { player: { playerCode: "asc" } },
    include: { player: { select: PLAYER_SELECT } },
  });
}

/** One player's row for one session — what a parent is allowed to read. */
export function findOne(trainingSessionId: string, playerId: string) {
  return prisma.attendance.findUnique({
    where: {
      trainingSessionId_playerId: { trainingSessionId, playerId },
    },
  });
}

/**
 * A player's register across sessions, newest session first.
 *
 * Narrowed by season or team when asked; the session carries both, so neither
 * needs to be copied onto the attendance row.
 */
export function listForPlayer(params: {
  playerId: string;
  seasonId?: string | undefined;
  teamId?: string | undefined;
  take?: number | undefined;
}) {
  return prisma.attendance.findMany({
    where: {
      playerId: params.playerId,
      ...(params.seasonId || params.teamId
        ? {
            trainingSession: {
              ...(params.seasonId ? { seasonId: params.seasonId } : {}),
              ...(params.teamId ? { teamId: params.teamId } : {}),
            },
          }
        : {}),
    },
    orderBy: { trainingSession: { startsAt: "desc" } },
    ...(params.take === undefined ? {} : { take: params.take }),
    include: {
      trainingSession: {
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          type: true,
          status: true,
          team: { select: { id: true, name: true } },
          season: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/** Just the statuses, for counting. Cheaper than fetching whole rows. */
export async function listStatusesForPlayer(params: {
  playerId: string;
  seasonId?: string | undefined;
  teamId?: string | undefined;
}) {
  const rows = await prisma.attendance.findMany({
    where: {
      playerId: params.playerId,
      ...(params.seasonId || params.teamId
        ? {
            trainingSession: {
              ...(params.seasonId ? { seasonId: params.seasonId } : {}),
              ...(params.teamId ? { teamId: params.teamId } : {}),
            },
          }
        : {}),
    },
    select: { status: true },
  });
  return rows.map((row) => row.status);
}

/**
 * Writes one player's attendance, creating or correcting it.
 *
 * `minutesLate` is cleared for every status but `LATE`: a player switched from
 * late to present must not keep "twelve minutes" hanging off their row.
 */
export function upsertEntry(
  data: {
    trainingSessionId: string;
    playerId: string;
    status: Prisma.AttendanceCreateInput["status"];
    minutesLate?: number | undefined;
    note?: string | undefined;
    recordedById?: string | undefined;
  },
  tx?: Db,
) {
  const minutesLate =
    data.status === "LATE" ? (data.minutesLate ?? null) : null;
  const note = data.note ?? null;

  return dbOr(tx).attendance.upsert({
    where: {
      trainingSessionId_playerId: {
        trainingSessionId: data.trainingSessionId,
        playerId: data.playerId,
      },
    },
    update: {
      status: data.status,
      minutesLate,
      note,
      recordedAt: new Date(),
      ...(data.recordedById ? { recordedById: data.recordedById } : {}),
    },
    create: {
      trainingSessionId: data.trainingSessionId,
      playerId: data.playerId,
      status: data.status,
      minutesLate,
      note,
      ...(data.recordedById ? { recordedById: data.recordedById } : {}),
    },
  });
}

export function countForSession(trainingSessionId: string) {
  return prisma.attendance.count({ where: { trainingSessionId } });
}
