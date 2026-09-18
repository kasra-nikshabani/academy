import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as performance from "@/lib/services/performance.service";
import { savePerformanceSchema } from "@/lib/validation/performance";

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

/**
 * A player the seed has **not** measured.
 *
 * The seeded U14 pair carry four testing days anchored to today, so any day
 * this suite invents is older than they are and "the latest reading" is
 * rightly still the seed's. Value assertions therefore run against a player
 * with an empty series; the seeded pair are what the scope tests use.
 */
let unmeasuredPlayerId: string;

/**
 * What that player's own record said before this suite touched it.
 *
 * Recording a height writes it onto the player too, by design. Restoring it
 * afterwards is not tidiness: without it the seeded `heightCm` moves from null
 * to 173 on the first run and stays there, and every later assertion about a
 * fresh database is measured against a fixture this suite quietly edited.
 */
let originalFigure: { heightCm: number | null; weightKg: number | null };

/**
 * Every player this suite writes to, so the rows it creates can be removed
 * again. The seeded players carry seeded measurements, and a suite that left
 * its own behind would move the baseline every run — the lesson from the
 * journey events in Phase 11 (docs/PROJECT_RULES.md §6.1).
 */
const touchedPlayerIds = new Set<string>();

/** A distinct past day per call, clear of the four seeded testing days. */
let dayOffset = 0;
function testingDay(): Date {
  dayOffset += 1;
  return new Date(Date.UTC(2026, 2, dayOffset, 9, 30));
}

async function record(
  caller: AuthorizedUser,
  playerId: string,
  entries: { metric: string; value: number }[],
  measuredAt: Date = testingDay(),
) {
  touchedPlayerIds.add(playerId);
  return performance.savePlayerMeasurements(
    caller,
    playerId,
    savePerformanceSchema.parse({ measuredAt, entries }),
  );
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
      orderBy: { createdAt: "asc" },
    })
  ).playerId;

  // A real player, demonstrably not in the coach's squad.
  outsidePlayerId = (
    await prisma.teamMembership.findFirstOrThrow({
      where: { teamId: u16Id, seasonId: season.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    })
  ).playerId;

  ownChildId = (
    await prisma.playerGuardian.findFirstOrThrow({
      where: { guardian: { person: { userId: parent.id } } },
    })
  ).playerId;

  unmeasuredPlayerId = outsidePlayerId;

  originalFigure = await prisma.player.findUniqueOrThrow({
    where: { id: unmeasuredPlayerId },
    select: { heightCm: true, weightKg: true },
  });
});

afterAll(async () => {
  if (touchedPlayerIds.size > 0) {
    await prisma.performanceRecord.deleteMany({
      where: {
        playerId: { in: [...touchedPlayerIds] },
        measuredAt: { lt: new Date(Date.UTC(2026, 3, 1)) },
      },
    });
  }

  await prisma.player.update({
    where: { id: unmeasuredPlayerId },
    data: originalFigure,
  });
});

