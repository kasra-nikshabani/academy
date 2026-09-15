import { buildPaginationMeta, type PaginationQuery } from "@/lib/api";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  assertWithinScope,
  hasRole,
  requirePermission,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import {
  findActiveSeason,
  findSchoolById,
  findSeasonById,
  findTeamById,
} from "@/lib/repositories/academy.repository";
import * as repo from "@/lib/repositories/enrollment.repository";
import { findPlayerById } from "@/lib/repositories/people.repository";
import { isBirthYearEligible } from "./age-group";
import { toJalali } from "@/lib/utils/date";
import type {
  CreateEnrollmentInput,
  CreateMembershipInput,
} from "@/lib/validation/enrollment";

/**
 * School enrolment and team membership.
 *
 * The two are independent by design: a player may attend a school and belong
 * to a squad at the same time, and accepting a school player into a main team
 * does **not** end their school enrolment. Only an explicit decision does
 * (BUSINESS_RULES §2).
 */

async function requireSeason(seasonId?: string) {
  const season = seasonId
    ? await findSeasonById(seasonId)
    : await findActiveSeason();

  if (!season) {
    throw new ValidationError(
      "فصل فعالی تعریف نشده است؛ ابتدا فصل جاری را مشخص کنید.",
    );
  }
  return season;
}

// --- school enrolment -------------------------------------------------------

export async function listEnrollments(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
  filters: {
    schoolId?: string | undefined;
    seasonId?: string | undefined;
    status?: string | undefined;
  } = {},
) {
  requirePermission(caller, "enrollment:read");

  const scope = await resolveScope(caller);

  const { items, total } = await repo.listEnrollments({
    ...filters,
    allowedPlayerIds: scope.playerIds,
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

export async function enrollPlayerInSchool(
  caller: AuthorizedUser,
  input: CreateEnrollmentInput,
) {
  requirePermission(caller, "enrollment:write");

  const [player, school, season] = await Promise.all([
    findPlayerById(input.playerId),
    findSchoolById(input.schoolId),
    requireSeason(input.seasonId),
  ]);

  if (!player) throw new ValidationError("بازیکن انتخاب‌شده وجود ندارد.");
  if (!school) throw new ValidationError("مدرسه انتخاب‌شده وجود ندارد.");

  const existing = await repo.findSchoolEnrollment(
    input.playerId,
    input.schoolId,
    season.id,
  );
  if (existing) {
    throw new ConflictError(
      "این بازیکن در همین فصل در این مدرسه ثبت‌نام شده است.",
      { enrollmentId: existing.id, status: existing.status },
    );
  }

  const enrollment = await repo.createSchoolEnrollment({
    playerId: input.playerId,
    schoolId: input.schoolId,
    seasonId: season.id,
    status: input.status,
    notes: input.notes,
  });

  logger.info("player enrolled in school", {
    enrollmentId: enrollment.id,
    playerId: input.playerId,
    schoolId: input.schoolId,
    actorId: caller.id,
  });

  return enrollment;
}

/**
 * Changes an enrolment's status.
 *
 * This is the only way a school enrolment ends. Nothing about joining a team
 * touches it — that separation is the whole point of BUSINESS_RULES §2.
 */
export async function updateEnrollmentStatus(
  caller: AuthorizedUser,
  id: string,
  input: { status: string; notes?: string | undefined },
) {
  requirePermission(caller, "enrollment:write");

  const enrollment = await repo.findEnrollmentById(id);
  if (!enrollment) throw new NotFoundError("ثبت‌نام یافت نشد.");

  const ending = ["TRANSFERRED", "COMPLETED", "CANCELLED"].includes(
    input.status,
  );

  logger.info("school enrollment status changed", {
    enrollmentId: id,
    from: enrollment.status,
    to: input.status,
    actorId: caller.id,
  });

  return repo.updateSchoolEnrollment(id, {
    status: input.status as never,
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    // The row is kept either way; only the end date is stamped.
    ...(ending ? { endedAt: new Date() } : { endedAt: null }),
  });
}

export async function listPlayerEnrollments(
  caller: AuthorizedUser,
  playerId: string,
) {
  requirePermission(caller, "enrollment:read");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, playerId);

  return repo.listEnrollmentsForPlayer(playerId);
}

// --- team membership --------------------------------------------------------

export async function listPlayerMemberships(
  caller: AuthorizedUser,
  playerId: string,
) {
  requirePermission(caller, "enrollment:read");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, playerId);

  return repo.listMembershipsForPlayer(playerId);
}

export async function listTeamRoster(caller: AuthorizedUser, teamId: string) {
  requirePermission(caller, "enrollment:read");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.teamIds, teamId);

  const season = await requireSeason();
  return repo.listTeamRoster({ teamId, seasonId: season.id });
}

