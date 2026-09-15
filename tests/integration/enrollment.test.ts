import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import { resolveScope } from "@/lib/permissions";
import type { AuthorizedUser } from "@/lib/permissions";
import * as enrollment from "@/lib/services/enrollment.service";
import { getPlayer, listPlayers } from "@/lib/services/people.service";

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
let manager: AuthorizedUser;
let coach: AuthorizedUser;

let seasonId: string;
let u14Id: string;
let u16Id: string;
let schoolId: string;

beforeAll(async () => {
  [admin, manager, coach] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000002"),
    authorizedUser("09120000003"),
  ]);

  const season = await prisma.season.findFirstOrThrow({
    where: { status: "ACTIVE" },
  });
  seasonId = season.id;

  // Selected by slug, not by age-group code: the E2E helpers create their own
  // teams in the same bands, and matching on the band picked one of those.
  u14Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u14" } })
  ).id;
  u16Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u16" } })
  ).id;

  schoolId = (await prisma.school.findFirstOrThrow()).id;
});

/** A fresh player born in a given Jalali year, cleaned up by the caller. */
async function makePlayer(birthYear: number, suffix: string) {
  const person = await prisma.person.create({
    data: {
      firstName: "آزمون",
      lastName: suffix,
      dateOfBirth: new Date(Date.UTC(birthYear + 621, 7, 15, 9)),
      player: {
        create: { playerCode: `TST-${suffix}-${Date.now() % 1000000}` },
      },
    },
    include: { player: true },
  });
  return person.player!;
}

