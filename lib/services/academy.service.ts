import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requirePermission, type AuthorizedUser } from "@/lib/permissions";
import * as repo from "@/lib/repositories/academy.repository";
import type {
  CreateAgeGroupInput,
  CreateSchoolInput,
  CreateSeasonInput,
  CreateSportInput,
  CreateTeamInput,
} from "@/lib/validation/academy";
import { describeBirthYearWindow } from "./age-group";

/**
 * Academy structure: sports, age bands, seasons, schools and teams.
 *
 * Reading needs `academy:read`, which every role holds — everyone needs to see
 * which teams exist. Writing needs `academy:write`, which only an
 * administrator and the academy manager hold.
 *
 * Nothing here is hard-deleted. The structure is referenced by enrolments,
 * training sessions and match records that arrive in later phases, and
 * removing a team would take that history with it (CLAUDE.md §2). Removal is
 * deactivation.
 */

// --- sports -----------------------------------------------------------------

export async function listSports(
  caller: AuthorizedUser,
  includeInactive = false,
) {
  requirePermission(caller, "academy:read");
  return repo.listSports(includeInactive);
}

export async function getSport(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "academy:read");
  const sport = await repo.findSportById(id);
  if (!sport) throw new NotFoundError("رشته ورزشی یافت نشد.");
  return sport;
}

export async function createSport(
  caller: AuthorizedUser,
  input: CreateSportInput,
) {
  requirePermission(caller, "academy:write");

  const sport = await repo.createSport(input);
  logger.info("sport created", { sportId: sport.id, actorId: caller.id });
  return sport;
}

export async function updateSport(
  caller: AuthorizedUser,
  id: string,
  input: Partial<CreateSportInput>,
) {
  requirePermission(caller, "academy:write");
  await getSport(caller, id);

  const sport = await repo.updateSport(id, input);
  logger.info("sport updated", { sportId: id, actorId: caller.id });
  return sport;
}

/**
 * Deactivates a sport.
 *
 * Refused while active age groups, schools or teams still hang off it —
 * otherwise the sport disappears from lists while its teams keep running,
 * which is more confusing than an error.
 */
export async function deactivateSport(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "academy:write");
  await getSport(caller, id);

  const dependants = await repo.countSportDependants(id);
  const total = dependants.ageGroups + dependants.schools + dependants.teams;
  if (total > 0) {
    throw new ConflictError(
      "این رشته ورزشی رده سنی، مدرسه یا تیم فعال دارد و غیرفعال نمی‌شود.",
      dependants,
    );
  }

  logger.info("sport deactivated", { sportId: id, actorId: caller.id });
  return repo.updateSport(id, { isActive: false });
}

// --- age groups -------------------------------------------------------------

export async function listAgeGroups(
  caller: AuthorizedUser,
  sportId?: string,
  includeInactive = false,
) {
  requirePermission(caller, "academy:read");

  const [groups, season] = await Promise.all([
    repo.listAgeGroups({ sportId, includeInactive }),
    repo.findActiveSeason(),
  ]);

  // The birth years a band admits depend on the season, so they are computed
  // per response rather than stored (docs/BUSINESS_RULES.md §4).
  return groups.map((group) => ({
    ...group,
    birthYears: season
      ? describeBirthYearWindow(group, season.startYear)
      : null,
  }));
}

export async function getAgeGroup(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "academy:read");
  const group = await repo.findAgeGroupById(id);
  if (!group) throw new NotFoundError("رده سنی یافت نشد.");
  return group;
}

export async function createAgeGroup(
  caller: AuthorizedUser,
  input: CreateAgeGroupInput,
) {
  requirePermission(caller, "academy:write");

  const sport = await repo.findSportById(input.sportId);
  if (!sport) throw new ValidationError("رشته ورزشی انتخاب‌شده وجود ندارد.");

  // The Zod schema checks this too, but the bound relationship is a domain
  // invariant, not an input format: a service reached from a Server Action or
  // a job must not be able to create an impossible band either. `updateAgeGroup`
  // enforces the same rule.
  if (input.minAge > input.maxAge) {
    throw new ValidationError("حداقل سن نمی‌تواند بیشتر از حداکثر سن باشد.");
  }

  const { sportId, ...rest } = input;
  const group = await repo.createAgeGroup({
    ...rest,
    sport: { connect: { id: sportId } },
  });

  logger.info("age group created", {
    ageGroupId: group.id,
    actorId: caller.id,
  });
  return group;
}

