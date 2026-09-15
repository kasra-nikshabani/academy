import {
  findPlayerIdsForUser,
  findTeamIdsForUser,
} from "@/lib/repositories/people.repository";
import type { AuthorizedUser } from "./authorize";
import { UNRESTRICTED_SCOPE, isUnscoped, type ScopeFilter } from "./scope";

/**
 * Turns a caller into the set of records they may reach.
 *
 * Phase 3 defined the shape of this and stopped, because the tables it reads
 * (`StaffTeam`, `PlayerGuardian`) did not exist yet. They do now.
 *
 * Resolved once per request and handed to repositories, which apply it inside
 * their queries. A permission says a coach may write training; this says which
 * teams that applies to.
 */
export async function resolveScope(user: AuthorizedUser): Promise<ScopeFilter> {
  // Admin and academy manager run the whole academy; everyone else is narrowed,
  // even when they hold the permission.
  if (isUnscoped(user)) return UNRESTRICTED_SCOPE;

  const [teamIds, playerIds] = await Promise.all([
    findTeamIdsForUser(user.id),
    findPlayerIdsForUser(user.id),
  ]);

  return { teamIds, playerIds };
}

/**
 * Scope for reading players.
 *
 * A coach reaches the players of their teams, a guardian reaches their
 * children, a player reaches themselves. Squad membership lands in Phase 6
 * (`TeamMembership`), so a coach's team-derived players cannot be resolved
 * yet — until then a coach sees only what they are personally linked to, which
 * errs closed rather than open.
 */
export async function resolvePlayerScope(
  user: AuthorizedUser,
): Promise<readonly string[] | null> {
  const scope = await resolveScope(user);
  return scope.playerIds;
}
