import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as enrollment from "@/lib/services/enrollment.service";
import { createPlayer } from "@/lib/services/people.service";
import { getPlayerJourney } from "@/lib/services/journey.service";

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
let parent: AuthorizedUser;
let schoolId: string;
let u14Id: string;
let u16Id: string;

const created: string[] = [];

beforeAll(async () => {
  [admin, parent] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000005"),
  ]);

  schoolId = (await prisma.school.findFirstOrThrow()).id;
  u14Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u14" } })
  ).id;
  u16Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u16" } })
  ).id;
});

/** A player born in a band-appropriate year, tracked for cleanup. */
async function newPlayer(lastName: string) {
  const player = await createPlayer(admin, {
    firstName: "مسیر",
    lastName,
    // 1392 sits inside U14 for season 1405 and outside U16.
    dateOfBirth: new Date(Date.UTC(2013, 7, 15, 9)),
  });
  created.push(player.id);
  return player;
}

async function cleanup() {
  if (created.length === 0) return;
  const persons = await prisma.player.findMany({
    where: { id: { in: created } },
    select: { personId: true },
  });
  await prisma.playerJourneyEvent.deleteMany({
    where: { playerId: { in: created } },
  });
  await prisma.teamMembership.deleteMany({
    where: { playerId: { in: created } },
  });
  await prisma.schoolEnrollment.deleteMany({
    where: { playerId: { in: created } },
  });
  await prisma.person.deleteMany({
    where: { id: { in: persons.map((p) => p.personId) } },
  });
  created.length = 0;
}

describe("events are written by the services that cause them", () => {
  it("records registration when a player is created", async () => {
    const player = await newPlayer("ثبت‌نام");

    const journey = await getPlayerJourney(admin, player.id);
    expect(journey).toHaveLength(1);
    expect(journey[0]!.type).toBe("REGISTERED");
    expect(journey[0]!.description).toContain(player.playerCode);

    await cleanup();
  });

  it("records joining a school", async () => {
    const player = await newPlayer("مدرسه");
    await enrollment.enrollPlayerInSchool(admin, {
      playerId: player.id,
      schoolId,
      status: "ACTIVE",
    });

    const journey = await getPlayerJourney(admin, player.id);
    expect(journey.map((e) => e.type)).toContain("SCHOOL_JOINED");

    await cleanup();
  });

  it("records joining a team", async () => {
    const player = await newPlayer("تیم");
    await enrollment.addPlayerToTeam(admin, {
      playerId: player.id,
      teamId: u14Id,
      isPrimary: true,
      ageException: false,
    });

    const journey = await getPlayerJourney(admin, player.id);
    expect(journey[0]!.type).toBe("TEAM_JOINED");
    expect(journey[0]!.teamId).toBe(u14Id);

    await cleanup();
  });

  it("records leaving a team", async () => {
    const player = await newPlayer("جدایی");
    const membership = await enrollment.addPlayerToTeam(admin, {
      playerId: player.id,
      teamId: u14Id,
      isPrimary: true,
      ageException: false,
    });

    await enrollment.endPlayerMembership(admin, membership.id, "RELEASED");

    const journey = await getPlayerJourney(admin, player.id);
    expect(journey[0]!.type).toBe("TEAM_LEFT");

    await cleanup();
  });

  /** Moving up an age band is a promotion, not merely another membership. */
  it("distinguishes a promotion from an ordinary join", async () => {
    const player = await newPlayer("ارتقا");

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

    const journey = await getPlayerJourney(admin, player.id);
    expect(journey[0]!.type).toBe("PROMOTED");
    expect(journey[0]!.title).toContain("ارتقا");

    // The earlier join is still there — the timeline records both.
    expect(journey.map((e) => e.type)).toContain("TEAM_JOINED");

    await cleanup();
  });

  it("records the end of a school enrolment", async () => {
    const player = await newPlayer("پایان");
    const enrolment = await enrollment.enrollPlayerInSchool(admin, {
      playerId: player.id,
      schoolId,
      status: "ACTIVE",
    });

    await enrollment.updateEnrollmentStatus(admin, enrolment.id, {
      status: "TRANSFERRED",
    });

    const journey = await getPlayerJourney(admin, player.id);
    expect(journey[0]!.type).toBe("TRANSFERRED");

    await cleanup();
  });
});

describe("the timeline is written with the fact, not after it", () => {
  /**
   * The point of the transaction: a rejected membership must leave no event
   * behind. Here the age band refuses the write, so nothing should be recorded.
   */
  it("records nothing when the write is refused", async () => {
    const player = await newPlayer("ردشده");
    const before = await getPlayerJourney(admin, player.id);

    await expect(
      enrollment.addPlayerToTeam(admin, {
        playerId: player.id,
        teamId: u16Id,
        isPrimary: true,
        ageException: false,
      }),
    ).rejects.toThrow();

    const after = await getPlayerJourney(admin, player.id);
    expect(after).toHaveLength(before.length);

    await cleanup();
  });

  it("keeps every event for a player in order, newest first", async () => {
    const player = await newPlayer("ترتیب");
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

    const journey = await getPlayerJourney(admin, player.id);
    expect(journey.map((e) => e.type)).toEqual([
      "TEAM_JOINED",
      "SCHOOL_JOINED",
      "REGISTERED",
    ]);

    for (let index = 1; index < journey.length; index++) {
      expect(journey[index - 1]!.occurredAt.getTime()).toBeGreaterThanOrEqual(
        journey[index]!.occurredAt.getTime(),
      );
    }

    await cleanup();
  });

  it("names who caused the event", async () => {
    const player = await newPlayer("عامل");
    const journey = await getPlayerJourney(admin, player.id);
    expect(journey[0]!.actorId).toBe(admin.id);

    await cleanup();
  });
});

describe("registering several players at once", () => {
  /**
   * Player codes are allocated by reading the highest and adding one, which
   * concurrent registrations both read. Two staff registering during a trial
   * session is the ordinary case, so this must not collide.
   */
  it("gives every concurrent registration its own code", async () => {
    const players = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createPlayer(admin, {
          firstName: "هم‌زمان",
          lastName: `ثبت${index}`,
          dateOfBirth: new Date(Date.UTC(2013, 7, 15, 9)),
        }),
      ),
    );

    for (const player of players) created.push(player.id);

    const codes = players.map((player) => player.playerCode);
    expect(new Set(codes).size).toBe(players.length);

    // And each one has its own opening timeline entry.
    for (const player of players) {
      const journey = await getPlayerJourney(admin, player.id);
      expect(journey).toHaveLength(1);
      expect(journey[0]!.type).toBe("REGISTERED");
    }

    await cleanup();
  });
});

describe("scope applies to the timeline", () => {
  it("refuses a guardian another family's timeline", async () => {
    const player = await newPlayer("بیگانه");

    await expect(getPlayerJourney(parent, player.id)).rejects.toThrow();

    await cleanup();
  });

  it("lets a guardian read their own child's timeline", async () => {
    const link = await prisma.playerGuardian.findFirstOrThrow({
      where: { guardian: { person: { userId: parent.id } } },
    });

    await expect(
      getPlayerJourney(parent, link.playerId),
    ).resolves.toBeDefined();
  });
});
