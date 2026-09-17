import { buildPaginationMeta, type PaginationQuery } from "@/lib/api";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  assertWithinScope,
  hasPermission,
  requirePermission,
  resolveScheduleTeamIds,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import {
  findSeasonForDate,
  findTeamById,
} from "@/lib/repositories/academy.repository";
import { listTeamRoster } from "@/lib/repositories/enrollment.repository";
import * as repo from "@/lib/repositories/match.repository";
import { runInTransaction, type Db } from "@/lib/repositories/transaction";
import { formatJalaliDateTime } from "@/lib/utils/date";
import type {
  CreateMatchInput,
  MatchQuery,
  SaveLineupInput,
  SaveStatsInput,
  UpdateMatchInput,
} from "@/lib/validation/match";
import { sessionEnd } from "./training-time";
import {
  goalsPerAppearance,
  summarisePlayerMatches,
  summariseResults,
} from "./match-result";

/**
 * Matches: the fixture, the team sheet, and what happened.
 *
 * The authorization shape is the one the academy already uses twice:
 *
 *   reading a fixture  — `resolveScheduleTeamIds`: assigned teams plus the
 *                        squads the caller's own children belong to, so a
 *                        parent can see when their child plays.
 *   writing anything   — `scope.teamIds`: assigned teams only.
 *   a player's own record — `scope.playerIds`.
 *
 * And the rule this phase turns on: **only the squad plays.** A team sheet may
 * name a player who belongs to this team in this season and nobody else.
 * Without it a coach could file match statistics against any player in the
 * academy and the row would look exactly as legitimate as a real one — the
 * same reasoning, and the same rule, as the attendance register.
 */

const FINAL_STATUSES = new Set(["CANCELLED"]);

async function readMatch(id: string) {
  const match = await repo.findMatchById(id);
  if (!match) throw new NotFoundError("مسابقه یافت نشد.");
  return match;
}

async function requireSeasonFor(kickoffAt: Date) {
  const season = await findSeasonForDate(kickoffAt);
  if (!season) {
    throw new ValidationError(
      "تاریخ مسابقه در هیچ فصل تعریف‌شده‌ای قرار نمی‌گیرد؛ ابتدا فصل مربوطه را ثبت کنید.",
      { kickoffAt: kickoffAt.toISOString() },
    );
  }
  return season;
}

async function requireWritableTeam(caller: AuthorizedUser, teamId: string) {
  const scope = await resolveScope(caller);
  assertWithinScope(scope.teamIds, teamId);

  const team = await findTeamById(teamId);
  if (!team) throw new ValidationError("تیم انتخاب‌شده وجود ندارد.");
  if (!team.isActive) {
    throw new ValidationError(
      "این تیم غیرفعال است و مسابقه‌ای برای آن ثبت نمی‌شود.",
    );
  }
  return team;
}

/**
 * Refuses a fixture that overlaps another of the same team.
 *
 * Matches are checked against matches only, not against training. A light
 * session on the morning of an afternoon fixture is ordinary, and refusing it
 * would be a false alarm about the most normal day in the calendar.
 */
async function assertNoClash(
  params: {
    teamId: string;
    kickoffAt: Date;
    endsAt: Date;
    excludeId?: string | undefined;
  },
  tx: Db,
) {
  const clash = await repo.findOverlappingMatch(params, tx);
  if (clash) {
    throw new ConflictError(
      `این تیم در همین بازه مسابقه دیگری دارد: ${clash.opponent} — ${formatJalaliDateTime(clash.kickoffAt)}`,
      { matchId: clash.id, kickoffAt: clash.kickoffAt },
    );
  }
}

/** The squad a team sheet may be drawn from. */
async function squadFor(match: { teamId: string; seasonId: string }) {
  return listTeamRoster({ teamId: match.teamId, seasonId: match.seasonId });
}

// --- fixtures ---------------------------------------------------------------

