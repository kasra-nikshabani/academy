import { NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  assertWithinScope,
  hasPermission,
  requirePermission,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import {
  findActiveSeason,
  listTeamsByIds,
} from "@/lib/repositories/academy.repository";
import { listTeamRoster } from "@/lib/repositories/enrollment.repository";
import {
  findPlayerById,
  findPlayerIdsForUser,
  listPlayers,
} from "@/lib/repositories/people.repository";
import * as repo from "@/lib/repositories/performance.repository";
import { runInTransaction, type Db } from "@/lib/repositories/transaction";
import { startOfDay } from "@/lib/utils/date";
import type {
  PerformanceQuery,
  SavePerformanceInput,
} from "@/lib/validation/performance";
import type { PerformanceMetric } from "@/lib/generated/prisma/enums";
import { roundToMetric } from "./performance-metrics";
import { buildTrends, type MetricTrend } from "./performance-trend";

/**
 * Performance: what was measured, and which way it moved.
 *
 * ## Authorization
 *
 * Reading and writing are narrowed by the **same** set — `scope.playerIds` —
 * and told apart by permission alone. That is not a shortcut, it is the point:
 * a coach's `scope.playerIds` already means "the players in my squads this
 * season", and a parent's already means "my children". A parent holds
 * `performance:read` and not `performance:write`, so the same scope gives them
 * a chart and no form, with no second rule to keep in step with the first.
 *
 * ## A measurement belongs to a day
 *
 * Every write is filed against midnight in Tehran on the day of the test. A
 * coach typing Sunday's results on Tuesday still gets Sunday's line, and a
 * second submission of the same sheet corrects it rather than doubling it.
 */

/** Refuses a player the caller may not reach, before reading anything. */
async function requireReachablePlayer(
  caller: AuthorizedUser,
  playerId: string,
) {
  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, playerId);

  const player = await findPlayerById(playerId);
  if (!player) throw new NotFoundError("بازیکن یافت نشد.");
  return player;
}

export interface PlayerPerformance {
  playerId: string;
  trends: MetricTrend[];
  /** Every reading, oldest first — what the chart and the table both read. */
  records: Awaited<ReturnType<typeof repo.listPlayerRecords>>;
}

/** A player's measurements, grouped into one trend per metric. */
export async function getPlayerPerformance(
  caller: AuthorizedUser,
  playerId: string,
  filters: PerformanceQuery = {},
): Promise<PlayerPerformance> {
  requirePermission(caller, "performance:read");
  await requireReachablePlayer(caller, playerId);

  const records = await repo.listPlayerRecords({
    playerId,
    metric: filters.metric,
    from: filters.from,
    to: filters.to,
  });

  return { playerId, trends: buildTrends(records), records };
}

/**
 * Keeps the figure on the player record in step with the measurements.
 *
 * `Player.heightCm` and `Player.weightKg` are what someone wrote on a
 * registration form, sometimes years ago. Once the academy starts measuring a
 * growing thirteen-year-old properly, that number is not merely old — it
 * contradicts the chart on the same page, and there is nothing to tell a
 * reader which of the two to believe.
 *
 * So the newest measurement wins, and it wins **inside the same transaction**
 * as the measurement itself: a player card that disagrees with its own chart
 * is worse than one that is simply out of date.
 *
 * Only when the reading really is the newest. Back-filling last season's
 * testing day must not rewrite today's height.
 */
async function syncPlayerFigure(
  playerId: string,
  metric: PerformanceMetric,
  value: number,
  measuredAt: Date,
  tx: Db,
) {
  if (metric !== "HEIGHT_CM" && metric !== "WEIGHT_KG") return;

  const latest = await repo.findLatestRecord(playerId, metric, tx);
  if (latest && latest.measuredAt > measuredAt) return;

  // Both columns are `Int`; the metric itself is read to a decimal.
  const rounded = Math.round(value);
  await repo.updatePlayerMeasurements(
    playerId,
    metric === "HEIGHT_CM" ? { heightCm: rounded } : { weightKg: rounded },
    tx,
  );
}

/**
 * Records everything measured on one day.
 *
 * Transactional because a testing sheet is one act. Half a sheet — the sprint
 * saved, the jump lost — is a session that never happened the way the record
 * says it did, and nobody would know which half to re-enter (CLAUDE.md §2).
 */
