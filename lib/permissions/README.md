# lib/permissions

RBAC and scope enforcement. **Implemented in Phase 3 (RBAC).**

Planned contents:

- `permissions.ts` — the permission catalogue (`player:read`, `training:write`, …)
- `authorize.ts` — `requirePermission(user, permission)` for services
- `scope.ts` — `assertTeamScope`, `assertChildScope`, `assertOwnRecord`

Two distinct checks, never collapsed into one (CLAUDE.md §2, MASTER_PROMPT §8):

1. **Permission** — may this role perform this action at all?
2. **Scope** — is this specific record inside the caller's reach? A coach holding
   `training:write` still may not touch a team they are not assigned to, and a
   parent may only ever reach their own children.

Both are enforced in the service layer. UI-side hiding is presentation only and
is never the enforcement point.
