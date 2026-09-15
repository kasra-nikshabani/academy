import { OutOfScopeError } from "@/lib/errors";
import type { AuthorizedUser } from "./authorize";

/**
 * Scope: the second half of authorization.
 *
 * A permission answers "may this role do this kind of thing". Scope answers
 * "may they do it to *this* record". The two are kept apart because collapsing
 * them is how a coach with `training:write` ends up editing another team's
 * session.
 *
 * A caller is turned into a `ScopeFilter` by `resolveScope` (./resolve-scope),
 * which reads `StaffTeam` and `PlayerGuardian`. Repositories take that filter
 * and apply it **inside** their queries.
 *
 * That last part is not a style preference. Fetching everything and filtering
 * afterwards still leaks: the total count in a paginated response and the time
 * the request takes both reveal records the caller cannot see.
 */

/** A narrowing a repository applies inside its query, not after it. */
export interface ScopeFilter {
  /** Teams the caller may see; `null` means unrestricted. */
  teamIds: readonly string[] | null;
  /** Players the caller may see; `null` means unrestricted. */
  playerIds: readonly string[] | null;
}

export const UNRESTRICTED_SCOPE: ScopeFilter = {
  teamIds: null,
  playerIds: null,
};

/**
 * Rejects a record that falls outside a resolved scope.
 *
 * Used once Phase 5 can resolve the id lists; the message never says *why* a
 * record is out of reach, so a caller cannot map out what exists by probing.
 */
export function assertWithinScope(
  allowedIds: readonly string[] | null,
  targetId: string,
): void {
  if (allowedIds === null) return;
  if (!allowedIds.includes(targetId)) {
    throw new OutOfScopeError();
  }
}

/**
 * Whether the caller is exempt from record-level narrowing for a resource.
 *
 * Deliberately narrow: only ADMIN and ACADEMY_MANAGER run the whole academy.
 * Everyone else is scoped even when they hold the permission.
 */
export function isUnscoped(user: AuthorizedUser): boolean {
  return user.roles.includes("ADMIN") || user.roles.includes("ACADEMY_MANAGER");
}
