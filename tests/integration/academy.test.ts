import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as academy from "@/lib/services/academy.service";

async function authorizedUser(mobile: string): Promise<AuthorizedUser> {
  const account = await prisma.user.findUniqueOrThrow({ where: { mobile } });
  const { roles, permissionKeys } = await findUserAuthorization(account.id);
  const known = new Set<string>(ALL_PERMISSIONS);

  return {
    id: account.id,
    mobile: account.mobile,
    roles,
    permissions: permissionKeys.filter((key): key is Permission =>
      known.has(key),
    ),
  };
}

let admin: AuthorizedUser;
let coach: AuthorizedUser;
let parent: AuthorizedUser;

beforeAll(async () => {
  [admin, coach, parent] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000003"),
    authorizedUser("09120000005"),
  ]);
});

/**
 * Slugs created during a run, removed afterwards.
 *
 * Without this the development database accumulates a stray sport per run,
 * and the counts other tests assert on drift.
 */
const createdSlugs: string[] = [];

function uniqueSlug(prefix: string): string {
  const slug = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  createdSlugs.push(slug);
  return slug;
}

afterAll(async () => {
  const sports = await prisma.sport.findMany({
    where: { slug: { in: createdSlugs } },
    select: { id: true },
  });
  const sportIds = sports.map((sport) => sport.id);
  if (sportIds.length === 0) return;

  await prisma.team.deleteMany({ where: { sportId: { in: sportIds } } });
  await prisma.school.deleteMany({ where: { sportId: { in: sportIds } } });
  await prisma.ageGroup.deleteMany({ where: { sportId: { in: sportIds } } });
  await prisma.sport.deleteMany({ where: { id: { in: sportIds } } });
});

describe("reading the structure", () => {
  it("is open to every role that holds academy:read", async () => {
    for (const caller of [admin, coach, parent]) {
      await expect(academy.listSports(caller)).resolves.toBeDefined();
      await expect(academy.listTeams(caller)).resolves.toBeDefined();
    }
  });

  it("lists the seeded football teams with their age bands", async () => {
    const { items } = await academy.listTeams(admin, { includeInactive: true });
    const codes = items.map((team) => team.ageGroup.code);

    expect(codes).toContain("U12");
    expect(codes).toContain("U21");
  });

  /** The decision from Phase 4: bands are ages, birth years are derived. */
  it("derives the admitted birth years from the active season", async () => {
    const season = await academy.getActiveSeason(admin);
    expect(season).not.toBeNull();

    const { items } = await academy.listTeams(admin, {
      includeInactive: true,
    });
    const u14 = items.find((team) => team.ageGroup.code === "U14");

    expect(u14?.birthYears).toEqual({
      from: season!.startYear - u14!.ageGroup.maxAge,
      to: season!.startYear - u14!.ageGroup.minAge,
      label: expect.stringContaining("متولد"),
    });
  });
});

describe("writing the structure", () => {
  it("refuses a coach creating a sport", async () => {
    await expect(
      academy.createSport(coach, {
        slug: uniqueSlug("x"),
        name: "تست",
        displayOrder: 0,
        isActive: true,
      }),
    ).rejects.toThrow();
  });

  it("refuses a parent creating a team", async () => {
    const sports = await academy.listSports(admin, true);
    await expect(
      academy.createTeam(parent, {
        sportId: sports[0]!.id,
        ageGroupId: "whatever",
        slug: uniqueSlug("t"),
        name: "تست",
        isActive: true,
      }),
    ).rejects.toThrow();
  });

  it("lets an administrator create and then deactivate a sport", async () => {
    const slug = uniqueSlug("sport");
    const sport = await academy.createSport(admin, {
      slug,
      name: "رشته آزمایشی",
      displayOrder: 99,
      isActive: true,
    });

    expect(sport.slug).toBe(slug);

    const deactivated = await academy.deactivateSport(admin, sport.id);
    expect(deactivated.isActive).toBe(false);
  });

  it("refuses deactivating a sport that still has teams", async () => {
    const sports = await academy.listSports(admin, true);
    const football = sports.find((sport) => sport.slug === "football");

    await expect(
      academy.deactivateSport(admin, football!.id),
    ).rejects.toThrow();
  });
});

describe("business rules", () => {
  it("refuses an age band whose minimum exceeds its maximum", async () => {
    const sports = await academy.listSports(admin, true);

    await expect(
      academy.createAgeGroup(admin, {
        sportId: sports[0]!.id,
        code: uniqueSlug("U").slice(0, 8).toUpperCase(),
        name: "نامعتبر",
        minAge: 16,
        maxAge: 12,
        displayOrder: 0,
        isActive: true,
      }),
    ).rejects.toThrow();
  });

  /**
   * A team inherits its sport through its age band; letting the two disagree
   * would put a football team in a volleyball band.
   */
  it("refuses a team whose age band belongs to another sport", async () => {
    const sports = await academy.listSports(admin, true);
    const football = sports.find((sport) => sport.slug === "football")!;
    const volleyball = sports.find((sport) => sport.slug === "volleyball")!;

    const volleyballBands = await academy.listAgeGroups(admin, volleyball.id);

    await expect(
      academy.createTeam(admin, {
        sportId: football.id,
        ageGroupId: volleyballBands[0]!.id,
        slug: uniqueSlug("mixed"),
        name: "تیم نامعتبر",
        isActive: true,
      }),
    ).rejects.toThrow();
  });

  it("refuses an unknown sport", async () => {
    await expect(
      academy.createSchool(admin, {
        sportId: "does-not-exist",
        slug: uniqueSlug("s"),
        name: "مدرسه تست",
        isActive: true,
      }),
    ).rejects.toThrow();
  });

  /** Two active seasons would make every age-band calculation ambiguous. */
  it("keeps exactly one season active", async () => {
    const seasons = await academy.listSeasons(admin);
    const other = seasons.find((season) => season.status !== "ACTIVE");
    expect(other).toBeDefined();

    await academy.activateSeason(admin, other!.id);

    const active = await prisma.season.findMany({
      where: { status: "ACTIVE" },
    });
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe(other!.id);

    // Put the seed's season back so later runs start from the same place.
    const seedSeason = seasons.find((season) => season.name === "۱۴۰۴-۱۴۰۵")!;
    await academy.activateSeason(admin, seedSeason.id);

    const restored = await prisma.season.findMany({
      where: { status: "ACTIVE" },
    });
    expect(restored).toHaveLength(1);
  });

  it("reports a duplicate slug as a conflict, not a crash", async () => {
    const slug = uniqueSlug("dup");
    await academy.createSport(admin, {
      slug,
      name: "اول",
      displayOrder: 0,
      isActive: true,
    });

    // The repository throws Prisma's P2002; the API layer maps it to CONFLICT.
    await expect(
      academy.createSport(admin, {
        slug,
        name: "دوم",
        displayOrder: 0,
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
