import {
  buildPaginationMeta,
  type PaginationMeta,
  type PaginationQuery,
} from "@/lib/api";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  assertWithinScope,
  hasPermission,
  isUnscoped,
  requirePermission,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import * as repo from "@/lib/repositories/people.repository";
import { findActiveSeason } from "@/lib/repositories/academy.repository";
import { runInTransaction } from "@/lib/repositories/transaction";
import { recordJourneyEvent } from "./journey.service";
import type {
  CreateGuardianInput,
  CreatePlayerInput,
  CreateStaffInput,
} from "@/lib/validation/people";

/**
 * Players, guardians and staff.
 *
 * Every read here runs two checks, never one:
 *   1. permission — may this role read players at all?
 *   2. scope      — which players, specifically?
 *
 * The second is the reason this phase waited for `StaffTeam` and
 * `PlayerGuardian` (docs/PERMISSIONS.md §5).
 */

/** Prisma's code for a unique-constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Allocates a player code and runs the write, retrying if another registration
 * took the same code first.
 *
 * Bounded: after a few attempts something other than contention is wrong, and
 * looping forever would turn a bug into a hung request.
 */
/**
 * Allocates a player code and retries when two callers take the same one.
 *
 * Exported because tryout registration needs it too — and that is the place
 * it matters most: a public form is where a dozen families register in the
 * same minute (BUSINESS_RULES §1).
 */
export async function createWithPlayerCode<T>(
  seasonYear: number,
  write: (playerCode: string) => Promise<T>,
): Promise<T> {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const playerCode = await repo.nextPlayerCode(seasonYear);
    try {
      return await write(playerCode);
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === MAX_ATTEMPTS) throw error;
      logger.warn("player code was taken, retrying", { attempt });
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new Error("could not allocate a player code");
}

// --- players ----------------------------------------------------------------

export async function listPlayers(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
  filters: { search?: string | undefined; status?: string | undefined } = {},
): Promise<{ items: repo.PlayerWithPerson[]; meta: PaginationMeta }> {
  requirePermission(caller, "player:read");

  const scope = await resolveScope(caller);

  const { items, total } = await repo.listPlayers({
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    search: filters.search,
    status: filters.status,
    // Narrowed inside the query — a post-filter would still leak the count.
    allowedPlayerIds: scope.playerIds,
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

/**
 * One player.
 *
 * Scope is checked **before** the record is looked up, so an id that does not
 * exist and an id belonging to someone else's child are indistinguishable to
 * the caller.
 */
export async function getPlayer(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "player:read");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, id);

  const player = await repo.findPlayerById(id);
  if (!player) throw new NotFoundError("بازیکن یافت نشد.");

  // Medical notes are sensitive and are not part of a general read.
  if (!hasPermission(caller, "player:write")) {
    return { ...player, medicalNotes: null };
  }

  return player;
}

export async function createPlayer(
  caller: AuthorizedUser,
  input: CreatePlayerInput,
) {
  requirePermission(caller, "player:write");

  // BUSINESS_RULES §1: the national code is what stops the same child being
  // created twice — most often at tryout registration.
  if (input.nationalCode) {
    const existing = await repo.findPlayerByNationalCode(input.nationalCode);
    if (existing) {
      throw new ConflictError("بازیکنی با این کد ملی از قبل ثبت شده است.", {
        playerId: existing.id,
        playerCode: existing.playerCode,
      });
    }
  }

  const season = await findActiveSeason();
  if (!season) {
    throw new ValidationError(
      "فصل فعالی تعریف نشده است؛ ابتدا فصل جاری را مشخص کنید.",
    );
  }

  const {
    position,
    jerseyNumber,
    dominantFoot,
    heightCm,
    weightKg,
    medicalNotes,
    ...person
  } = input;

  /**
   * The player and the first line of their timeline are written together: a
   * player with no beginning, or a beginning with no player, would both be
   * wrong (docs/BUSINESS_RULES.md §12).
   *
   * The player code is allocated by reading the highest one and adding one,
   * which two registrations happening at the same moment will both read. That
   * is not hypothetical — two staff registering during a trial session is the
   * normal case — so a collision is retried rather than surfaced as "a record
   * with these details already exists", which would be both confusing and
   * untrue.
   */
  const player = await createWithPlayerCode(season.startYear, (playerCode) =>
    runInTransaction(async (tx) => {
      const created = await repo.createPlayerWithPerson(
        person,
        {
          playerCode,
          ...(position ? { position } : {}),
          ...(jerseyNumber ? { jerseyNumber } : {}),
          ...(dominantFoot ? { dominantFoot } : {}),
          ...(heightCm ? { heightCm } : {}),
          ...(weightKg ? { weightKg } : {}),
          ...(medicalNotes ? { medicalNotes } : {}),
        },
        tx,
      );

      await recordJourneyEvent(
        {
          playerId: created.id,
          type: "REGISTERED",
          title: "ثبت‌نام در آکادمی",
          description: `کد بازیکن ${created.playerCode}`,
          actorId: caller.id,
        },
        tx,
      );

      return created;
    }),
  );

  // Never log the national code or the medical note (CLAUDE.md §27).
  logger.info("player created", {
    playerId: player.id,
    playerCode: player.playerCode,
    actorId: caller.id,
  });

  return player;
}

export async function updatePlayer(
  caller: AuthorizedUser,
  id: string,
  input: Record<string, unknown>,
) {
  requirePermission(caller, "player:write");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, id);

  const player = await repo.findPlayerById(id);
  if (!player) throw new NotFoundError("بازیکن یافت نشد.");

  const {
    firstName,
    lastName,
    nationalCode,
    dateOfBirth,
    gender,
    mobile,
    email,
    city,
    address,
    ...playerFields
  } = input;

  const personFields = {
    ...(firstName !== undefined ? { firstName } : {}),
    ...(lastName !== undefined ? { lastName } : {}),
    ...(nationalCode !== undefined ? { nationalCode } : {}),
    ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
    ...(gender !== undefined ? { gender } : {}),
    ...(mobile !== undefined ? { mobile } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(city !== undefined ? { city } : {}),
    ...(address !== undefined ? { address } : {}),
  };

  if (Object.keys(personFields).length > 0) {
    await repo.updatePerson(player.personId, personFields as never);
  }

  logger.info("player updated", { playerId: id, actorId: caller.id });

  return Object.keys(playerFields).length > 0
    ? repo.updatePlayer(id, playerFields as never)
    : repo.findPlayerById(id);
}

// --- guardians --------------------------------------------------------------

export async function createGuardian(
  caller: AuthorizedUser,
  input: CreateGuardianInput,
) {
  requirePermission(caller, "guardian:write");

  if (input.nationalCode) {
    const existing = await repo.findGuardianByNationalCode(input.nationalCode);
    if (existing) {
      throw new ConflictError("ولی‌ای با این کد ملی از قبل ثبت شده است.", {
        guardianId: existing.id,
      });
    }
  }

  const { occupation, ...person } = input;
  const guardian = await repo.createGuardianWithPerson({
    ...person,
    ...(occupation ? { guardian: { create: { occupation } } } : {}),
  } as never);

  logger.info("guardian created", {
    guardianId: guardian.id,
    actorId: caller.id,
  });
  return guardian;
}

/**
 * Joins a guardian to a player.
 *
 * This write *is* what grants a parent access, so it needs the permission to
 * change a player's record, not merely to read guardians.
 */
export async function linkGuardian(
  caller: AuthorizedUser,
  playerId: string,
  input: {
    guardianId: string;
    relation:
      | "FATHER"
      | "MOTHER"
      | "GRANDPARENT"
      | "SIBLING"
      | "LEGAL_GUARDIAN"
      | "OTHER";
    isPrimary: boolean;
  },
) {
  requirePermission(caller, "player:write");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, playerId);

  const player = await repo.findPlayerById(playerId);
  if (!player) throw new NotFoundError("بازیکن یافت نشد.");

  const link = await repo.linkGuardianToPlayer({ playerId, ...input });

  logger.info("guardian linked to player", {
    playerId,
    guardianId: input.guardianId,
    actorId: caller.id,
  });

  return link;
}