describe("recording a measurement", () => {
  it("stores the reading and builds a trend from it", async () => {
    const result = await record(admin, unmeasuredPlayerId, [
      { metric: "VERTICAL_JUMP_CM", value: 42.5 },
    ]);

    const trend = result.trends.find(
      (item) => item.metric === "VERTICAL_JUMP_CM",
    );
    expect(trend?.latest.value).toBe(42.5);
  });

  it("rounds to the metric's own precision on the way in", async () => {
    await record(admin, unmeasuredPlayerId, [
      { metric: "COOPER_TEST_M", value: 2412.7 },
    ]);

    const row = await prisma.performanceRecord.findFirstOrThrow({
      where: { playerId: unmeasuredPlayerId, metric: "COOPER_TEST_M" },
      orderBy: { measuredAt: "desc" },
    });
    expect(row.value).toBe(2413);
  });

  /**
   * The unique key's purpose: a coach who mistyped the sprint re-submits the
   * sheet and the day carries one value, not two that disagree.
   */
  it("corrects a reading rather than doubling it", async () => {
    const day = testingDay();

    await record(
      admin,
      unmeasuredPlayerId,
      [{ metric: "SPRINT_20M_S", value: 3.6 }],
      day,
    );
    await record(
      admin,
      unmeasuredPlayerId,
      [{ metric: "SPRINT_20M_S", value: 3.21 }],
      day,
    );

    const rows = await prisma.performanceRecord.findMany({
      where: {
        playerId: unmeasuredPlayerId,
        metric: "SPRINT_20M_S",
        measuredAt: {
          gte: new Date(Date.UTC(2026, 2, 1)),
          lt: new Date(Date.UTC(2026, 3, 1)),
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(3.21);
  });

  /** A test entered at 4pm and one entered at 9am are the same testing day. */
  it("files a reading against the day, not the hour it was typed", async () => {
    const morning = new Date(Date.UTC(2026, 2, 20, 5, 0));
    const evening = new Date(Date.UTC(2026, 2, 20, 16, 30));

    await record(
      admin,
      unmeasuredPlayerId,
      [{ metric: "AGILITY_505_S", value: 2.8 }],
      morning,
    );
    await record(
      admin,
      unmeasuredPlayerId,
      [{ metric: "AGILITY_505_S", value: 2.71 }],
      evening,
    );

    const rows = await prisma.performanceRecord.findMany({
      where: {
        playerId: unmeasuredPlayerId,
        metric: "AGILITY_505_S",
        measuredAt: {
          gte: new Date(Date.UTC(2026, 2, 19)),
          lt: new Date(Date.UTC(2026, 2, 22)),
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(2.71);
  });

  it("writes a whole testing sheet as one act", async () => {
    const result = await record(admin, unmeasuredPlayerId, [
      { metric: "HEIGHT_CM", value: 171 },
      { metric: "WEIGHT_KG", value: 58 },
      { metric: "SPRINT_20M_S", value: 3.19 },
    ]);

    const metrics = result.trends.map((trend) => trend.metric);
    expect(metrics).toContain("HEIGHT_CM");
    expect(metrics).toContain("WEIGHT_KG");
    expect(metrics).toContain("SPRINT_20M_S");
  });

  it("refuses a measurement dated in the future", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await expect(
      record(
        admin,
        unmeasuredPlayerId,
        [{ metric: "HEIGHT_CM", value: 170 }],
        tomorrow,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("the range check", () => {
  /**
   * Checked before the service is reached, and checked per metric — one
   * numeric bound cannot refuse both of these.
   */
  it("refuses an impossible sprint and an impossible Cooper test", () => {
    expect(() =>
      savePerformanceSchema.parse({
        entries: [{ metric: "SPRINT_20M_S", value: 45 }],
      }),
    ).toThrow();

    expect(() =>
      savePerformanceSchema.parse({
        entries: [{ metric: "COOPER_TEST_M", value: 4 }],
      }),
    ).toThrow();
  });

  it("accepts each of those values for the metric it belongs to", () => {
    expect(() =>
      savePerformanceSchema.parse({
        entries: [
          { metric: "COOPER_TEST_M", value: 2450 },
          { metric: "SPRINT_20M_S", value: 3.2 },
        ],
      }),
    ).not.toThrow();
  });

  it("refuses the same metric twice in one sheet", () => {
    expect(() =>
      savePerformanceSchema.parse({
        entries: [
          { metric: "HEIGHT_CM", value: 170 },
          { metric: "HEIGHT_CM", value: 171 },
        ],
      }),
    ).toThrow();
  });

  it("refuses an empty sheet", () => {
    expect(() => savePerformanceSchema.parse({ entries: [] })).toThrow();
  });
});

describe("the figure on the player record", () => {
  /**
   * The player card and the chart sit on the same page. One saying 162cm while
   * the other draws 171cm gives a reader nothing to choose between them.
   */
  it("follows the newest height and weight", async () => {
    await record(
      admin,
      unmeasuredPlayerId,
      [
        { metric: "HEIGHT_CM", value: 173.4 },
        { metric: "WEIGHT_KG", value: 59.2 },
      ],
      new Date(Date.UTC(2026, 2, 25, 9, 0)),
    );

    const player = await prisma.player.findUniqueOrThrow({
      where: { id: unmeasuredPlayerId },
      select: { heightCm: true, weightKg: true },
    });

    expect(player.heightCm).toBe(173);
    expect(player.weightKg).toBe(59);
  });

  /** Back-filling last term's testing day must not rewrite today's height. */
  it("is not rewritten by an older reading entered later", async () => {
    const before = await prisma.player.findUniqueOrThrow({
      where: { id: unmeasuredPlayerId },
      select: { heightCm: true },
    });

    await record(
      admin,
      unmeasuredPlayerId,
      [{ metric: "HEIGHT_CM", value: 150 }],
      new Date(Date.UTC(2026, 0, 5, 9, 0)),
    );

    const after = await prisma.player.findUniqueOrThrow({
      where: { id: unmeasuredPlayerId },
      select: { heightCm: true },
    });

    expect(after.heightCm).toBe(before.heightCm);
    expect(after.heightCm).not.toBe(150);
  });

  it("leaves the record alone for a metric that is not on it", async () => {
    const before = await prisma.player.findUniqueOrThrow({
      where: { id: unmeasuredPlayerId },
      select: { heightCm: true, weightKg: true },
    });

    await record(admin, unmeasuredPlayerId, [
      { metric: "COOPER_TEST_M", value: 2500 },
    ]);

    const after = await prisma.player.findUniqueOrThrow({
      where: { id: unmeasuredPlayerId },
      select: { heightCm: true, weightKg: true },
    });

    expect(after).toEqual(before);
  });
});

describe("who may read and write", () => {
  it("lets a coach record for a player in their own squad", async () => {
    const result = await record(coach, squadPlayerId, [
      { metric: "VERTICAL_JUMP_CM", value: 40 },
    ]);
    expect(result.trends.length).toBeGreaterThan(0);
  });

  it("refuses a coach a player outside their squads", async () => {
    await expect(
      record(coach, outsidePlayerId, [
        { metric: "VERTICAL_JUMP_CM", value: 40 },
      ]),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("refuses a coach even reading a player outside their squads", async () => {
    await expect(
      performance.getPlayerPerformance(coach, outsidePlayerId),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  /**
   * Permission and scope are two checks with two answers. A parent reaches
   * their own child — so this is not a scope refusal — and is still refused,
   * because they do not hold `performance:write`.
   */
  it("refuses a parent writing to their own child", async () => {
    await expect(
      record(parent, ownChildId, [{ metric: "HEIGHT_CM", value: 150 }]),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a parent read their own child", async () => {
    const result = await performance.getPlayerPerformance(parent, ownChildId);
    expect(result.playerId).toBe(ownChildId);
  });

  it("refuses a parent another family's child", async () => {
    await expect(
      performance.getPlayerPerformance(parent, outsidePlayerId),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("answers the form-gating question with permission and scope together", async () => {
    expect(await performance.canRecordForPlayer(coach, squadPlayerId)).toBe(
      true,
    );
    // Holds the permission, not the scope.
    expect(await performance.canRecordForPlayer(coach, outsidePlayerId)).toBe(
      false,
    );
    // Holds the scope, not the permission.
    expect(await performance.canRecordForPlayer(parent, ownChildId)).toBe(
      false,
    );
  });
});

describe("the squad view", () => {
  it("returns a row for every player, measured or not", async () => {
    const rows = await performance.getSquadPerformance(coach, u14Id);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.playerCode).toMatch(/^SEP-/);
    }
  });

  it("carries the newest reading of each metric, not the oldest", async () => {
    const rows = await performance.getSquadPerformance(admin, u14Id);
    const row = rows.find((item) => item.playerId === squadPlayerId);

    const newest = await prisma.performanceRecord.findFirstOrThrow({
      where: { playerId: squadPlayerId, metric: "HEIGHT_CM" },
      orderBy: { measuredAt: "desc" },
    });

    expect(row?.latest.HEIGHT_CM?.value).toBe(newest.value);
  });

  it("refuses a coach another team's squad", async () => {
    await expect(
      performance.getSquadPerformance(coach, u16Id),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  /** A roster is not a parent's to read (docs/PRODUCT_SPEC.md §8). */
  it("refuses a parent any squad at all", async () => {
    await expect(
      performance.getSquadPerformance(parent, u14Id),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });
});

describe("where the section opens", () => {
  it("gives a coach their teams", async () => {
    const landing = await performance.getPerformanceLanding(coach);
    expect(landing.teams.map((team) => team.id)).toContain(u14Id);
  });

  /**
   * A parent has no squad by design, and an empty table would read as a
   * permission failure. They get a way into their own child's record instead.
   */
  it("gives a parent their children and no teams", async () => {
    const landing = await performance.getPerformanceLanding(parent);
    expect(landing.teams).toHaveLength(0);
    expect(landing.ownPlayers.map((player) => player.id)).toContain(ownChildId);
  });
});