describe("coach scope now reaches squad players", () => {
  /**
   * The step Phase 5 could not take: a coach's reach widens from "my teams"
   * to "the players in my teams", through TeamMembership.
   */
  it("includes the players of a coach's own team", async () => {
    const scope = await resolveScope(coach);

    const roster = await prisma.teamMembership.findMany({
      where: { teamId: u14Id, seasonId, status: "ACTIVE", leftAt: null },
      select: { playerId: true },
    });

    expect(roster.length).toBeGreaterThan(0);
    for (const row of roster) {
      expect(scope.playerIds).toContain(row.playerId);
    }
  });

  it("excludes the players of another coach's team", async () => {
    const scope = await resolveScope(coach);

    const otherRoster = await prisma.teamMembership.findMany({
      where: { teamId: u16Id, seasonId, status: "ACTIVE" },
      select: { playerId: true },
    });

    expect(otherRoster.length).toBeGreaterThan(0);
    for (const row of otherRoster) {
      expect(scope.playerIds).not.toContain(row.playerId);
    }
  });

  it("refuses a coach reading a player from another team", async () => {
    const other = await prisma.teamMembership.findFirstOrThrow({
      where: { teamId: u16Id, seasonId, status: "ACTIVE" },
    });

    await expect(getPlayer(coach, other.playerId)).rejects.toThrow();
  });

  it("lets a coach read a player from their own team", async () => {
    const own = await prisma.teamMembership.findFirstOrThrow({
      where: { teamId: u14Id, seasonId, status: "ACTIVE", leftAt: null },
    });

    await expect(getPlayer(coach, own.playerId)).resolves.toBeDefined();
  });

  /** Leaving the squad must remove the coach's access, not just the listing. */
  it("drops a player once they leave the squad", async () => {
    const membership = await prisma.teamMembership.findFirstOrThrow({
      where: { teamId: u14Id, seasonId, status: "ACTIVE" },
    });

    await enrollment.endPlayerMembership(admin, membership.id, "RELEASED");

    const after = await resolveScope(coach);
    expect(after.playerIds).not.toContain(membership.playerId);

    // The row itself must still exist — squad history is not deleted.
    const stillThere = await prisma.teamMembership.findUnique({
      where: { id: membership.id },
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.leftAt).not.toBeNull();

    await prisma.teamMembership.update({
      where: { id: membership.id },
      data: { status: "ACTIVE", leftAt: null, isPrimary: true },
    });
  });

  it("narrows the coach's player list to their squad", async () => {
    const { items, meta } = await listPlayers(coach, {
      page: 1,
      pageSize: 100,
    });

    const scope = await resolveScope(coach);
    expect(meta.total).toBe(items.length);
    for (const item of items) {
      expect(scope.playerIds).toContain(item.id);
    }
  });
});

describe("age band at enrolment", () => {
  it("accepts a player whose birth year fits the band", async () => {
    // U14 in season 1405 admits 1392–1393.
    const player = await makePlayer(1392, "fit");

    const membership = await enrollment.addPlayerToTeam(admin, {
      playerId: player.id,
      teamId: u14Id,
      isPrimary: true,
      ageException: false,
    });

    expect(membership.teamId).toBe(u14Id);
    await prisma.teamMembership.deleteMany({ where: { playerId: player.id } });
    await prisma.person.deleteMany({ where: { id: player.personId } });
  });

  it("refuses a player outside the band", async () => {
    const player = await makePlayer(1388, "too-old");

    await expect(
      enrollment.addPlayerToTeam(admin, {
        playerId: player.id,
        teamId: u14Id,
        isPrimary: true,
        ageException: false,
      }),
    ).rejects.toThrow();

    await prisma.person.deleteMany({ where: { id: player.personId } });
  });

  /** BUSINESS_RULES §4: an administrator may waive the band. */
  it("lets an administrator record an exception", async () => {
    const player = await makePlayer(1388, "exception");

    const membership = await enrollment.addPlayerToTeam(admin, {
      playerId: player.id,
      teamId: u14Id,
      isPrimary: true,
      ageException: true,
    });

    // The exception is written onto the record, not left to memory.
    expect(membership.notes).toContain("استثنای رده سنی");

    await prisma.teamMembership.deleteMany({ where: { playerId: player.id } });
    await prisma.person.deleteMany({ where: { id: player.personId } });
  });

  it("refuses an exception from anyone but an administrator", async () => {
    const player = await makePlayer(1388, "no-waiver");

    await expect(
      enrollment.addPlayerToTeam(manager, {
        playerId: player.id,
        teamId: u14Id,
        isPrimary: true,
        ageException: true,
      }),
    ).rejects.toThrow();

    await prisma.person.deleteMany({ where: { id: player.personId } });
  });
});

describe("school enrolment survives joining a team", () => {
  /**
   * BUSINESS_RULES §2, the rule the club was most explicit about: being
   * accepted into a squad must not quietly end a school enrolment.
   */
  it("leaves the school enrolment active when a player joins a squad", async () => {
    const player = await makePlayer(1392, "both");

    await enrollment.enrollPlayerInSchool(admin, {
      playerId: player.id,
      schoolId,
      status: "ACTIVE",
    });

    await enrollment.addPlayerToTeam(admin, {
      playerId: player.id,
      teamId: u14Id,
      isPrimary: true,
      ageException: false,
    });

    const enrolments = await prisma.schoolEnrollment.findMany({
      where: { playerId: player.id },
    });

    expect(enrolments).toHaveLength(1);
    expect(enrolments[0]!.status).toBe("ACTIVE");
    expect(enrolments[0]!.endedAt).toBeNull();

    await prisma.teamMembership.deleteMany({ where: { playerId: player.id } });
    await prisma.schoolEnrollment.deleteMany({
      where: { playerId: player.id },
    });
    await prisma.person.deleteMany({ where: { id: player.personId } });
  });

  it("ends only through an explicit status change", async () => {
    const player = await makePlayer(1392, "explicit");

    const enrolment = await enrollment.enrollPlayerInSchool(admin, {
      playerId: player.id,
      schoolId,
      status: "ACTIVE",
    });

    const updated = await enrollment.updateEnrollmentStatus(
      admin,
      enrolment.id,
      { status: "TRANSFERRED" },
    );

    expect(updated.status).toBe("TRANSFERRED");
    expect(updated.endedAt).not.toBeNull();

    await prisma.schoolEnrollment.deleteMany({
      where: { playerId: player.id },
    });
    await prisma.person.deleteMany({ where: { id: player.personId } });
  });

  it("refuses a duplicate enrolment for the same season", async () => {
    const player = await makePlayer(1392, "dup");

    await enrollment.enrollPlayerInSchool(admin, {
      playerId: player.id,
      schoolId,
      status: "ACTIVE",
    });

    await expect(
      enrollment.enrollPlayerInSchool(admin, {
        playerId: player.id,
        schoolId,
        status: "ACTIVE",
      }),
    ).rejects.toThrow();

    await prisma.schoolEnrollment.deleteMany({
      where: { playerId: player.id },
    });
    await prisma.person.deleteMany({ where: { id: player.personId } });
  });
});

describe("more than one squad per season", () => {
  /**
   * Allowed: a promising player trains up an age group. Exactly one membership
   * carries `isPrimary`, so attendance and reporting have one home team.
   */
  it("allows two squads but only one primary", async () => {
    const player = await makePlayer(1392, "two-squads");

    await enrollment.addPlayerToTeam(admin, {
      playerId: player.id,
      teamId: u14Id,
      isPrimary: true,
      ageException: false,
    });

    await enrollment.addPlayerToTeam(admin, {
      playerId: player.id,
      teamId: u16Id,
      isPrimary: true,
      ageException: true,
    });

    const memberships = await prisma.teamMembership.findMany({
      where: { playerId: player.id, seasonId },
    });

    expect(memberships).toHaveLength(2);
    expect(memberships.filter((m) => m.isPrimary)).toHaveLength(1);
    expect(memberships.find((m) => m.isPrimary)?.teamId).toBe(u16Id);

    await prisma.teamMembership.deleteMany({ where: { playerId: player.id } });
    await prisma.person.deleteMany({ where: { id: player.personId } });
  });
});

describe("permissions", () => {
  it("refuses a coach enrolling a player", async () => {
    await expect(
      enrollment.enrollPlayerInSchool(coach, {
        playerId: "any",
        schoolId,
        status: "ACTIVE",
      }),
    ).rejects.toThrow();
  });

  it("refuses a coach adding a player to a squad", async () => {
    await expect(
      enrollment.addPlayerToTeam(coach, {
        playerId: "any",
        teamId: u14Id,
        isPrimary: true,
        ageException: false,
      }),
    ).rejects.toThrow();
  });

  it("lets a coach read their own team's roster", async () => {
    await expect(
      enrollment.listTeamRoster(coach, u14Id),
    ).resolves.toBeDefined();
  });

  it("refuses a coach reading another team's roster", async () => {
    await expect(enrollment.listTeamRoster(coach, u16Id)).rejects.toThrow();
  });
});
