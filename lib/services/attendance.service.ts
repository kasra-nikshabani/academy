import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  assertWithinScope,
  hasPermission,
  requirePermission,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import * as repo from "@/lib/repositories/attendance.repository";
import { listTeamRoster } from "@/lib/repositories/enrollment.repository";
import { findSessionById } from "@/lib/repositories/training.repository";
import { runInTransaction } from "@/lib/repositories/transaction";
import type { AttendanceStatus } from "@/lib/generated/prisma/enums";
import type {
  AttendanceEntryInput,
  PlayerAttendanceQuery,
  SaveAttendanceInput,
} from "@/lib/validation/attendance";
import { attendanceRate, tally, type AttendanceTotals } from "./attendance-summary";

/**
 * Attendance.
 *
 * ## The sheet belongs to the coach, the row belongs to the player
 *
 * This is the whole authorization story of the module, and it is why reading
 * has two entry points rather than one:
 *
 *   `getSessionRegister` — the whole squad for one session. Needs the team in
 *                          `scope.teamIds`: a coach, a manager, an admin.
 *   `getPlayerRegister`  — one player across sessions. Needs the player in
 *                          `scope.playerIds`: the player themselves, or their
 *                          guardian.
 *
 * A parent must be able to see that their child missed Tuesday. A parent must
 * **not** learn which other children missed it (docs/PRODUCT_SPEC.md §8). One
 * endpoint returning "the register, filtered" would be one forgotten filter
 * away from that, so the two are different functions with different scopes.
 */

export interface RegisterRow {
  playerId: string;
  playerCode: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  status: AttendanceStatus | null;
  minutesLate: number | null;
  note: string | null;
  recordedAt: Date | null;
}

export interface SessionRegister {
  session: NonNullable<Awaited<ReturnType<typeof findSessionById>>>;
  rows: RegisterRow[];
  totals: AttendanceTotals;
  /** Squad members with no row yet. Zero means the register is complete. */
  pending: number;
}

async function requireSession(id: string) {
  const session = await findSessionById(id);
  if (!session) throw new NotFoundError("جلسه تمرین یافت نشد.");
  return session;
}

/**
 * The squad the register is taken from.
 *
 * Attendance exists only for players in that team's squad for that season.
 * Without this a coach could file a register against any player in the
 * academy, and the row would look exactly as legitimate as a real one.
 */
async function squadFor(session: { teamId: string; seasonId: string }) {
  return listTeamRoster({ teamId: session.teamId, seasonId: session.seasonId });
}

// --- reading ----------------------------------------------------------------

/** The register for one session: every squad member, marked or not yet. */
export async function getSessionRegister(
  caller: AuthorizedUser,
  sessionId: string,
): Promise<SessionRegister> {
  requirePermission(caller, "attendance:read");

  const session = await requireSession(sessionId);

  // The team scope, not the calendar scope: seeing that a session exists is
  // not seeing who turned up to it.
  const scope = await resolveScope(caller);
  assertWithinScope(scope.teamIds, session.teamId);

  const [squad, recorded] = await Promise.all([
    squadFor(session),
    repo.listForSession(sessionId),
  ]);

  const byPlayer = new Map(recorded.map((row) => [row.playerId, row]));

  const rows: RegisterRow[] = squad.map((membership) => {
    const row = byPlayer.get(membership.playerId);
    return {
      playerId: membership.playerId,
      playerCode: membership.player.playerCode,
      firstName: membership.player.person.firstName,
      lastName: membership.player.person.lastName,
      jerseyNumber: membership.jerseyNumber,
      status: row?.status ?? null,
      minutesLate: row?.minutesLate ?? null,
      note: row?.note ?? null,
      recordedAt: row?.recordedAt ?? null,
    };
  });

  // A player marked at the session who has since left the squad keeps their
  // row: the register records who was there, not who is there now.
  for (const row of recorded) {
    if (rows.some((existing) => existing.playerId === row.playerId)) continue;
    rows.push({
      playerId: row.playerId,
      playerCode: row.player.playerCode,
      firstName: row.player.person.firstName,
      lastName: row.player.person.lastName,
      jerseyNumber: null,
      status: row.status,
      minutesLate: row.minutesLate,
      note: row.note,
      recordedAt: row.recordedAt,
    });
  }

  return {
    session,
    rows,
    totals: tally(recorded.map((row) => row.status)),
    pending: rows.filter((row) => row.status === null).length,
  };
}