export async function savePlayerMeasurements(
  caller: AuthorizedUser,
  playerId: string,
  input: SavePerformanceInput,
) {
  requirePermission(caller, "performance:write");
  await requireReachablePlayer(caller, playerId);

  // A measurement dated in the future is a typo, always.
  if (input.measuredAt.getTime() > Date.now()) {
    throw new ValidationError("تاریخ اندازه‌گیری نمی‌تواند در آینده باشد.", {
      measuredAt: input.measuredAt.toISOString(),
    });
  }

  const measuredAt = startOfDay(input.measuredAt);

  await runInTransaction(async (tx) => {
    for (const entry of input.entries) {
      const value = roundToMetric(entry.metric, entry.value);

      await repo.upsertRecord(
        {
          playerId,
          metric: entry.metric,
          value,
          measuredAt,
          notes: entry.notes,
          trainingSessionId: input.trainingSessionId,
          recordedById: caller.id,
        },
        tx,
      );

      await syncPlayerFigure(playerId, entry.metric, value, measuredAt, tx);
    }
  });

  // The metric names, never the values: a child's weight is theirs
  // (CLAUDE.md §27).
  logger.info("performance measurements recorded", {
    playerId,
    metrics: input.entries.map((entry) => entry.metric),
    measuredAt,
    actorId: caller.id,
  });

  return getPlayerPerformance(caller, playerId);
}

export interface SquadPerformanceRow {
  playerId: string;
  playerCode: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  latest: Partial<
    Record<PerformanceMetric, { value: number; measuredAt: Date }>
  >;
}

/**
 * A squad's most recent numbers, one row per player.
 *
 * Scoped by team rather than by player, because this is the coach's view and
 * the question is "where is my squad", not "where is this child". A player in
 * the squad with no measurement yet still gets a row — an empty row is how a
 * coach sees who has not been tested, and dropping them would hide exactly the
 * players this page exists to find.
 */
export async function getSquadPerformance(
  caller: AuthorizedUser,
  teamId: string,
): Promise<SquadPerformanceRow[]> {
  requirePermission(caller, "performance:read");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.teamIds, teamId);

  const season = await findActiveSeason();
  if (!season) return [];

  const roster = await listTeamRoster({ teamId, seasonId: season.id });
  const latest = await repo.listLatestForPlayers(
    roster.map((membership) => membership.playerId),
  );

  const byPlayer = new Map<string, SquadPerformanceRow["latest"]>();

  for (const record of latest) {
    const row = byPlayer.get(record.playerId) ?? {};
    row[record.metric] = {
      value: record.value,
      measuredAt: record.measuredAt,
    };
    byPlayer.set(record.playerId, row);
  }

  return roster.map((membership) => ({
    playerId: membership.playerId,
    playerCode: membership.player.playerCode,
    firstName: membership.player.person.firstName,
    lastName: membership.player.person.lastName,
    jerseyNumber: membership.jerseyNumber,
    latest: byPlayer.get(membership.playerId) ?? {},
  }));
}

/** Presentation gating: whether to render the recording form at all. */
export function canRecordPerformance(caller: AuthorizedUser): boolean {
  return hasPermission(caller, "performance:write");
}

/**
 * Whether the caller may record measurements for this particular player.
 *
 * Separate from `canRecordPerformance` because the permission and the scope
 * are separate questions, and a page needs both answered before it draws a
 * form that would fail on submit (docs/PERMISSIONS.md §2).
 */
export async function canRecordForPlayer(
  caller: AuthorizedUser,
  playerId: string,
): Promise<boolean> {
  if (!hasPermission(caller, "performance:write")) return false;
  const scope = await resolveScope(caller);
  return scope.playerIds === null || scope.playerIds.includes(playerId);
}

export interface PerformanceLanding {
  /** Squads the caller may look over. Empty for a player or a parent. */
  teams: Awaited<ReturnType<typeof listTeamsByIds>>;
  /** The caller's own players — themselves, or their children. */
  ownPlayers: { id: string; firstName: string; lastName: string }[];
}

/**
 * What the performance section opens on.
 *
 * Two different people arrive here. A coach wants a squad, and gets the team
 * filter. A player or a parent has no squad to inspect — `scope.teamIds` is
 * empty for them by design, because a roster is not a parent's to read — and
 * for them the useful answer is a way into their own record rather than an
 * empty table that looks like a permission failure.
 */
export async function getPerformanceLanding(
  caller: AuthorizedUser,
): Promise<PerformanceLanding> {
  requirePermission(caller, "performance:read");

  const scope = await resolveScope(caller);
  const teams = await listTeamsByIds(scope.teamIds);

  // Only their *own* players, never the squads a coach can also see: this list
  // is the "my record" shortcut, not a second roster.
  const ownIds = await findPlayerIdsForUser(caller.id);
  const { items } =
    ownIds.length === 0
      ? { items: [] }
      : await listPlayers({
          allowedPlayerIds: ownIds,
          skip: 0,
          take: ownIds.length,
        });

  return {
    teams,
    ownPlayers: items.map((player) => ({
      id: player.id,
      firstName: player.person.firstName,
      lastName: player.person.lastName,
    })),
  };
}