export async function updateAgeGroup(
  caller: AuthorizedUser,
  id: string,
  input: Partial<Omit<CreateAgeGroupInput, "sportId">>,
) {
  requirePermission(caller, "academy:write");
  const existing = await getAgeGroup(caller, id);

  // Either bound may be absent from a partial update, so the pair is checked
  // against the stored values rather than only against each other.
  const minAge = input.minAge ?? existing.minAge;
  const maxAge = input.maxAge ?? existing.maxAge;
  if (minAge > maxAge) {
    throw new ValidationError("حداقل سن نمی‌تواند بیشتر از حداکثر سن باشد.");
  }

  logger.info("age group updated", { ageGroupId: id, actorId: caller.id });
  return repo.updateAgeGroup(id, input);
}

export async function deactivateAgeGroup(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "academy:write");
  await getAgeGroup(caller, id);

  const teams = await repo.countTeamsInAgeGroup(id);
  if (teams > 0) {
    throw new ConflictError("این رده سنی تیم دارد و غیرفعال نمی‌شود.", {
      teams,
    });
  }

  logger.info("age group deactivated", { ageGroupId: id, actorId: caller.id });
  return repo.updateAgeGroup(id, { isActive: false });
}

// --- seasons ----------------------------------------------------------------

export async function listSeasons(caller: AuthorizedUser) {
  requirePermission(caller, "academy:read");
  return repo.listSeasons();
}

export async function getActiveSeason(caller: AuthorizedUser) {
  requirePermission(caller, "academy:read");
  return repo.findActiveSeason();
}

export async function createSeason(
  caller: AuthorizedUser,
  input: CreateSeasonInput,
) {
  requirePermission(caller, "academy:write");

  const season = await repo.createSeason(input);

  // Creating a season directly as ACTIVE must still leave exactly one active.
  if (input.status === "ACTIVE") {
    await repo.setActiveSeason(season.id);
  }

  logger.info("season created", { seasonId: season.id, actorId: caller.id });
  return season;
}

export async function updateSeason(
  caller: AuthorizedUser,
  id: string,
  input: Partial<CreateSeasonInput>,
) {
  requirePermission(caller, "academy:write");

  const existing = await repo.findSeasonById(id);
  if (!existing) throw new NotFoundError("فصل یافت نشد.");

  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate ?? existing.endDate;
  if (startDate >= endDate) {
    throw new ValidationError("تاریخ شروع باید پیش از تاریخ پایان باشد.");
  }

  if (input.status === "ACTIVE") {
    const { status: _status, ...rest } = input;
    await repo.updateSeason(id, rest);
    logger.info("season activated", { seasonId: id, actorId: caller.id });
    return repo.setActiveSeason(id);
  }

  logger.info("season updated", { seasonId: id, actorId: caller.id });
  return repo.updateSeason(id, input);
}

/** Makes one season current; any other active season is closed in the same write. */
export async function activateSeason(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "academy:write");

  const season = await repo.findSeasonById(id);
  if (!season) throw new NotFoundError("فصل یافت نشد.");
  if (season.status === "ARCHIVED") {
    throw new ConflictError("فصل بایگانی‌شده را نمی‌توان فعال کرد.");
  }

  logger.info("season activated", { seasonId: id, actorId: caller.id });
  return repo.setActiveSeason(id);
}

// --- schools ----------------------------------------------------------------

export async function listSchools(
  caller: AuthorizedUser,
  sportId?: string,
  includeInactive = false,
) {
  requirePermission(caller, "academy:read");
  return repo.listSchools({ sportId, includeInactive });
}

export async function getSchool(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "academy:read");
  const school = await repo.findSchoolById(id);
  if (!school) throw new NotFoundError("مدرسه یافت نشد.");
  return school;
}

export async function createSchool(
  caller: AuthorizedUser,
  input: CreateSchoolInput,
) {
  requirePermission(caller, "academy:write");

  const sport = await repo.findSportById(input.sportId);
  if (!sport) throw new ValidationError("رشته ورزشی انتخاب‌شده وجود ندارد.");

  const { sportId, ...rest } = input;
  const school = await repo.createSchool({
    ...rest,
    sport: { connect: { id: sportId } },
  });

  logger.info("school created", { schoolId: school.id, actorId: caller.id });
  return school;
}

