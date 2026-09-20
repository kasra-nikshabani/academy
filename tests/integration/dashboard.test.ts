import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as dashboard from "@/lib/services/dashboard.service";

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
let parent: AuthorizedUser;
let player: AuthorizedUser;

beforeAll(async () => {
  [admin, manager, coach, parent, player] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000002"),
    authorizedUser("09120000003"),
    authorizedUser("09120000005"),
    authorizedUser("09120000004"),
  ]);
});

describe("which sections a caller gets", () => {
  it("gives the academy view to an administrator and a manager", () => {
    expect(dashboard.canSeeAcademy(admin)).toBe(true);
    expect(dashboard.canSeeAcademy(manager)).toBe(true);
  });

  /**
   * An aggregate is still a disclosure. A coach may read their own squads'
   * registers; a total across the club is a different question.
   */
  it("refuses the academy view to a coach, a parent and a player", () => {
    expect(dashboard.canSeeAcademy(coach)).toBe(false);
    expect(dashboard.canSeeAcademy(parent)).toBe(false);
    expect(dashboard.canSeeAcademy(player)).toBe(false);
  });

  it("gives the squad section to a coach and not to a parent", async () => {
    expect(await dashboard.hasSquads(coach)).toBe(true);
    expect(await dashboard.hasSquads(parent)).toBe(false);
  });

  /** An administrator has every team, which is not the same as having squads. */
  it("does not give an administrator the coach's section", async () => {
    expect(await dashboard.hasSquads(admin)).toBe(false);
    expect(await dashboard.hasOwnPlayers(admin)).toBe(false);
  });

  it("gives the family section to a parent and a player", async () => {
    expect(await dashboard.hasOwnPlayers(parent)).toBe(true);
    expect(await dashboard.hasOwnPlayers(player)).toBe(true);
  });

  /**
   * The reason this is one page and not five. The seeded coach is also a
   * parent, and both sections are true of them at once.
   */
  it("gives the coach-who-is-also-a-parent both sections", async () => {
    const both = await authorizedUser("09120000006");

    expect(both.roles).toContain("STAFF");
    expect(both.roles).toContain("PARENT");
    expect(await dashboard.hasSquads(both)).toBe(true);
    expect(await dashboard.hasOwnPlayers(both)).toBe(true);
  });
});