export async function listMatches(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
  filters: MatchQuery = {},
) {
  requirePermission(caller, "match:read");

  const allowedTeamIds = await resolveScheduleTeamIds(caller);
  if (filters.teamId) assertWithinScope(allowedTeamIds, filters.teamId);

  const { items, total } = await repo.listMatches({
    ...filters,
    allowedTeamIds,
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

export async function getMatch(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "match:read");

  const match = await readMatch(id);
  const allowedTeamIds = await resolveScheduleTeamIds(caller);
  assertWithinScope(allowedTeamIds, match.teamId);

  return match;
}

export async function createMatch(
  caller: AuthorizedUser,
  input: CreateMatchInput,
) {
  requirePermission(caller, "match:write");

  const team = await requireWritableTeam(caller, input.teamId);
  const season = await requireSeasonFor(input.kickoffAt);
  const endsAt = sessionEnd(input.kickoffAt, input.durationMinutes);

  const created = await runInTransaction(async (tx) => {
    await repo.lockTeamFixtures(input.teamId, tx);
    await assertNoClash(
      { teamId: input.teamId, kickoffAt: input.kickoffAt, endsAt },
      tx,
    );

    return repo.createMatch(
      {
        teamId: input.teamId,
        seasonId: season.id,
        opponent: input.opponent,
        competition: input.competition,
        homeAway: input.homeAway,
        venue: input.venue,
        kickoffAt: input.kickoffAt,
        endsAt,
        status: input.status,
        notes: input.notes,
        createdById: caller.id,
      },
      tx,
    );
  });

  logger.info("match created", {
    matchId: created.id,
    teamId: team.id,
    kickoffAt: input.kickoffAt,
    actorId: caller.id,
  });

  return readMatch(created.id);
}

export async function updateMatch(
  caller: AuthorizedUser,
  id: string,
  input: UpdateMatchInput,
) {
  requirePermission(caller, "match:write");

  const match = await readMatch(id);
  await requireWritableTeam(caller, match.teamId);

  if (FINAL_STATUSES.has(match.status)) {
    throw new ConflictError(
      "مسابقه لغوشده قابل ویرایش نیست؛ در صورت نیاز مسابقه تازه‌ای ثبت کنید.",
    );
  }

  const reschedules =
    input.kickoffAt !== undefined || input.durationMinutes !== undefined;

  const kickoffAt = input.kickoffAt ?? match.kickoffAt;
  const minutes =
    input.durationMinutes ??
    Math.round((match.endsAt.getTime() - match.kickoffAt.getTime()) / 60000);
  const endsAt = sessionEnd(kickoffAt, minutes);

  // A score belongs to a match that was played. Recording one on a fixture
  // still in the future is recording something that has not happened.
  const setsScore =
    input.goalsFor !== undefined &&
    input.goalsFor !== null &&
    input.goalsAgainst !== undefined &&
    input.goalsAgainst !== null;

  if (setsScore && kickoffAt > new Date()) {
    throw new ValidationError(
      "این مسابقه هنوز شروع نشده است؛ نتیجه پس از آغاز بازی ثبت می‌شود.",
    );
  }

  if (input.status === "COMPLETED" && !setsScore) {
    const hasScore = match.goalsFor !== null && match.goalsAgainst !== null;
    if (!hasScore) {
      throw new ValidationError(
        "برای پایان‌یافته کردن مسابقه، نتیجه را ثبت کنید.",
      );
    }
  }

  const data = {
    ...(input.opponent === undefined ? {} : { opponent: input.opponent }),
    ...(input.competition === undefined
      ? {}
      : { competition: input.competition }),
    ...(input.homeAway === undefined ? {} : { homeAway: input.homeAway }),
    ...(input.venue === undefined ? {} : { venue: input.venue }),
    ...(reschedules ? { kickoffAt, endsAt } : {}),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.goalsFor === undefined ? {} : { goalsFor: input.goalsFor }),
    ...(input.goalsAgainst === undefined
      ? {}
      : { goalsAgainst: input.goalsAgainst }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
  };

  await runInTransaction(async (tx) => {
    if (reschedules) {
      await repo.lockTeamFixtures(match.teamId, tx);
      await assertNoClash(
        { teamId: match.teamId, kickoffAt, endsAt, excludeId: id },
        tx,
      );
    }

    await repo.updateMatch(id, data, tx);
  });

  logger.info("match updated", {
    matchId: id,
    rescheduled: reschedules,
    status: input.status,
    actorId: caller.id,
  });

  return readMatch(id);
}

/** Calls a fixture off. The row stays, with the reason (CLAUDE.md §2). */
export async function cancelMatch(
  caller: AuthorizedUser,
  id: string,
  status: "CANCELLED" | "POSTPONED",
  reason?: string,
) {
  requirePermission(caller, "match:write");

  const match = await readMatch(id);
  await requireWritableTeam(caller, match.teamId);

  if (match.status === "CANCELLED") {
    throw new ConflictError("این مسابقه پیش از این لغو شده است.");
  }
  if (match.status === "COMPLETED") {
    throw new ConflictError("مسابقه برگزارشده لغو نمی‌شود.");
  }

  await repo.updateMatch(id, {
    status,
    ...(reason ? { cancelReason: reason } : {}),
  });

  logger.info("match called off", { matchId: id, status, actorId: caller.id });
  return readMatch(id);
}

// --- the team sheet ---------------------------------------------------------

/**
 * Replaces the team sheet.
 *
 * Every named player is checked against the squad for that season. This is
 * the rule the phase turns on, and it is checked here rather than trusted to
 * the interface: the endpoint is reachable without the page.
 */
export async function saveLineup(
  caller: AuthorizedUser,
  matchId: string,
  input: SaveLineupInput,
) {
  requirePermission(caller, "match:write");

  const match = await readMatch(matchId);
  await requireWritableTeam(caller, match.teamId);

  if (match.status === "CANCELLED") {
    throw new ConflictError("مسابقه لغوشده ترکیب ندارد.");
  }

  const squad = await squadFor(match);
  const squadIds = new Set(squad.map((membership) => membership.playerId));

  for (const entry of input.entries) {
    if (!squadIds.has(entry.playerId)) {
      throw new ValidationError(
        "این بازیکن در ترکیب این تیم در این فصل نیست.",
        { playerId: entry.playerId },
      );
    }
  }

  await runInTransaction((tx) =>
    repo.replaceLineup(matchId, input.entries, tx),
  );

  logger.info("match lineup saved", {
    matchId,
    named: input.entries.length,
    actorId: caller.id,
  });

  return readMatch(matchId);
}

// --- statistics -------------------------------------------------------------

/**
 * Records what each player did.
 *
 * Only players on the team sheet: statistics for someone who was never named
 * describe a match that did not happen. And only after kick-off, for the same
 * reason the attendance register waits for the session to start.
 */
export async function saveMatchStats(
  caller: AuthorizedUser,
  matchId: string,
  input: SaveStatsInput,
) {
  requirePermission(caller, "match:write");

  const match = await readMatch(matchId);
  await requireWritableTeam(caller, match.teamId);

  if (match.status === "CANCELLED" || match.status === "POSTPONED") {
    throw new ConflictError(
      "این مسابقه برگزار نشده است و آماری برای آن ثبت نمی‌شود.",
    );
  }
  if (match.kickoffAt > new Date()) {
    throw new ValidationError(
      "این مسابقه هنوز شروع نشده است؛ آمار پس از آغاز بازی ثبت می‌شود.",
    );
  }

  const named = new Set(match.lineup.map((entry) => entry.playerId));

  for (const entry of input.entries) {
    if (!named.has(entry.playerId)) {
      throw new ValidationError(
        "این بازیکن در ترکیب این مسابقه نیست؛ ابتدا او را به ترکیب اضافه کنید.",
        { playerId: entry.playerId },
      );
    }
  }

  await runInTransaction(async (tx) => {
    for (const entry of input.entries) {
      await repo.upsertStat({ matchId, ...entry, recordedById: caller.id }, tx);
    }
  });

  logger.info("match stats recorded", {
    matchId,
    entries: input.entries.length,
    actorId: caller.id,
  });

  return readMatch(matchId);
}

/** A player's matches and season totals — narrowed by player scope. */
export async function getPlayerMatchRecord(
  caller: AuthorizedUser,
  playerId: string,
  filters: { seasonId?: string | undefined } = {},
) {
  requirePermission(caller, "match:read");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, playerId);

  const stats = await repo.listStatsForPlayer({
    playerId,
    seasonId: filters.seasonId,
    take: 50,
  });

  const started = await repo.findStartedMatchIds(
    playerId,
    stats.map((row) => row.matchId),
  );

  const totals = summarisePlayerMatches(
    stats.map((row) => ({
      minutesPlayed: row.minutesPlayed,
      goals: row.goals,
      assists: row.assists,
      yellowCards: row.yellowCards,
      redCards: row.redCards,
      started: started.has(row.matchId),
    })),
  );

  return {
    entries: stats,
    totals,
    goalsPerAppearance: goalsPerAppearance(totals),
  };
}

/** A team's record over a season — played, won, drawn, lost, goals. */
export async function getTeamRecord(
  caller: AuthorizedUser,
  teamId: string,
  filters: { seasonId?: string | undefined } = {},
) {
  requirePermission(caller, "match:read");

  const allowedTeamIds = await resolveScheduleTeamIds(caller);
  assertWithinScope(allowedTeamIds, teamId);

  const matches = await repo.listResultsForTeam({
    teamId,
    seasonId: filters.seasonId,
  });

  return summariseResults(matches);
}

/** Presentation gating: whether to render the editing controls at all. */
export function canEditMatch(caller: AuthorizedUser): boolean {
  return hasPermission(caller, "match:write");
}
