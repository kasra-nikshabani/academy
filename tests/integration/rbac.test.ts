import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import {
  listUsersForCaller,
  getUserForCaller,
} from "@/lib/services/user.service";
import { listRolesForCaller } from "@/lib/services/role.service";
import { ROLE_DEFINITIONS } from "@/lib/permissions/roles";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";

/**
 * Exercises authorization against the seeded database: roles resolve to the
 * permissions the catalogue promises, and services refuse callers who lack
 * them.
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

const ADMIN = "09120000001";
const COACH = "09120000003";
const PLAYER = "09120000004";
const COACH_PARENT = "09120000006";

beforeAll(async () => {
  // The seed must have been applied; these assertions are meaningless without it.
  const roleCount = await prisma.role.count();
  expect(roleCount).toBe(ROLE_DEFINITIONS.length);
});

describe("role resolution", () => {
  it("gives the admin every permission in the catalogue", async () => {
    const admin = await authorizedUser(ADMIN);

    expect(admin.roles).toEqual(["ADMIN"]);
    expect([...admin.permissions].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it("gives a coach exactly the staff set", async () => {
    const coach = await authorizedUser(COACH);
    const staff = ROLE_DEFINITIONS.find((role) => role.key === "STAFF");

    expect(coach.roles).toEqual(["STAFF"]);
    expect([...coach.permissions].sort()).toEqual(
      [...staff!.permissions].sort(),
    );
  });

  /** One person, two roles — the case that made UserRole a table. */
  it("unions the permissions of a coach who is also a parent", async () => {
    const both = await authorizedUser(COACH_PARENT);

    expect([...both.roles].sort()).toEqual(["PARENT", "STAFF"]);
    expect(both.permissions).toContain("training:write"); // from STAFF
    expect(both.permissions).toContain("child:read"); // from PARENT
    // and nothing beyond the union
    expect(both.permissions).not.toContain("user:write");
    expect(both.permissions).not.toContain("tryout:decide");
  });

  it("does not duplicate permissions shared by two roles", async () => {
    const both = await authorizedUser(COACH_PARENT);
    expect(new Set(both.permissions).size).toBe(both.permissions.length);
  });
});

describe("service-layer enforcement", () => {
  it("lets an administrator list users", async () => {
    const admin = await authorizedUser(ADMIN);
    const result = await listUsersForCaller(admin, { page: 1, pageSize: 20 });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.meta.total).toBeGreaterThan(0);
    expect(result.meta.page).toBe(1);
  });

  it("refuses a coach listing users", async () => {
    const coach = await authorizedUser(COACH);
    await expect(
      listUsersForCaller(coach, { page: 1, pageSize: 20 }),
    ).rejects.toThrow();
  });

  it("refuses a player listing users", async () => {
    const player = await authorizedUser(PLAYER);
    await expect(
      listUsersForCaller(player, { page: 1, pageSize: 20 }),
    ).rejects.toThrow();
  });

  it("refuses a coach reading the role catalogue", async () => {
    const coach = await authorizedUser(COACH);
    await expect(listRolesForCaller(coach)).rejects.toThrow();
  });

  it("lets an administrator read the role catalogue", async () => {
    const admin = await authorizedUser(ADMIN);
    const roles = await listRolesForCaller(admin);
    expect(roles).toHaveLength(ROLE_DEFINITIONS.length);
  });
});

describe("scope: reading a single user", () => {
  it("lets anyone read their own record without user:read", async () => {
    const player = await authorizedUser(PLAYER);
    const self = await getUserForCaller(player, player.id);
    expect(self.id).toBe(player.id);
  });

  /**
   * The URL-tampering case: a signed-in player swapping the id for someone
   * else's must be refused by the backend, not merely by a hidden link.
   */
  it("refuses a player reading another user's record", async () => {
    const player = await authorizedUser(PLAYER);
    const coach = await authorizedUser(COACH);

    await expect(getUserForCaller(player, coach.id)).rejects.toThrow();
  });

  it("lets an administrator read anybody", async () => {
    const admin = await authorizedUser(ADMIN);
    const coach = await authorizedUser(COACH);

    const record = await getUserForCaller(admin, coach.id);
    expect(record.id).toBe(coach.id);
  });

  it("does not disclose whether an unknown id exists", async () => {
    const player = await authorizedUser(PLAYER);
    // Out of scope is decided before existence is ever checked, so a missing
    // id and someone else's id are indistinguishable to the caller.
    await expect(getUserForCaller(player, "does-not-exist")).rejects.toThrow();
  });
});

describe("pagination", () => {
  it("reports a consistent total and page count", async () => {
    const admin = await authorizedUser(ADMIN);
    const firstPage = await listUsersForCaller(admin, { page: 1, pageSize: 2 });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.meta.pageSize).toBe(2);
    expect(firstPage.meta.totalPages).toBe(Math.ceil(firstPage.meta.total / 2));
  });

  it("returns different rows on the second page", async () => {
    const admin = await authorizedUser(ADMIN);
    const [first, second] = await Promise.all([
      listUsersForCaller(admin, { page: 1, pageSize: 2 }),
      listUsersForCaller(admin, { page: 2, pageSize: 2 }),
    ]);

    const firstIds = first.items.map((item) => item.id);
    for (const item of second.items) {
      expect(firstIds).not.toContain(item.id);
    }
  });
});
