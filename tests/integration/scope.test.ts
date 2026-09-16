import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import { resolveScope } from "@/lib/permissions";
import type { AuthorizedUser } from "@/lib/permissions";
import {
  getPlayer,
  getStaff,
  listPlayers,
  listStaff,
} from "@/lib/services/people.service";

/**
 * Scope enforcement.
 *
 * Phase 3 built permissions and deliberately stopped short of these checks
 * because `StaffTeam` and `PlayerGuardian` did not exist. This is the phase
 * that closes that gap, so these are the tests it is really about.
 */

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

/** The player the seeded guardian is linked to, and one they are not. */
let ownChildId: string;
let otherChildId: string;

beforeAll(async () => {
  [admin, manager, coach, parent, player] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000002"),
    authorizedUser("09120000003"),
    authorizedUser("09120000005"),
    authorizedUser("09120000004"),
  ]);

  const links = await prisma.playerGuardian.findMany({
    include: { guardian: { include: { person: true } } },
  });
  const link = links.find((row) => row.guardian.person.userId === parent.id);
  expect(link, "the seed must link the parent to a child").toBeDefined();
  ownChildId = link!.playerId;

  const other = await prisma.player.findFirst({
    where: { id: { not: ownChildId } },
    select: { id: true },
  });
  otherChildId = other!.id;
});

describe("resolving a caller's scope", () => {
  it("leaves an administrator unrestricted", async () => {
    const scope = await resolveScope(admin);
    expect(scope.teamIds).toBeNull();
    expect(scope.playerIds).toBeNull();
  });

  it("leaves the academy manager unrestricted", async () => {
    const scope = await resolveScope(manager);
    expect(scope.teamIds).toBeNull();
  });

  it("narrows a coach to the teams they are assigned", async () => {
    const scope = await resolveScope(coach);

    expect(scope.teamIds).not.toBeNull();
    expect(scope.teamIds).toHaveLength(1);

    const team = await prisma.team.findUniqueOrThrow({
      where: { id: scope.teamIds![0]! },
      include: { ageGroup: true },
    });
    expect(team.ageGroup.code).toBe("U14");
  });

  it("narrows a guardian to their own children", async () => {
    const scope = await resolveScope(parent);

    expect(scope.playerIds).toContain(ownChildId);
    expect(scope.playerIds).not.toContain(otherChildId);
  });

  it("narrows a player to themselves", async () => {
    const scope = await resolveScope(player);
    expect(scope.playerIds).toHaveLength(1);
  });

  /** Ending an assignment must remove the access, not just the display. */
  it("drops a team once the assignment is ended", async () => {
    const before = await resolveScope(coach);
    const teamId = before.teamIds![0]!;

    const assignment = await prisma.staffTeam.findFirstOrThrow({
      where: { teamId, staff: { person: { userId: coach.id } } },
    });

    await prisma.staffTeam.update({
      where: { id: assignment.id },
      data: { unassignedAt: new Date() },
    });

    const after = await resolveScope(coach);
    expect(after.teamIds).not.toContain(teamId);

    await prisma.staffTeam.update({
      where: { id: assignment.id },
      data: { unassignedAt: null },
    });
  });
});

describe("a guardian may only reach their own children", () => {
  it("sees their child", async () => {
    const record = await getPlayer(parent, ownChildId);
    expect(record.id).toBe(ownChildId);
  });

  /**
   * The URL-tampering case from the spec: a parent swapping the id for
   * another family's child must be refused by the backend.
   */
  it("is refused another family's child", async () => {
    await expect(getPlayer(parent, otherChildId)).rejects.toThrow();
  });

  it("cannot reach another child through the list either", async () => {
    const { items, meta } = await listPlayers(parent, {
      page: 1,
      pageSize: 100,
    });

    const ids = items.map((item) => item.id);
    expect(ids).toContain(ownChildId);
    expect(ids).not.toContain(otherChildId);

    // The total must reflect the narrowed query, not the whole table — a
    // count over everything would leak how many players exist.
    expect(meta.total).toBe(items.length);
  });

  it("cannot tell a missing id from someone else's", async () => {
    // Awaited one at a time. Starting both first left the second rejection
    // without a handler for a tick, which Vitest reports as an unhandled
    // rejection — intermittently, depending on which query finished first.
    const missing = await getPlayer(parent, "does-not-exist").catch(
      (error: unknown) => error,
    );
    const other = await getPlayer(parent, otherChildId).catch(
      (error: unknown) => error,
    );

    // The claim this test is named for: the two are indistinguishable. Both
    // must fail, and fail *the same way* — otherwise a parent could map out
    // which ids exist by reading the error.
    expect(missing).toMatchObject({ code: "OUT_OF_SCOPE" });
    expect(other).toMatchObject({ code: "OUT_OF_SCOPE" });
    expect((missing as Error).message).toBe((other as Error).message);
  });
});

describe("an administrator is not scoped", () => {
  it("is not narrowed to any subset", async () => {
    const scope = await resolveScope(admin);
    expect(scope.playerIds).toBeNull();

    // A null scope means the query is unfiltered, so the total is the whole
    // table. Asserting on a page of results instead would break as soon as the
    // table outgrows one page.
    const { meta } = await listPlayers(admin, { page: 1, pageSize: 1 });
    const total = await prisma.player.count();
    expect(meta.total).toBe(total);
  });

  it("reaches a single player directly", async () => {
    await expect(getPlayer(admin, otherChildId)).resolves.toBeDefined();
  });
});

describe("a coach is narrowed to their own teams", () => {
  it("sees only staff sharing a team", async () => {
    const { items } = await listStaff(coach, { page: 1, pageSize: 50 });
    const teamIds = new Set(
      items.flatMap((staff) => staff.teams.map((t) => t.teamId)),
    );

    const scope = await resolveScope(coach);
    for (const teamId of teamIds) {
      expect(scope.teamIds).toContain(teamId);
    }
  });

  it("is refused a coach from another team", async () => {
    const scope = await resolveScope(coach);
    const otherStaff = await prisma.staff.findFirst({
      where: {
        teams: { none: { teamId: { in: [...(scope.teamIds ?? [])] } } },
      },
    });

    expect(
      otherStaff,
      "the seed must include a coach on another team",
    ).not.toBeNull();
    await expect(getStaff(coach, otherStaff!.id)).rejects.toThrow();
  });

  it("lets an administrator reach any coach", async () => {
    const anyStaff = await prisma.staff.findFirstOrThrow();
    await expect(getStaff(admin, anyStaff.id)).resolves.toBeDefined();
  });
});

describe("sensitive fields", () => {
  /** A medical note is not part of a general read. */
  it("hides medical notes from a caller who cannot edit the player", async () => {
    await prisma.player.update({
      where: { id: ownChildId },
      data: { medicalNotes: "حساسیت فصلی" },
    });

    const asParent = await getPlayer(parent, ownChildId);
    expect(asParent.medicalNotes).toBeNull();

    const asAdmin = await getPlayer(admin, ownChildId);
    expect(asAdmin.medicalNotes).toBe("حساسیت فصلی");

    await prisma.player.update({
      where: { id: ownChildId },
      data: { medicalNotes: null },
    });
  });
});
