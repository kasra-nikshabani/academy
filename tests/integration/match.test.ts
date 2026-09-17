import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as matches from "@/lib/services/match.service";

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

let u14Id: string;
let u16Id: string;
let squadPlayerId: string;
let outsidePlayerId: string;
let ownChildId: string;

const createdMatches: string[] = [];

/** A past slot inside the active season, away from the seeded fixtures. */
let slot = 0;
function pastSlot(): Date {
  slot += 1;
  return new Date(Date.UTC(2026, 8, 1, 6, 0) + slot * 24 * 60 * 60 * 1000);
}

async function played(teamId: string, kickoffAt = pastSlot()) {
  const match = await matches.createMatch(admin, {
    teamId,
    opponent: `حریف ${slot}`,
    homeAway: "HOME",
    kickoffAt,
    durationMinutes: 80,
    status: "SCHEDULED",
  });
  createdMatches.push(match.id);
  return match;
}

beforeAll(async () => {
  [admin, coach, parent] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000003"),
    authorizedUser("09120000005"),
  ]);

  u14Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u14" } })
  ).id;
  u16Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u16" } })
  ).id;

  const season = await prisma.season.findFirstOrThrow({
    where: { status: "ACTIVE" },
  });

  squadPlayerId = (
    await prisma.teamMembership.findFirstOrThrow({
      where: { teamId: u14Id, seasonId: season.id, status: "ACTIVE" },
    })
  ).playerId;

  // In the U16 squad, so demonstrably a real player — and demonstrably not
  // one of this team's.
  outsidePlayerId = (
    await prisma.teamMembership.findFirstOrThrow({
      where: { teamId: u16Id, seasonId: season.id, status: "ACTIVE" },
    })
  ).playerId;

  ownChildId = (
    await prisma.playerGuardian.findFirstOrThrow({
      where: { guardian: { person: { userId: parent.id } } },
    })
  ).playerId;
});

afterAll(async () => {
  if (createdMatches.length > 0) {
    await prisma.match.deleteMany({ where: { id: { in: createdMatches } } });
  }
});

