import { prisma } from "@/lib/db";
import type {
  AgeGroup,
  School,
  Season,
  Sport,
  Team,
} from "@/lib/generated/prisma/client";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

// --- sports -----------------------------------------------------------------

export async function listSports(includeInactive: boolean): Promise<Sport[]> {
  return prisma.sport.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

export function findSportById(id: string): Promise<Sport | null> {
  return prisma.sport.findUnique({ where: { id } });
}

export function findSportBySlug(slug: string): Promise<Sport | null> {
  return prisma.sport.findUnique({ where: { slug } });
}

export function createSport(data: Prisma.SportCreateInput): Promise<Sport> {
  return prisma.sport.create({ data });
}

export function updateSport(
  id: string,
  data: Prisma.SportUpdateInput,
): Promise<Sport> {
  return prisma.sport.update({ where: { id }, data });
}

/** Counts of the things that would be orphaned by removing a sport. */
export async function countSportDependants(
  id: string,
): Promise<{ ageGroups: number; schools: number; teams: number }> {
  const [ageGroups, schools, teams] = await prisma.$transaction([
    prisma.ageGroup.count({ where: { sportId: id } }),
    prisma.school.count({ where: { sportId: id } }),
    prisma.team.count({ where: { sportId: id } }),
  ]);
  return { ageGroups, schools, teams };
}

// --- age groups -------------------------------------------------------------

export async function listAgeGroups(params: {
  sportId?: string | undefined;
  includeInactive: boolean;
}): Promise<AgeGroup[]> {
  return prisma.ageGroup.findMany({
    where: {
      ...(params.sportId ? { sportId: params.sportId } : {}),
      ...(params.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ displayOrder: "asc" }, { minAge: "asc" }],
  });
}

export function findAgeGroupById(id: string): Promise<AgeGroup | null> {
  return prisma.ageGroup.findUnique({ where: { id } });
}

export function createAgeGroup(
  data: Prisma.AgeGroupCreateInput,
): Promise<AgeGroup> {
  return prisma.ageGroup.create({ data });
}

export function updateAgeGroup(
  id: string,
  data: Prisma.AgeGroupUpdateInput,
): Promise<AgeGroup> {
  return prisma.ageGroup.update({ where: { id }, data });
}

export function countTeamsInAgeGroup(ageGroupId: string): Promise<number> {
  return prisma.team.count({ where: { ageGroupId } });
}

// --- seasons ----------------------------------------------------------------

export async function listSeasons(): Promise<Season[]> {
  return prisma.season.findMany({ orderBy: { startYear: "desc" } });
}

export function findSeasonById(id: string): Promise<Season | null> {
  return prisma.season.findUnique({ where: { id } });
}

export function findActiveSeason(): Promise<Season | null> {
  return prisma.season.findFirst({ where: { status: "ACTIVE" } });
}

/**
 * The season a given instant falls inside.
 *
 * Used when a training session is scheduled: the session belongs to the season
 * it is *played* in, which is not always the one that happened to be active
 * when a coach typed it in.
 */
export function findSeasonForDate(date: Date): Promise<Season | null> {
  return prisma.season.findFirst({
    where: { startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { startYear: "desc" },
  });
}

export function createSeason(data: Prisma.SeasonCreateInput): Promise<Season> {
  return prisma.season.create({ data });
}

export function updateSeason(
  id: string,
  data: Prisma.SeasonUpdateInput,
): Promise<Season> {
  return prisma.season.update({ where: { id }, data });
}

/**
 * Makes one season current.
 *
 * Both writes go in one transaction: a moment with two active seasons — or
 * none — would make every age-group calculation ambiguous.
 */
export async function setActiveSeason(id: string): Promise<Season> {
  const [, season] = await prisma.$transaction([
    prisma.season.updateMany({
      where: { status: "ACTIVE", id: { not: id } },
      data: { status: "COMPLETED" },
    }),
    prisma.season.update({ where: { id }, data: { status: "ACTIVE" } }),
  ]);
  return season;
}

// --- schools ----------------------------------------------------------------

export async function listSchools(params: {
  sportId?: string | undefined;
  includeInactive: boolean;
}): Promise<Array<School & { sport: { id: string; name: string } }>> {
  return prisma.school.findMany({
    where: {
      ...(params.sportId ? { sportId: params.sportId } : {}),
      ...(params.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: "asc" },
    include: { sport: { select: { id: true, name: true } } },
  });
}

export function findSchoolById(id: string): Promise<School | null> {
  return prisma.school.findUnique({ where: { id } });
}

export function createSchool(data: Prisma.SchoolCreateInput): Promise<School> {
  return prisma.school.create({ data });
}

export function updateSchool(
  id: string,
  data: Prisma.SchoolUpdateInput,
): Promise<School> {
  return prisma.school.update({ where: { id }, data });
}

// --- teams ------------------------------------------------------------------

export type TeamWithRelations = Team & {
  sport: { id: string; name: string };
  ageGroup: {
    id: string;
    code: string;
    name: string;
    minAge: number;
    maxAge: number;
  };
};

export async function listTeams(params: {
  sportId?: string | undefined;
  ageGroupId?: string | undefined;
  includeInactive: boolean;
  skip?: number | undefined;
  take?: number | undefined;
}): Promise<{ items: TeamWithRelations[]; total: number }> {
  const where = {
    ...(params.sportId ? { sportId: params.sportId } : {}),
    ...(params.ageGroupId ? { ageGroupId: params.ageGroupId } : {}),
    ...(params.includeInactive ? {} : { isActive: true }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.team.findMany({
      where,
      orderBy: [{ ageGroup: { minAge: "asc" } }, { name: "asc" }],
      ...(params.skip === undefined ? {} : { skip: params.skip }),
      ...(params.take === undefined ? {} : { take: params.take }),
      include: {
        sport: { select: { id: true, name: true } },
        ageGroup: {
          select: {
            id: true,
            code: true,
            name: true,
            minAge: true,
            maxAge: true,
          },
        },
      },
    }),
    prisma.team.count({ where }),
  ]);

  return { items, total };
}

export function findTeamById(id: string): Promise<TeamWithRelations | null> {
  return prisma.team.findUnique({
    where: { id },
    include: {
      sport: { select: { id: true, name: true } },
      ageGroup: {
        select: {
          id: true,
          code: true,
          name: true,
          minAge: true,
          maxAge: true,
        },
      },
    },
  });
}

/**
 * Active teams, narrowed to a set of ids — `null` for every team.
 *
 * Feeds the training calendar's team filter, so the chips a caller is offered
 * are exactly the calendars they are allowed to open.
 */
export function listTeamsByIds(
  allowedTeamIds: readonly string[] | null,
): Promise<Array<Pick<Team, "id" | "name" | "slug">>> {
  return prisma.team.findMany({
    where: {
      isActive: true,
      ...(allowedTeamIds === null ? {} : { id: { in: [...allowedTeamIds] } }),
    },
    orderBy: [{ ageGroup: { minAge: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

export function createTeam(data: Prisma.TeamCreateInput): Promise<Team> {
  return prisma.team.create({ data });
}

export function updateTeam(
  id: string,
  data: Prisma.TeamUpdateInput,
): Promise<Team> {
  return prisma.team.update({ where: { id }, data });
}
