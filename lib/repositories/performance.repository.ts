import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PerformanceMetric } from "@/lib/generated/prisma/enums";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

const RECORD_SELECT = {
  id: true,
  playerId: true,
  metric: true,
  value: true,
  measuredAt: true,
  notes: true,
  trainingSessionId: true,
  recordedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PerformanceRecordSelect;

export async function listPlayerRecords(params: {
  playerId: string;
  metric?: PerformanceMetric | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  take?: number | undefined;
}) {
  const measuredAt: Prisma.DateTimeFilter = {};
  if (params.from) measuredAt.gte = params.from;
  if (params.to) measuredAt.lt = params.to;

  return prisma.performanceRecord.findMany({
    where: {
      playerId: params.playerId,
      ...(params.metric ? { metric: params.metric } : {}),
      ...(params.from || params.to ? { measuredAt } : {}),
    },
    select: RECORD_SELECT,
    // Oldest first: this is a time series, and the chart reads it in order.
    orderBy: [{ measuredAt: "asc" }, { metric: "asc" }],
    ...(params.take ? { take: params.take } : {}),
  });
}

/**
 * The newest reading of every metric, for a set of players.
 *
 * One query for the whole squad rather than one per player: a coach's team
 * page asks this for twenty-five players at once, and the per-player version
 * of it is how a page ends up making twenty-five round trips.
 *
 * `distinct` runs after `orderBy`, so newest-first is what makes the retained
 * row the newest one. Reversing the order here would silently return each
 * player's *oldest* measurement, which would look entirely plausible.
 */
export async function listLatestForPlayers(playerIds: readonly string[]) {
  if (playerIds.length === 0) return [];

  return prisma.performanceRecord.findMany({
    where: { playerId: { in: [...playerIds] } },
    select: RECORD_SELECT,
    orderBy: [{ playerId: "asc" }, { metric: "asc" }, { measuredAt: "desc" }],
    distinct: ["playerId", "metric"],
  });
}

/**
 * Writes one reading, replacing any reading of the same metric on the same day.
 *
 * `upsert` on the unique key is what makes a correction a correction: a coach
 * who mistyped a sprint time re-submits the sheet and the day has one value,
 * not two that disagree.
 */
export function upsertRecord(
  data: {
    playerId: string;
    metric: PerformanceMetric;
    value: number;
    measuredAt: Date;
    notes?: string | undefined;
    trainingSessionId?: string | undefined;
    recordedById?: string | undefined;
  },
  tx?: Db,
) {
  const writable = {
    value: data.value,
    ...(data.notes === undefined ? {} : { notes: data.notes }),
    ...(data.trainingSessionId === undefined
      ? {}
      : { trainingSessionId: data.trainingSessionId }),
    ...(data.recordedById === undefined
      ? {}
      : { recordedById: data.recordedById }),
  };

  return dbOr(tx).performanceRecord.upsert({
    where: {
      playerId_metric_measuredAt: {
        playerId: data.playerId,
        metric: data.metric,
        measuredAt: data.measuredAt,
      },
    },
    create: {
      playerId: data.playerId,
      metric: data.metric,
      measuredAt: data.measuredAt,
      ...writable,
    },
    update: writable,
    select: RECORD_SELECT,
  });
}

/**
 * The newest reading of one metric for one player.
 *
 * Used to decide whether a measurement just written is the latest one, and so
 * whether the figure on the player's card should follow it.
 */
export function findLatestRecord(
  playerId: string,
  metric: PerformanceMetric,
  tx?: Db,
) {
  return dbOr(tx).performanceRecord.findFirst({
    where: { playerId, metric },
    select: RECORD_SELECT,
    orderBy: { measuredAt: "desc" },
  });
}

/** Updates the figure carried on the player record itself. */
export function updatePlayerMeasurements(
  playerId: string,
  data: { heightCm?: number; weightKg?: number },
  tx?: Db,
) {
  return dbOr(tx).player.update({
    where: { id: playerId },
    data,
    select: { id: true, heightCm: true, weightKg: true },
  });
}

export function countPlayerRecords(playerId: string) {
  return prisma.performanceRecord.count({ where: { playerId } });
}