// --- staff ------------------------------------------------------------------

export async function listStaff(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
) {
  requirePermission(caller, "staff:read");

  const scope = await resolveScope(caller);

  const { items, total } = await repo.listStaff({
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    allowedTeamIds: scope.teamIds,
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

export async function getStaff(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "staff:read");

  const staff = await repo.findStaffById(id);
  if (!staff) throw new NotFoundError("عضو کادر فنی یافت نشد.");

  // A scoped caller may only reach staff sharing one of their teams.
  if (!isUnscoped(caller)) {
    const scope = await resolveScope(caller);
    const shared = staff.teams.some((assignment) =>
      (scope.teamIds ?? []).includes(assignment.teamId),
    );
    if (!shared) assertWithinScope([], id);
  }

  return staff;
}

export async function createStaff(
  caller: AuthorizedUser,
  input: CreateStaffInput,
) {
  requirePermission(caller, "staff:write");

  const { title, specialization, hiredAt, ...person } = input;
  const staff = await repo.createStaffWithPerson({
    ...person,
    ...(title || specialization || hiredAt
      ? {
          staff: {
            create: {
              ...(title ? { title } : {}),
              ...(specialization ? { specialization } : {}),
              ...(hiredAt ? { hiredAt } : {}),
            },
          },
        }
      : {}),
  } as never);

  logger.info("staff created", { staffId: staff.id, actorId: caller.id });
  return staff;
}

/**
 * Assigns a staff member to a team.
 *
 * This is the write that grants a coach access to a team, so it is restricted
 * to callers who may change the academy structure — a coach must not be able
 * to widen their own reach.
 */
export async function assignStaffToTeam(
  caller: AuthorizedUser,
  staffId: string,
  input: { teamId: string; role: string },
) {
  requirePermission(caller, "staff:write");

  const staff = await repo.findStaffById(staffId);
  if (!staff) throw new NotFoundError("عضو کادر فنی یافت نشد.");

  const assignment = await repo.assignStaffToTeam({
    staffId,
    teamId: input.teamId,
    role: input.role as never,
  });

  logger.info("staff assigned to team", {
    staffId,
    teamId: input.teamId,
    actorId: caller.id,
  });

  return assignment;
}

export async function unassignStaffFromTeam(
  caller: AuthorizedUser,
  staffId: string,
  teamId: string,
) {
  requirePermission(caller, "staff:write");

  logger.info("staff unassigned from team", {
    staffId,
    teamId,
    actorId: caller.id,
  });

  return repo.unassignStaffFromTeam(staffId, teamId);
}