/**
 * Adds a player to a squad.
 *
 * Age eligibility is checked against the team's band for the season
 * (BUSINESS_RULES §4). An administrator may override it; anyone else is
 * refused, and the override is written onto the membership so the exception is
 * visible on the record rather than invisible in someone's memory.
 */
export async function addPlayerToTeam(
  caller: AuthorizedUser,
  input: CreateMembershipInput,
) {
  requirePermission(caller, "enrollment:write");

  const [player, team, season] = await Promise.all([
    findPlayerById(input.playerId),
    findTeamById(input.teamId),
    requireSeason(input.seasonId),
  ]);

  if (!player) throw new ValidationError("بازیکن انتخاب‌شده وجود ندارد.");
  if (!team) throw new ValidationError("تیم انتخاب‌شده وجود ندارد.");

  const birthDate = player.person.dateOfBirth;
  if (!birthDate) {
    throw new ValidationError(
      "تاریخ تولد بازیکن ثبت نشده است؛ رده سنی قابل بررسی نیست.",
    );
  }

  const birthYear = toJalali(birthDate).jy;
  const eligible = isBirthYearEligible(
    team.ageGroup,
    season.startYear,
    birthYear,
  );

  if (!eligible) {
    if (!input.ageException) {
      throw new ValidationError(
        `سال تولد بازیکن با رده سنی ${team.ageGroup.code} هم‌خوان نیست.`,
        {
          birthYear,
          ageGroup: team.ageGroup.code,
          allowed: {
            from: season.startYear - team.ageGroup.maxAge,
            to: season.startYear - team.ageGroup.minAge,
          },
        },
      );
    }

    // Only an administrator may waive the band.
    if (!hasRole(caller, "ADMIN")) {
      throw new ValidationError(
        "استثنای رده سنی فقط توسط مدیر سیستم قابل ثبت است.",
      );
    }
  }

  const exceptionNote =
    !eligible && input.ageException
      ? `استثنای رده سنی — متولد ${birthYear}، رده ${team.ageGroup.code}`
      : undefined;

  const membership = await repo.upsertMembership({
    playerId: input.playerId,
    teamId: input.teamId,
    seasonId: season.id,
    isPrimary: input.isPrimary,
    jerseyNumber: input.jerseyNumber,
    notes:
      [input.notes, exceptionNote].filter(Boolean).join(" · ") || undefined,
  });

  logger.info("player added to team", {
    membershipId: membership.id,
    playerId: input.playerId,
    teamId: input.teamId,
    isPrimary: input.isPrimary,
    ageException: !eligible,
    actorId: caller.id,
  });

  return membership;
}

/** Ends a membership. The row stays; only the status and leave date change. */
export async function endPlayerMembership(
  caller: AuthorizedUser,
  id: string,
  status: "INACTIVE" | "RELEASED",
) {
  requirePermission(caller, "enrollment:write");

  const membership = await repo.findMembershipById(id);
  if (!membership) throw new NotFoundError("عضویت یافت نشد.");

  logger.info("player membership ended", {
    membershipId: id,
    status,
    actorId: caller.id,
  });

  return repo.endMembership(id, status);
}
