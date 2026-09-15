import { findActiveSeason } from "@/lib/repositories/academy.repository";
import { findPlayerIdsInTeams } from "@/lib/repositories/enrollment.repository";
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

/** Convenience for services that only narrow by team. */
export async function resolveTeamScope(
  user: AuthorizedUser,
): Promise<readonly string[] | null> {
  const scope = await resolveScope(user);
  return scope.teamIds;
}
