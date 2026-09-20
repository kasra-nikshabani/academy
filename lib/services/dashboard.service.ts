import { ForbiddenError } from "@/lib/errors";
import {
  hasPermission,
  isUnscoped,
  requirePermission,
  resolveScheduleTeamIds,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import { findActiveSeason } from "@/lib/repositories/academy.repository";
import * as repo from "@/lib/repositories/dashboard.repository";
import {
  findPlayerIdsForUser,
  findStaffIdForUser,
} from "@/lib/repositories/people.repository";
import { listLatestForPlayers } from "@/lib/repositories/performance.repository";
import {
  countPipeline,
  countUnfinishedEvaluations,
} from "@/lib/repositories/tryout.repository";
import { listPlayers } from "@/lib/repositories/people.repository";
import { startOfWeek, addDays, weekLabel } from "@/lib/utils/date";
import {
  acceptedWithoutEvaluation,
  conversionRate,
  funnelStages,
  type PipelineCounts,
} from "./talent-funnel";
import {
  attendanceTrend,
  buildAlerts,
  distribution,
  growthSeries,
  overallRate,
  recentMonths,
  type DashboardAlert,
  type DistributionSlice,
  type GrowthPoint,
  type TrendPoint,
} from "./dashboard-metrics";

/**
 * The dashboard.
 *
 * ## One page, composed by permission — not one page per role
 *
 * `CLAUDE.md` §20 sketches five routes, one per role. This builds one, and the
 * reason is a feature the project already has: **a user can hold several
 * roles**, and the seed carries a coach who is also a parent precisely to keep
 * that honest (Phase 3).
 *
 * Five routes cannot answer where that person lands. Redirecting them by
 * "primary" role means inventing a precedence rule and then showing them half
 * of who they are; letting them switch means a menu nobody asked for. One page
 * that assembles the sections the caller has permission for shows a
 * coach-and-parent their squad *and* their children, which is the truth.
 *
 * It is also the maintainable shape: a new metric is added once, not five
 * times with four of them slowly drifting — the same reasoning that removed
 * `child:read` in Phase 5.
 *
 * ## Every section is independently guarded
 *
 * A section is built only when the caller holds the permission its data needs,
 * and the services beneath still check for themselves. Nothing here is the
 * protection; this only decides what to ask for.
 */

const GROWTH_MONTHS = 6;
const TREND_WEEKS = 8;
/** "Recently" for the sign-in figure, in days. */
const LOGIN_WINDOW_DAYS = 7;

export interface AcademyOverview {
  season: { id: string; name: string } | null;
  counts: Awaited<ReturnType<typeof repo.countAcademy>>;
  growth: GrowthPoint[];
  sports: DistributionSlice[];
  funnel: ReturnType<typeof funnelStages>;
  pipeline: PipelineCounts;
  conversion: number | null;
  attendance: { trend: TrendPoint[]; overall: number | null };
  alerts: DashboardAlert[];
}

/** The weeks a trend covers, newest last, keyed for matching. */
function recentWeeks(reference: Date, count: number) {
  const thisWeek = startOfWeek(reference);

  return Array.from({ length: count }, (_, index) => {
    const startsAt = addDays(thisWeek, -(count - 1 - index) * 7);
    const endsAt = addDays(startsAt, 7);
    return {
      key: startsAt.toISOString().slice(0, 10),
      label: weekLabel(startsAt),
      startsAt,
      endsAt,
    };
  });
}

/**
 * The manager's and administrator's view of the whole club.
 *
 * Unscoped by design — this is the figure for the academy, and anyone who can
 * reach it can already see every team. A scoped caller never gets here: the
 * page asks `canSeeAcademy` first.
 */
export async function getAcademyOverview(
  caller: AuthorizedUser,
): Promise<AcademyOverview> {
  requirePermission(caller, "report:read");

  // Checked here and not only by the page: an aggregate is still a
  // disclosure. A total that moves when one squad changes says something
  // about that squad, so a scoped caller does not get academy-wide figures
  // even if someone grants them `report:read`.
  if (!isUnscoped(caller)) throw new ForbiddenError();

  const now = new Date();
  const season = await findActiveSeason();
  const seasonId = season?.id ?? null;

  const months = recentMonths(now, GROWTH_MONTHS);
  const weeks = recentWeeks(now, TREND_WEEKS);
  const scope = { ...(seasonId ? { seasonId } : {}) };

  const [
    counts,
    growthCounts,
    sportCounts,
    pipeline,
    attendanceTotals,
    sessionsWithoutRegister,
    overdueTryouts,
    unfinishedEvaluations,
  ] = await Promise.all([
    repo.countAcademy(seasonId),
    repo.countPlayersByJoinMonth(months),
    repo.countPlayersBySport(seasonId),
    countPipeline(scope),
    // Unrestricted: this caller sees the whole academy anyway.
    repo.countAttendanceInWindows(weeks, null),
    repo.countSessionsWithoutRegister(null, now),
    repo.countOverdueTryouts(now),
    countUnfinishedEvaluations(scope),
  ]);

  const trend = attendanceTrend(weeks, attendanceTotals);

  return {
    season: season ? { id: season.id, name: season.name } : null,
    counts,
    growth: growthSeries(months, growthCounts.joined, growthCounts.before),
    sports: distribution(sportCounts),
    funnel: funnelStages(pipeline),
    pipeline,
    conversion: conversionRate(pipeline),
    attendance: {
      trend,
      overall: overallRate(attendanceTotals.values()),
    },
    alerts: buildAlerts({
      sessionsWithoutRegister,
      pendingScreening: pipeline.pendingScreening,
      unfinishedEvaluations,
      acceptedWithoutEvaluation: acceptedWithoutEvaluation(
        pipeline.accepted,
        pipeline.acceptedAndEvaluated,
      ),
      overdueTryouts,
    }),
  };
}

export interface SquadSummary {
  teams: { id: string; name: string }[];
  sessions: Awaited<ReturnType<typeof repo.listUpcomingSessions>>;
  matches: Awaited<ReturnType<typeof repo.listUpcomingMatches>>;
  attendance: { trend: TrendPoint[]; overall: number | null };
  sessionsWithoutRegister: number;
  openEvaluations: number;
}

/**
 * A coach's day.
 *
 * Narrowed by `scope.teamIds` — the teams they are assigned to, not the wider
 * schedule scope a parent gets. What a coach needs from a dashboard is what is
 * next and what they have not finished.
 */
export async function getSquadSummary(
  caller: AuthorizedUser,
): Promise<SquadSummary> {
  const now = new Date();
  const scope = await resolveScope(caller);
  const teamIds = scope.teamIds;

  if (teamIds !== null && teamIds.length === 0) {
    return {
      teams: [],
      sessions: [],
      matches: [],
      attendance: { trend: [], overall: null },
      sessionsWithoutRegister: 0,
      openEvaluations: 0,
    };
  }

  const weeks = recentWeeks(now, TREND_WEEKS);
  const staffId = await findStaffIdForUser(caller.id);

  const [
    sessions,
    matches,
    attendanceTotals,
    sessionsWithoutRegister,
    openEvaluations,
  ] = await Promise.all([
    repo.listUpcomingSessions({ allowedTeamIds: teamIds, from: now, take: 4 }),
    repo.listUpcomingMatches({ allowedTeamIds: teamIds, from: now, take: 3 }),
    repo.countAttendanceInWindows(weeks, teamIds),
    repo.countSessionsWithoutRegister(teamIds, now),
    staffId ? repo.countOpenEvaluationsForStaff(staffId) : Promise.resolve(0),
  ]);

  const teams = [
    ...new Map(
      sessions
        .map((session) => session.team)
        .concat(matches.map((match) => match.team))
        .map((team) => [team.id, team]),
    ).values(),
  ];

  return {
    teams,
    sessions,
    matches,
    attendance: {
      trend: attendanceTrend(weeks, attendanceTotals),
      overall: overallRate(attendanceTotals.values()),
    },
    sessionsWithoutRegister,
    openEvaluations,
  };
}

export interface FamilySummary {
  /**
   * Whether the caller is themselves one of these players.
   *
   * The section is headed «پرونده من» for a player and «فرزندان من» for a
   * parent, and the two are not told apart by counting: a parent with one
   * child was being shown "my record" over their child's name.
   */
  ownRecord: boolean;
  players: {
    id: string;
    firstName: string;
    lastName: string;
    playerCode: string;
  }[];
  sessions: Awaited<ReturnType<typeof repo.listUpcomingSessions>>;
  matches: Awaited<ReturnType<typeof repo.listUpcomingMatches>>;
  latestMeasurements: Awaited<ReturnType<typeof listLatestForPlayers>>;
}

/**
 * A player's or a parent's view.
 *
 * Built from the caller's **own** players, and the schedule scope those
 * players give them — never from a squad list, which a family does not get to
 * read (docs/PRODUCT_SPEC.md §8).
 */
export async function getFamilySummary(
  caller: AuthorizedUser,
): Promise<FamilySummary> {
  const now = new Date();

  // **`findPlayerIdsForUser`, not `scope.playerIds`.**
  //
  // A coach's scope includes every player in their squads — that is what makes
  // the register readable — so building this section from it put a squad
  // member under «پرونده من» as though the coach were their parent. Own
  // players means the caller's own record and their children, reached through
  // `PlayerGuardian`: the same distinction `resolveScheduleTeamIds` draws, for
  // the same reason. Caught by reading the rendered page as a coach.
  //
  // An unscoped caller has no own players either — they have everyone, which
  // is a different thing and not what this section is for.
  const ownPlayerIds = isUnscoped(caller)
    ? []
    : await findPlayerIdsForUser(caller.id);

  if (ownPlayerIds.length === 0) {
    return {
      ownRecord: false,
      players: [],
      sessions: [],
      matches: [],
      latestMeasurements: [],
    };
  }

  const scheduleTeamIds = await resolveScheduleTeamIds(caller);

  const [{ items }, sessions, matches, latestMeasurements] = await Promise.all([
    listPlayers({
      allowedPlayerIds: ownPlayerIds,
      skip: 0,
      take: ownPlayerIds.length,
    }),
    repo.listUpcomingSessions({
      allowedTeamIds: scheduleTeamIds,
      from: now,
      take: 3,
    }),
    repo.listUpcomingMatches({
      allowedTeamIds: scheduleTeamIds,
      from: now,
      take: 2,
    }),
    hasPermission(caller, "performance:read")
      ? listLatestForPlayers(ownPlayerIds)
      : Promise.resolve([]),
  ]);

  return {
    ownRecord: items.some((player) => player.person.userId === caller.id),
    players: items.map((player) => ({
      id: player.id,
      firstName: player.person.firstName,
      lastName: player.person.lastName,
      playerCode: player.playerCode,
    })),
    sessions,
    matches,
    latestMeasurements,
  };
}

// --- which sections a caller gets --------------------------------------------

/**
 * Whether to build the academy-wide view.
 *
 * `report:read` **and** unscoped. The permission alone is not enough: a
 * scoped caller who was granted it would otherwise get counts covering teams
 * they may not see, and an aggregate is still a disclosure — a total that
 * moves when a squad changes tells you something about that squad.
 */
export function canSeeAcademy(caller: AuthorizedUser): boolean {
  return hasPermission(caller, "report:read") && isUnscoped(caller);
}

/** Whether the caller is responsible for squads. */
export async function hasSquads(caller: AuthorizedUser): Promise<boolean> {
  if (!hasPermission(caller, "training:read")) return false;
  const scope = await resolveScope(caller);
  return scope.teamIds !== null && scope.teamIds.length > 0;
}

/**
 * Whether the caller is a player or a parent.
 *
 * Their **own** players, for the reason given in `getFamilySummary` — a coach
 * is not the parent of their squad.
 */
export async function hasOwnPlayers(caller: AuthorizedUser): Promise<boolean> {
  if (isUnscoped(caller)) return false;
  const ownPlayerIds = await findPlayerIdsForUser(caller.id);
  return ownPlayerIds.length > 0;
}

export type SystemOverview = Awaited<ReturnType<typeof repo.countSystem>>;

/**
 * The administrator's view of the system itself.
 *
 * Separate from the academy overview because the two answer different
 * questions and are held by different permissions: `report:read` is about the
 * club, `user:read` is about who can get in. An academy manager runs the
 * academy and does not administer accounts.
 */
export async function getSystemOverview(
  caller: AuthorizedUser,
): Promise<SystemOverview> {
  requirePermission(caller, "user:read");
  return repo.countSystem(addDays(new Date(), -LOGIN_WINDOW_DAYS));
}

/** Whether to build the system view at all. */
export function canSeeSystem(caller: AuthorizedUser): boolean {
  return hasPermission(caller, "user:read");
}
