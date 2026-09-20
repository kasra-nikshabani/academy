import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

/**
 * The academy's headline counts, in one round of parallel queries.
 *
 * Every figure is a `count` against an index; none of them loads a row. A
 * dashboard is the page most likely to be opened and left open, so it should
 * be the cheapest page in the system, not the most expensive.
 */
export async function countAcademy(seasonId: string | null) {
  const inSeason = seasonId ? { seasonId } : {};

  const [
    players,
    activePlayers,
    schoolPlayers,
    teamPlayers,
    teams,
    sports,
    schools,
    staff,
    openTryouts,
  ] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { status: "ACTIVE" } }),
    prisma.schoolEnrollment
      .findMany({
        where: { status: "ACTIVE", ...inSeason },
        select: { playerId: true },
        distinct: ["playerId"],
      })
      .then((rows) => rows.length),
    prisma.teamMembership
      .findMany({
        where: { status: "ACTIVE", leftAt: null, ...inSeason },
        select: { playerId: true },
        distinct: ["playerId"],
      })
      .then((rows) => rows.length),
    prisma.team.count({ where: { isActive: true } }),
    prisma.sport.count({ where: { isActive: true } }),
    prisma.school.count({ where: { isActive: true } }),
    prisma.staff.count({ where: { status: "ACTIVE" } }),
    prisma.tryout.count({ where: { status: "OPEN" } }),
  ]);

  return {
    players,
    activePlayers,
    schoolPlayers,
    teamPlayers,
    teams,
    sports,
    schools,
    staff,
    openTryouts,
  };
}

/**
 * Players who joined in each month of a window, plus the count already on the
 * books before it opened.
 *
 * The starting total is what stops a six-month chart implying the academy was
 * empty half a year ago.
 */
export async function countPlayersByJoinMonth(
  buckets: readonly { key: string; startsAt: Date; endsAt: Date }[],
) {
  if (buckets.length === 0)
    return { joined: new Map<string, number>(), before: 0 };

  const windowStart = buckets[0]!.startsAt;

  const [before, ...counts] = await Promise.all([
    prisma.player.count({ where: { joinedAt: { lt: windowStart } } }),
    ...buckets.map((bucket) =>
      prisma.player.count({
        where: { joinedAt: { gte: bucket.startsAt, lt: bucket.endsAt } },
      }),
    ),
  ]);

  const joined = new Map<string, number>();
  buckets.forEach((bucket, index) => {
    joined.set(bucket.key, counts[index] ?? 0);
  });

  return { joined, before };
}

/** Active squad members per sport, for the distribution chart. */
export async function countPlayersBySport(seasonId: string | null) {
  // Two queries, not one per sport.
  //
  // The obvious shape — a count per sport inside `Promise.all` — is an N+1
  // that grows with the catalogue, and this runs on the page most likely to be
  // left open. `distinct` cannot be pushed into a `groupBy` here (a player in
  // two squads of one sport must count once), so the memberships are fetched
  // with their sport and folded in code; the row count is squad memberships
  // for the season, which is small and bounded by the academy's size.
  const [sports, memberships] = await Promise.all([
    prisma.sport.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.teamMembership.findMany({
      where: {
        status: "ACTIVE",
        leftAt: null,
        ...(seasonId ? { seasonId } : {}),
      },
      select: { playerId: true, team: { select: { sportId: true } } },
    }),
  ]);

  const playersPerSport = new Map<string, Set<string>>();
  for (const membership of memberships) {
    const sportId = membership.team.sportId;
    const players = playersPerSport.get(sportId) ?? new Set<string>();
    players.add(membership.playerId);
    playersPerSport.set(sportId, players);
  }

  return sports.map((sport) => ({
    label: sport.name,
    value: playersPerSport.get(sport.id)?.size ?? 0,
  }));
}