/** One player's attendance across sessions, with the rate a parent reads. */
export async function getPlayerRegister(
  caller: AuthorizedUser,
  playerId: string,
  filters: PlayerAttendanceQuery = {},
) {
  requirePermission(caller, "attendance:read");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, playerId);

  const [entries, statuses] = await Promise.all([
    repo.listForPlayer({ playerId, ...filters, take: 50 }),
    repo.listStatusesForPlayer({ playerId, ...filters }),
  ]);

  const totals = tally(statuses);

  return { entries, totals, rate: attendanceRate(totals) };
}

/**
 * Whether the caller may see the whole register for a team.
 *
 * Presentation gating only — it decides whether a page renders the sheet at
 * all, so a parent is not shown a section that would refuse them. The real
 * check still runs inside `getSessionRegister` (docs/PERMISSIONS.md §4).
 */
export async function canReadRegister(
  caller: AuthorizedUser,
  teamId: string,
): Promise<boolean> {
  if (!hasPermission(caller, "attendance:read")) return false;
  const scope = await resolveScope(caller);
  return scope.teamIds === null || scope.teamIds.includes(teamId);
}

/**
 * The caller's **own** players' rows for one session.
 *
 * What a player or a parent gets on a session page: did my child turn up on
 * Tuesday. Never another family's row — an unscoped caller gets nothing here,
 * because they have the whole register already.
 */
export async function getOwnRowsForSession(
  caller: AuthorizedUser,
  sessionId: string,
) {
  requirePermission(caller, "attendance:read");

  const scope = await resolveScope(caller);
  if (scope.playerIds === null) return [];

  const session = await requireSession(sessionId);

  const rows = await Promise.all(
    scope.playerIds.map(async (playerId) => {
      const row = await repo.findOne(session.id, playerId);
      return row ? { playerId, row } : null;
    }),
  );

  return rows.filter((row): row is NonNullable<typeof row> => row !== null);
}

// --- writing ----------------------------------------------------------------

/**
 * Records the register.
 *
 * `defaultStatus` covers everyone the entries do not mention, which is «همه
 * حاضر» followed by the corrections — one atomic write rather than two, so
 * the register can never be half-taken (CLAUDE.md §15).
 */
export async function saveAttendance(
  caller: AuthorizedUser,
  sessionId: string,
  input: SaveAttendanceInput,
) {
  requirePermission(caller, "attendance:write");

  const session = await requireSession(sessionId);

  const scope = await resolveScope(caller);
  assertWithinScope(scope.teamIds, session.teamId);

  if (session.status === "CANCELLED") {
    throw new ConflictError(
      "این جلسه لغو شده است و حضور و غیابی برای آن ثبت نمی‌شود.",
    );
  }

  // A register for a session that has not begun would be a record of
  // something that has not happened yet.
  if (session.startsAt > new Date()) {
    throw new ValidationError(
      "این جلسه هنوز شروع نشده است؛ حضور و غیاب پس از آغاز جلسه ثبت می‌شود.",
      { startsAt: session.startsAt },
    );
  }

  const squad = await squadFor(session);
  const squadIds = new Set(squad.map((membership) => membership.playerId));
  const recorded = await repo.listForSession(sessionId);
  for (const row of recorded) squadIds.add(row.playerId);

  const named = new Set<string>();
  for (const entry of input.entries) {
    if (!squadIds.has(entry.playerId)) {
      throw new ValidationError(
        "این بازیکن در ترکیب این تیم در این فصل نیست.",
        { playerId: entry.playerId },
      );
    }
    named.add(entry.playerId);
  }

  const defaultStatus = input.defaultStatus;
  const filled: AttendanceEntryInput[] =
    defaultStatus === undefined
      ? []
      : [...squadIds]
          .filter((playerId) => !named.has(playerId))
          .map((playerId) => ({ playerId, status: defaultStatus }));

  const all: AttendanceEntryInput[] = [...input.entries, ...filled];

  await runInTransaction(async (tx) => {
    for (const entry of all) {
      await repo.upsertEntry(
        {
          trainingSessionId: sessionId,
          playerId: entry.playerId,
          status: entry.status,
          minutesLate: entry.minutesLate,
          note: entry.note,
          recordedById: caller.id,
        },
        tx,
      );
    }

    // Taking the register is the club's evidence that the session happened,
    // so a scheduled session that is now in the past follows the fact rather
    // than waiting for someone to remember to close it.
    if (session.status === "SCHEDULED") {
      await tx.trainingSession.update({
        where: { id: sessionId },
        data: { status: "COMPLETED" },
      });
    }
  });

  logger.info("attendance recorded", {
    sessionId,
    teamId: session.teamId,
    entries: all.length,
    defaulted: filled.length,
    actorId: caller.id,
  });

  return getSessionRegister(caller, sessionId);
}