describe("the system view", () => {
  /**
   * `PRODUCT_SPEC.md` §9 asks an administrator for a system view beside the
   * academy one. It is held by `user:read`, which is an administrator's alone
   * — running the academy and administering accounts are different jobs.
   */
  it("belongs to an administrator and not to the academy manager", () => {
    expect(dashboard.canSeeSystem(admin)).toBe(true);
    expect(dashboard.canSeeSystem(manager)).toBe(false);
    expect(dashboard.canSeeSystem(coach)).toBe(false);
    expect(dashboard.canSeeSystem(parent)).toBe(false);
  });

  it("is refused to everyone else in the service too", async () => {
    await expect(dashboard.getSystemOverview(manager)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(dashboard.getSystemOverview(coach)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("counts accounts, never a negative", async () => {
    const system = await dashboard.getSystemOverview(admin);
    const users = await prisma.user.count();

    expect(system.users).toBe(users);
    for (const [key, value] of Object.entries(system)) {
      expect(Number.isFinite(value), key).toBe(true);
      expect(value, key).toBeGreaterThanOrEqual(0);
    }
  });

  it("never reports more active or blocked accounts than there are", async () => {
    const system = await dashboard.getSystemOverview(admin);

    expect(system.activeUsers).toBeLessThanOrEqual(system.users);
    expect(system.blockedUsers).toBeLessThanOrEqual(system.users);
    expect(system.recentLogins).toBeLessThanOrEqual(system.users);
  });
});

describe("the academy overview", () => {
  it("is refused to a caller without the reporting permission", async () => {
    await expect(dashboard.getAcademyOverview(coach)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(dashboard.getAcademyOverview(parent)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  /**
   * Checked in the service, not only by the page: an aggregate that moves when
   * one squad changes says something about that squad.
   */
  it("is refused to a scoped caller even if they hold report:read", async () => {
    const scopedReporter: AuthorizedUser = {
      ...coach,
      permissions: [...coach.permissions, "report:read"],
    };

    await expect(
      dashboard.getAcademyOverview(scopedReporter),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("counts the academy and never returns a negative or NaN", async () => {
    const overview = await dashboard.getAcademyOverview(admin);

    for (const [key, value] of Object.entries(overview.counts)) {
      expect(Number.isFinite(value), key).toBe(true);
      expect(value, key).toBeGreaterThanOrEqual(0);
    }
  });

  it("builds a growth series that never goes backwards", async () => {
    const overview = await dashboard.getAcademyOverview(admin);

    expect(overview.growth.length).toBeGreaterThan(0);
    for (let index = 1; index < overview.growth.length; index += 1) {
      // Players are not deleted (CLAUDE.md §2), so the cumulative line only
      // ever rises.
      expect(overview.growth[index]!.total).toBeGreaterThanOrEqual(
        overview.growth[index - 1]!.total,
      );
    }
  });

  it("ends the growth series at the number of players there are", async () => {
    const overview = await dashboard.getAcademyOverview(admin);
    const players = await prisma.player.count();

    expect(overview.growth.at(-1)!.total).toBe(players);
  });

  it("shares of the sport distribution add to about a hundred", async () => {
    const overview = await dashboard.getAcademyOverview(admin);
    if (overview.sports.length === 0) return;

    const sum = overview.sports.reduce(
      (total, slice) => total + slice.share,
      0,
    );
    expect(Math.abs(sum - 100)).toBeLessThan(0.5);
  });

  it("reports a rate between nothing and a hundred", async () => {
    const overview = await dashboard.getAcademyOverview(admin);

    for (const point of overview.attendance.trend) {
      if (point.rate === null) continue;
      expect(point.rate).toBeGreaterThanOrEqual(0);
      expect(point.rate).toBeLessThanOrEqual(100);
    }
  });

  it("raises only alerts with something behind them", async () => {
    const overview = await dashboard.getAcademyOverview(admin);

    for (const alert of overview.alerts) {
      expect(alert.count).toBeGreaterThan(0);
    }
  });
});

describe("the squad summary", () => {
  it("shows a coach their own teams' schedule", async () => {
    const summary = await dashboard.getSquadSummary(coach);
    const scopedTeams = await prisma.staffTeam.findMany({
      where: { staff: { person: { userId: coach.id } } },
      select: { teamId: true },
    });
    const allowed = new Set(scopedTeams.map((row) => row.teamId));

    for (const session of summary.sessions) {
      expect(allowed.has(session.team.id)).toBe(true);
    }
    for (const match of summary.matches) {
      expect(allowed.has(match.team.id)).toBe(true);
    }
  });

  /** A parent holds no `StaffTeam` row, so there is nothing to summarise. */
  it("is empty for a parent", async () => {
    const summary = await dashboard.getSquadSummary(parent);

    expect(summary.teams).toEqual([]);
    expect(summary.sessions).toEqual([]);
    expect(summary.attendance.overall).toBeNull();
  });
});

describe("the family summary", () => {
  it("returns only the caller's own children", async () => {
    const summary = await dashboard.getFamilySummary(parent);
    const mine = await prisma.playerGuardian.findMany({
      where: { guardian: { person: { userId: parent.id } } },
      select: { playerId: true },
    });
    const allowed = new Set(mine.map((row) => row.playerId));

    expect(summary.players.length).toBeGreaterThan(0);
    for (const item of summary.players) {
      expect(allowed.has(item.id)).toBe(true);
    }
  });

  it("returns measurements only for those children", async () => {
    const summary = await dashboard.getFamilySummary(parent);
    const allowed = new Set(summary.players.map((item) => item.id));

    for (const record of summary.latestMeasurements) {
      expect(allowed.has(record.playerId)).toBe(true);
    }
  });

  /**
   * An unscoped caller has *everyone*, which is not the same as having their
   * own people — and a manager does not want the whole academy listed as their
   * children.
   */
  it("is empty for an administrator", async () => {
    const summary = await dashboard.getFamilySummary(admin);
    expect(summary.players).toEqual([]);
  });

  /**
   * The bug the rendered page showed.
   *
   * A coach's `scope.playerIds` is their whole squad — that is what makes the
   * register readable — so building this section from it listed a squad member
   * under «پرونده من» as though the coach were their parent. Own players means
   * the caller's own record and their children.
   */
  it("does not treat a coach's squad as their own children", async () => {
    const summary = await dashboard.getFamilySummary(coach);
    const squadPlayerIds = new Set(
      (
        await prisma.teamMembership.findMany({
          where: {
            team: {
              staff: { some: { staff: { person: { userId: coach.id } } } },
            },
            status: "ACTIVE",
          },
          select: { playerId: true },
        })
      ).map((row) => row.playerId),
    );

    expect(squadPlayerIds.size).toBeGreaterThan(0);
    for (const item of summary.players) {
      expect(squadPlayerIds.has(item.id)).toBe(false);
    }
  });

  /** A player sees their own record; a parent sees their children's. */
  it("says whose record it is", async () => {
    expect((await dashboard.getFamilySummary(player)).ownRecord).toBe(true);
    expect((await dashboard.getFamilySummary(parent)).ownRecord).toBe(false);
  });

  /** The dual-role account: a squad they coach, and a child they do not. */
  it("keeps a coach-parent's child separate from their squad", async () => {
    const both = await authorizedUser("09120000006");

    const family = await dashboard.getFamilySummary(both);
    const squad = await dashboard.getSquadSummary(both);

    expect(family.players).toHaveLength(1);
    expect(family.ownRecord).toBe(false);
    expect(squad.attendance.trend.length).toBeGreaterThan(0);
  });
});
