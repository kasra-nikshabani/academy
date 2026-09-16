import { findActiveSeason } from "@/lib/repositories/academy.repository";
import {
  findPlayerIdsInTeams,
  findTeamIdsForPlayers,
} from "@/lib/repositories/enrollment.repository";
import {
  findPlayerIdsForUser,
  findTeamIdsForUser,
} from "@/lib/repositories/people.repository";
import type { AuthorizedUser } from "./authorize";
import { UNRESTRICTED_SCOPE, isUnscoped, type ScopeFilter } from "./scope";

/**
 * Turns a caller into the set of records they may reach.
 *
 * Resolved once per request and handed to repositories, which apply it inside
 * their queries. A permission says a coach may write training; this says which
 * teams and which players that applies to.
 *
 * ## How each role is narrowed
 *
 * | role                    | teams                | players                          |
 * |-------------------------|----------------------|----------------------------------|
 * | admin, academy manager  | unrestricted         | unrestricted                     |
 * | staff                   | assigned via StaffTeam | squad members of those teams   |
 * | parent                  | —                    | their children (PlayerGuardian)  |
 * | player                  | —                    | themselves                       |
 *
 * The staff→players step arrived with `TeamMembership` in Phase 6. Before it,
 * a coach could reach only records they were personally attached to; the
 * behaviour erred closed, and this opens it to exactly their squads.
 */
export async function resolveScope(user: AuthorizedUser): Promise<ScopeFilter> {
  if (isUnscoped(user)) return UNRESTRICTED_SCOPE;

  const [teamIds, directPlayerIds] = await Promise.all([
    findTeamIdsForUser(user.id),
    findPlayerIdsForUser(user.id),
  ]);

  // Squad membership is season-bound, so a coach reaches this season's players
  // — not everyone who has ever passed through the team.
  const season = teamIds.length > 0 ? await findActiveSeason() : null;
  const squadPlayerIds = season
    ? await findPlayerIdsInTeams(teamIds, season.id)
    : [];

  return {
    teamIds,
    playerIds: [...new Set([...directPlayerIds, ...squadPlayerIds])],
  };
}

/** Convenience for services that only narrow by player. */
export async function resolvePlayerScope(
  user: AuthorizedUser,
): Promise<readonly string[] | null> {
  const scope = await resolveScope(user);
  return scope.playerIds;
}

/**
 * Teams whose **schedule** the caller may read.
 *
 * Wider than `scope.teamIds`, and deliberately a separate function rather than
 * a widening of it. A player and a parent hold no `StaffTeam` row at all, so
 * without this a player would open the training calendar and find it empty —
 * but `scope.teamIds` is also what guards the squad list, and widening it
 * there would hand a parent the names of every child in the team
 * (docs/PRODUCT_SPEC.md §8).
 *
 * Built from the caller's **own** players — themselves, or their children —
 * and not from the squads a coach can see. Otherwise a U14 coach would inherit
 * the U16 calendar through a player who trains up an age group.
 *
 * Read-only: writing a session still needs the team in `scope.teamIds`.
 */
export async function resolveScheduleTeamIds(
  user: AuthorizedUser,
): Promise<readonly string[] | null> {
  if (isUnscoped(user)) return null;

  const [assignedTeamIds, ownPlayerIds] = await Promise.all([
    findTeamIdsForUser(user.id),
    findPlayerIdsForUser(user.id),
  ]);

  const season = ownPlayerIds.length > 0 ? await findActiveSeason() : null;
  const squadTeamIds = season
    ? await findTeamIdsForPlayers(ownPlayerIds, season.id)
    : [];

  return [...new Set([...assignedTeamIds, ...squadTeamIds])];
}

/** Convenience for services that only narrow by team. */
export async function resolveTeamScope(
  user: AuthorizedUser,
): Promise<readonly string[] | null> {
  const scope = await resolveScope(user);
  return scope.teamIds;
}
