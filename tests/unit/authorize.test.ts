import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  assertSelf,
  assertWithinScope,
  hasAnyPermission,
  hasPermission,
  hasRole,
  isUnscoped,
  requireAnyPermission,
  requirePermission,
  requireRole,
  splitPermission,
  type AuthorizedUser,
} from "@/lib/permissions";

function user(overrides: Partial<AuthorizedUser> = {}): AuthorizedUser {
  return {
    id: "user_1",
    mobile: "09123456789",
    roles: [],
    permissions: [],
    ...overrides,
  };
}

describe("permission catalogue", () => {
  it("keys are all resource:action", () => {
    for (const key of ALL_PERMISSIONS) {
      expect(key).toMatch(/^[a-z]+:[a-z]+$/);
      const { resource, action } = splitPermission(key);
      expect(resource).not.toBe("");
      expect(action).not.toBe("");
    }
  });

  it("every permission is described", () => {
    for (const key of ALL_PERMISSIONS) {
      expect(PERMISSIONS[key].length).toBeGreaterThan(0);
    }
  });
});

describe("role definitions", () => {
  it("covers all six academy roles", () => {
    expect(ROLE_DEFINITIONS.map((role) => role.key).sort()).toEqual([
      "ACADEMY_MANAGER",
      "ADMIN",
      "MAIN_TEAM_PLAYER",
      "PARENT",
      "SCHOOL_PLAYER",
      "STAFF",
    ]);
  });

  it("grants only permissions that exist", () => {
    const known = new Set<string>(ALL_PERMISSIONS);
    for (const role of ROLE_DEFINITIONS) {
      for (const permission of role.permissions) {
        expect(known.has(permission)).toBe(true);
      }
    }
  });

  it("gives ADMIN everything", () => {
    const admin = ROLE_DEFINITIONS.find((role) => role.key === "ADMIN");
    expect(admin?.permissions).toHaveLength(ALL_PERMISSIONS.length);
  });

  /**
   * The roles that must stay narrow. If a future edit hands a coach or a
   * parent administrative reach, this fails.
   */
  it("keeps non-administrative roles away from administration", () => {
    const administrative = [
      "user:write",
      "role:assign",
      "settings:write",
      "audit:read",
    ];

    for (const key of [
      "STAFF",
      "PARENT",
      "MAIN_TEAM_PLAYER",
      "SCHOOL_PLAYER",
    ] as const) {
      const role = ROLE_DEFINITIONS.find((item) => item.key === key);
      for (const permission of administrative) {
        expect(role?.permissions).not.toContain(permission);
      }
    }
  });

  it("does not let a parent or player write academy data", () => {
    for (const key of [
      "PARENT",
      "MAIN_TEAM_PLAYER",
      "SCHOOL_PLAYER",
    ] as const) {
      const role = ROLE_DEFINITIONS.find((item) => item.key === key);
      expect(role?.permissions).not.toContain("academy:write");
      expect(role?.permissions).not.toContain("player:write");
      expect(role?.permissions).not.toContain("attendance:write");
    }
  });

  it("does not let staff decide tryout outcomes", () => {
    // Accepting a player into a team is a manager's call (BUSINESS_RULES §2).
    const staff = ROLE_DEFINITIONS.find((role) => role.key === "STAFF");
    expect(staff?.permissions).not.toContain("tryout:decide");
    expect(staff?.permissions).not.toContain("enrollment:write");
  });
});

describe("permission checks", () => {
  const coach = user({ roles: ["STAFF"], permissions: ["training:write"] });

  it("allows what the caller holds", () => {
    expect(hasPermission(coach, "training:write")).toBe(true);
    expect(() => requirePermission(coach, "training:write")).not.toThrow();
  });

  it("denies what the caller does not hold", () => {
    expect(hasPermission(coach, "user:write")).toBe(false);
    expect(() => requirePermission(coach, "user:write")).toThrow();
  });

  it("supports any-of checks", () => {
    expect(hasAnyPermission(coach, ["user:write", "training:write"])).toBe(
      true,
    );
    expect(hasAnyPermission(coach, ["user:write", "audit:read"])).toBe(false);
    expect(() =>
      requireAnyPermission(coach, ["user:write", "audit:read"]),
    ).toThrow();
  });

  it("checks roles", () => {
    expect(hasRole(coach, "STAFF")).toBe(true);
    expect(hasRole(coach, "ADMIN")).toBe(false);
    expect(() => requireRole(coach, "ADMIN")).toThrow();
  });
});

describe("multiple roles", () => {
  /** A coach who is also a parent — the reason roles are a separate table. */
  const coachParent = user({
    roles: ["STAFF", "PARENT"],
    permissions: ["training:write", "player:read"],
  });

  it("holds the union of both roles", () => {
    expect(hasRole(coachParent, "STAFF")).toBe(true);
    expect(hasRole(coachParent, "PARENT")).toBe(true);
    expect(hasPermission(coachParent, "training:write")).toBe(true);
    expect(hasPermission(coachParent, "player:read")).toBe(true);
  });

  it("gains nothing it was not granted", () => {
    expect(hasPermission(coachParent, "user:write")).toBe(false);
    expect(hasPermission(coachParent, "tryout:decide")).toBe(false);
  });
});

describe("scope", () => {
  it("lets a caller reach their own record", () => {
    expect(() => assertSelf(user({ id: "user_1" }), "user_1")).not.toThrow();
  });

  /** Swapping an id in a URL must not reach somebody else's record. */
  it("blocks a caller from another user's record", () => {
    expect(() => assertSelf(user({ id: "user_1" }), "user_2")).toThrow();
  });

  it("does not widen self-scope for an administrator", () => {
    // An admin reaches other records through `user:read`, not by having
    // self-scope quietly relaxed.
    const admin = user({ id: "user_1", roles: ["ADMIN"] });
    expect(() => assertSelf(admin, "user_2")).toThrow();
  });

  it("narrows to an allowed id list", () => {
    expect(() => assertWithinScope(["t1", "t2"], "t1")).not.toThrow();
    expect(() => assertWithinScope(["t1", "t2"], "t3")).toThrow();
    expect(() => assertWithinScope(null, "anything")).not.toThrow();
  });

  it("treats only admin and manager as unscoped", () => {
    expect(isUnscoped(user({ roles: ["ADMIN"] }))).toBe(true);
    expect(isUnscoped(user({ roles: ["ACADEMY_MANAGER"] }))).toBe(true);
    expect(isUnscoped(user({ roles: ["STAFF"] }))).toBe(false);
    expect(isUnscoped(user({ roles: ["PARENT"] }))).toBe(false);
    expect(isUnscoped(user({ roles: ["STAFF", "PARENT"] }))).toBe(false);
  });
});