export interface AttendanceWindow {
  key: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Attendance totals per period, narrowed to the caller's teams.
 *
 * `groupBy` rather than a query per period: a twelve-week trend is one
 * statement, and the per-period version of it is twelve round trips for a
 * chart nobody waits for.
 *
 * Periods are matched in code afterwards, because the buckets are Jalali and
 * the database has no opinion about that.
 */
export async function countAttendanceInWindows(
  windows: readonly AttendanceWindow[],
  allowedTeamIds: readonly string[] | null,
) {
  const result = new Map<
    string,
    { present: number; late: number; absent: number }
  >();
  if (windows.length === 0) return result;

  const first = windows[0]!;
  const last = windows[windows.length - 1]!;

  const rows = await prisma.attendance.findMany({
    where: {
      trainingSession: {
        startsAt: { gte: first.startsAt, lt: last.endsAt },
        // Narrowed inside the query; a post-filter leaks the totals
        // (docs/PERMISSIONS.md §2).
        ...(allowedTeamIds === null
          ? {}
          : { teamId: { in: [...allowedTeamIds] } }),
      },
      // Excused rows are fetched by nobody: they leave the denominator, so
      // there is nothing for them to contribute (docs/BUSINESS_RULES.md §14).
      status: { in: ["PRESENT", "LATE", "ABSENT"] },
    },
    select: {
      status: true,
      trainingSession: { select: { startsAt: true } },
    },
  });

  for (const row of rows) {
    const at = row.trainingSession.startsAt.getTime();
    const window = windows.find(
      (candidate) =>
        at >= candidate.startsAt.getTime() && at < candidate.endsAt.getTime(),
    );
    if (!window) continue;

    const totals = result.get(window.key) ?? {
      present: 0,
      late: 0,
      absent: 0,
    };
    if (row.status === "PRESENT") totals.present += 1;
    else if (row.status === "LATE") totals.late += 1;
    else totals.absent += 1;
    result.set(window.key, totals);
  }

  return result;
}

/**
 * Sessions whose time has passed and whose register was never taken.
 *
 * `SCHEDULED` rather than `COMPLETED` is the marker: saving a register closes
 * a past session (Phase 9), so a session still scheduled after its end time is
 * one nobody wrote up.
 */
export function countSessionsWithoutRegister(
  allowedTeamIds: readonly string[] | null,
  before: Date,
): Promise<number> {
  return prisma.trainingSession.count({
    where: {
      status: "SCHEDULED",
      endsAt: { lt: before },
      ...(allowedTeamIds === null
        ? {}
        : { teamId: { in: [...allowedTeamIds] } }),
    },
  });
}

/** Trials still open whose closing date has passed. */
export function countOverdueTryouts(now: Date): Promise<number> {
  return prisma.tryout.count({
    where: { status: "OPEN", closesAt: { lt: now } },
  });
}

/** The next sessions for a set of teams — the coach's and the player's "today". */
export function listUpcomingSessions(params: {
  allowedTeamIds: readonly string[] | null;
  from: Date;
  take: number;
}) {
  const where: Prisma.TrainingSessionWhereInput = {
    startsAt: { gte: params.from },
    status: { in: ["SCHEDULED", "DRAFT"] },
    ...(params.allowedTeamIds === null
      ? {}
      : { teamId: { in: [...params.allowedTeamIds] } }),
  };

  return prisma.trainingSession.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: params.take,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      location: true,
      status: true,
      team: { select: { id: true, name: true } },
    },
  });
}

/** The next fixtures for a set of teams. */
export function listUpcomingMatches(params: {
  allowedTeamIds: readonly string[] | null;
  from: Date;
  take: number;
}) {
  return prisma.match.findMany({
    where: {
      kickoffAt: { gte: params.from },
      status: { in: ["SCHEDULED", "LIVE"] },
      ...(params.allowedTeamIds === null
        ? {}
        : { teamId: { in: [...params.allowedTeamIds] } }),
    },
    orderBy: { kickoffAt: "asc" },
    take: params.take,
    select: {
      id: true,
      opponent: true,
      kickoffAt: true,
      homeAway: true,
      competition: true,
      team: { select: { id: true, name: true } },
    },
  });
}

/** Evaluations sitting with one coach, unfinished. */
export function countOpenEvaluationsForStaff(staffId: string): Promise<number> {
  return prisma.evaluation.count({
    where: { evaluatorId: staffId, status: "DRAFT" },
  });
}

/**
 * The system's own numbers, as distinct from the academy's.
 *
 * `PRODUCT_SPEC.md` §9 asks an administrator for a **نمای سیستم** beside the
 * academy view, and this is it: accounts and access rather than players and
 * training. A blocked account and a signed-in-this-week count are the two
 * figures that actually prompt an administrator to do something.
 */
export async function countSystem(since: Date) {
  const [users, activeUsers, blockedUsers, recentLogins, roles, staffAccounts] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "BLOCKED" } }),
      prisma.user.count({ where: { lastLoginAt: { gte: since } } }),
      prisma.role.count(),
      // Accounts with no person attached: an administrator account is fine,
      // but a drift of them means people were created without being joined up.
      prisma.user.count({ where: { person: null } }),
    ]);

  return {
    users,
    activeUsers,
    blockedUsers,
    recentLogins,
    roles,
    unlinkedAccounts: staffAccounts,
  };
}