describe("scheduling a fixture", () => {
  it("resolves the season from the kick-off date", async () => {
    const match = await played(u14Id);
    expect(match.season.name).toBe("۱۴۰۴-۱۴۰۵");
  });

  it("refuses a coach another team's fixture", async () => {
    await expect(played(u16Id === u14Id ? u14Id : u16Id)).resolves.toBeDefined();

    await expect(
      matches.createMatch(coach, {
        teamId: u16Id,
        opponent: "حریف",
        homeAway: "HOME",
        kickoffAt: pastSlot(),
        durationMinutes: 80,
        status: "SCHEDULED",
      }),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  /** A team cannot play two matches at once. */
  it("refuses an overlapping fixture for the same team", async () => {
    const kickoffAt = pastSlot();
    await played(u14Id, kickoffAt);

    await expect(
      matches.createMatch(admin, {
        teamId: u14Id,
        opponent: "هم‌زمان",
        homeAway: "HOME",
        kickoffAt: new Date(kickoffAt.getTime() + 30 * 60 * 1000),
        durationMinutes: 80,
        status: "SCHEDULED",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows two teams to play at the same time", async () => {
    const kickoffAt = pastSlot();
    await played(u14Id, kickoffAt);
    await expect(played(u16Id, kickoffAt)).resolves.toBeDefined();
  });

  it("refuses a date outside every season", async () => {
    await expect(
      matches.createMatch(admin, {
        teamId: u14Id,
        opponent: "خارج از فصل",
        homeAway: "HOME",
        kickoffAt: new Date(Date.UTC(2035, 0, 10, 12, 0)),
        durationMinutes: 80,
        status: "SCHEDULED",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("only the squad plays", () => {
  /**
   * The rule this phase turns on. Without it a coach could file match
   * statistics against any player in the academy, and the row would look
   * exactly as legitimate as a real one.
   */
  it("refuses a team sheet naming a player from another squad", async () => {
    const match = await played(u14Id);

    await expect(
      matches.saveLineup(admin, match.id, {
        entries: [{ playerId: outsidePlayerId, role: "STARTER" }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("accepts a player who is in the squad", async () => {
    const match = await played(u14Id);

    const saved = await matches.saveLineup(admin, match.id, {
      entries: [
        { playerId: squadPlayerId, role: "STARTER", shirtNumber: 10 },
      ],
    });

    expect(saved.lineup).toHaveLength(1);
    expect(saved.lineup[0]!.shirtNumber).toBe(10);
  });

  /** Sending the sheet again replaces it — that is what redrawing means. */
  it("replaces the whole sheet, removing anyone left out", async () => {
    const match = await played(u14Id);

    await matches.saveLineup(admin, match.id, {
      entries: [{ playerId: squadPlayerId, role: "STARTER" }],
    });

    const emptied = await matches.saveLineup(admin, match.id, {
      entries: [],
    });
    expect(emptied.lineup).toHaveLength(0);
  });

  it("is idempotent — the same sheet twice is the same sheet", async () => {
    const match = await played(u14Id);
    const body = {
      entries: [{ playerId: squadPlayerId, role: "SUBSTITUTE" as const }],
    };

    await matches.saveLineup(admin, match.id, body);
    const second = await matches.saveLineup(admin, match.id, body);

    expect(second.lineup).toHaveLength(1);
    expect(second.lineup[0]!.role).toBe("SUBSTITUTE");
  });
});

describe("statistics", () => {
  it("refuses a player who is not on the team sheet", async () => {
    const match = await played(u14Id);

    await expect(
      matches.saveMatchStats(admin, match.id, {
        entries: [{ playerId: squadPlayerId, minutesPlayed: 80, goals: 1, assists: 0, yellowCards: 0, redCards: 0 }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("records what a named player did", async () => {
    const match = await played(u14Id);
    await matches.saveLineup(admin, match.id, {
      entries: [{ playerId: squadPlayerId, role: "STARTER" }],
    });

    const saved = await matches.saveMatchStats(admin, match.id, {
      entries: [
        {
          playerId: squadPlayerId,
          minutesPlayed: 80,
          goals: 2,
          assists: 1,
          yellowCards: 1,
          redCards: 0,
        },
      ],
    });

    expect(saved.stats).toHaveLength(1);
    expect(saved.stats[0]!.goals).toBe(2);
  });

  it("refuses statistics for a match that has not kicked off", async () => {
    const future = await matches.createMatch(admin, {
      teamId: u14Id,
      opponent: "آینده",
      homeAway: "HOME",
      kickoffAt: new Date(Date.UTC(2027, 3, 10, 12, 0)),
      durationMinutes: 80,
      status: "SCHEDULED",
    });
    createdMatches.push(future.id);

    await matches.saveLineup(admin, future.id, {
      entries: [{ playerId: squadPlayerId, role: "STARTER" }],
    });

    await expect(
      matches.saveMatchStats(admin, future.id, {
        entries: [{ playerId: squadPlayerId, minutesPlayed: 80, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses a result on a fixture that has not been played", async () => {
    const future = await matches.createMatch(admin, {
      teamId: u16Id,
      opponent: "آینده",
      homeAway: "HOME",
      kickoffAt: new Date(Date.UTC(2027, 3, 11, 12, 0)),
      durationMinutes: 80,
      status: "SCHEDULED",
    });
    createdMatches.push(future.id);

    await expect(
      matches.updateMatch(admin, future.id, { goalsFor: 3, goalsAgainst: 0 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses to complete a match with no score", async () => {
    const match = await played(u14Id);

    await expect(
      matches.updateMatch(admin, match.id, { status: "COMPLETED" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("a fixture is called off, never deleted", () => {
  it("keeps the row and the reason", async () => {
    const match = await played(u14Id);
    const off = await matches.cancelMatch(
      admin,
      match.id,
      "POSTPONED",
      "بارندگی",
    );

    expect(off.status).toBe("POSTPONED");
    expect(off.cancelReason).toBe("بارندگی");
  });

  it("frees the slot for a replacement", async () => {
    const kickoffAt = pastSlot();
    const first = await played(u14Id, kickoffAt);
    await matches.cancelMatch(admin, first.id, "CANCELLED");

    await expect(played(u14Id, kickoffAt)).resolves.toBeDefined();
  });

  it("refuses to cancel a match that was played", async () => {
    const match = await played(u14Id);
    await matches.saveLineup(admin, match.id, {
      entries: [{ playerId: squadPlayerId, role: "STARTER" }],
    });
    await matches.updateMatch(admin, match.id, {
      status: "COMPLETED",
      goalsFor: 1,
      goalsAgainst: 0,
    });

    await expect(
      matches.cancelMatch(admin, match.id, "CANCELLED"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("who sees what", () => {
  it("lets a parent see their child's fixture", async () => {
    const membership = await prisma.teamMembership.findFirstOrThrow({
      where: { playerId: ownChildId, status: "ACTIVE" },
    });
    const match = await played(membership.teamId);

    await expect(matches.getMatch(parent, match.id)).resolves.toMatchObject({
      id: match.id,
    });
  });

  it("refuses a parent another team's fixture", async () => {
    const match = await played(u16Id);

    await expect(matches.getMatch(parent, match.id)).rejects.toMatchObject({
      code: "OUT_OF_SCOPE",
    });
  });

  it("refuses a parent the write, however much they can see", async () => {
    const membership = await prisma.teamMembership.findFirstOrThrow({
      where: { playerId: ownChildId, status: "ACTIVE" },
    });
    const match = await played(membership.teamId);

    await expect(
      matches.saveLineup(parent, match.id, { entries: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("gives a parent their own child's record and refuses another's", async () => {
    await expect(
      matches.getPlayerMatchRecord(parent, ownChildId),
    ).resolves.toBeDefined();

    await expect(
      matches.getPlayerMatchRecord(parent, outsidePlayerId),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("narrows a coach's list to their own team, count included", async () => {
    await played(u16Id);

    const { items, meta } = await matches.listMatches(
      coach,
      { page: 1, pageSize: 100 },
      {},
    );

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.teamId).toBe(u14Id);
    expect(meta.total).toBe(items.length);
  });
});

describe("a team's record", () => {
  it("counts only played matches with a score", async () => {
    const record = await matches.getTeamRecord(admin, u14Id);
    const completed = await prisma.match.count({
      where: {
        teamId: u14Id,
        status: "COMPLETED",
        goalsFor: { not: null },
        goalsAgainst: { not: null },
      },
    });

    expect(record.played).toBe(completed);
    expect(record.won + record.drawn + record.lost).toBe(record.played);
  });
});