export async function updateSchool(
  caller: AuthorizedUser,
  id: string,
  input: Partial<Omit<CreateSchoolInput, "sportId">>,
) {
  requirePermission(caller, "academy:write");
  await getSchool(caller, id);

  logger.info("school updated", { schoolId: id, actorId: caller.id });
  return repo.updateSchool(id, input);
}

export async function deactivateSchool(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "academy:write");
  await getSchool(caller, id);

  logger.info("school deactivated", { schoolId: id, actorId: caller.id });
  return repo.updateSchool(id, { isActive: false });
}

// --- teams ------------------------------------------------------------------

export async function listTeams(
  caller: AuthorizedUser,
  params: {
    sportId?: string | undefined;
    ageGroupId?: string | undefined;
    includeInactive?: boolean;
    skip?: number | undefined;
    take?: number | undefined;
  } = {},
) {
  requirePermission(caller, "academy:read");

  const [result, season] = await Promise.all([
    repo.listTeams({
      sportId: params.sportId,
      ageGroupId: params.ageGroupId,
      includeInactive: params.includeInactive ?? false,
      skip: params.skip,
      take: params.take,
    }),
    repo.findActiveSeason(),
  ]);

  return {
    total: result.total,
    items: result.items.map((team) => ({
      ...team,
      birthYears: season
        ? describeBirthYearWindow(team.ageGroup, season.startYear)
        : null,
    })),
  };
}

export async function getTeam(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "academy:read");
  const team = await repo.findTeamById(id);
  if (!team) throw new NotFoundError("تیم یافت نشد.");

  const season = await repo.findActiveSeason();
  return {
    ...team,
    birthYears: season
      ? describeBirthYearWindow(team.ageGroup, season.startYear)
      : null,
  };
}

export async function createTeam(
  caller: AuthorizedUser,
  input: CreateTeamInput,
) {
  requirePermission(caller, "academy:write");

  const [sport, ageGroup] = await Promise.all([
    repo.findSportById(input.sportId),
    repo.findAgeGroupById(input.ageGroupId),
  ]);

  if (!sport) throw new ValidationError("رشته ورزشی انتخاب‌شده وجود ندارد.");
  if (!ageGroup) throw new ValidationError("رده سنی انتخاب‌شده وجود ندارد.");

  // A team inherits its sport through its age group; letting the two disagree
  // would put a football team in a volleyball band.
  if (ageGroup.sportId !== input.sportId) {
    throw new ValidationError(
      "رده سنی انتخاب‌شده متعلق به این رشته ورزشی نیست.",
    );
  }

  const { sportId, ageGroupId, ...rest } = input;
  const team = await repo.createTeam({
    ...rest,
    sport: { connect: { id: sportId } },
    ageGroup: { connect: { id: ageGroupId } },
  });

  logger.info("team created", { teamId: team.id, actorId: caller.id });
  return team;
}

export async function updateTeam(
  caller: AuthorizedUser,
  id: string,
  input: Partial<Omit<CreateTeamInput, "sportId">>,
) {
  requirePermission(caller, "academy:write");
  const existing = await getTeam(caller, id);

  if (input.ageGroupId && input.ageGroupId !== existing.ageGroupId) {
    const ageGroup = await repo.findAgeGroupById(input.ageGroupId);
    if (!ageGroup) throw new ValidationError("رده سنی انتخاب‌شده وجود ندارد.");
    if (ageGroup.sportId !== existing.sportId) {
      throw new ValidationError(
        "رده سنی انتخاب‌شده متعلق به رشته ورزشی این تیم نیست.",
      );
    }
  }

  const { ageGroupId, ...rest } = input;
  logger.info("team updated", { teamId: id, actorId: caller.id });

  return repo.updateTeam(id, {
    ...rest,
    ...(ageGroupId ? { ageGroup: { connect: { id: ageGroupId } } } : {}),
  });
}

export async function deactivateTeam(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "academy:write");
  await getTeam(caller, id);

  logger.info("team deactivated", { teamId: id, actorId: caller.id });
  return repo.updateTeam(id, { isActive: false });
}
