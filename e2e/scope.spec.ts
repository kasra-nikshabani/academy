import { expect, test } from "@playwright/test";
import { createParentWithChild } from "./support/db";
import { signIn, signInAs, uniqueMobile } from "./support/sign-in";

/**
 * Scope, over real HTTP.
 *
 * The spec names this as a mandatory scenario: changing an id in the URL must
 * not reach another person's record. These tests do exactly that.
 */
test.describe("scope enforcement", () => {
  test("a parent reaches their own child", async ({ page }) => {
    const mobile = uniqueMobile();
    const { ownChildId } = await createParentWithChild(mobile);
    await signIn(page, mobile);

    const response = await page.request.get(`/api/v1/players/${ownChildId}`);
    expect(response.status()).toBe(200);
    expect((await response.json()).data.id).toBe(ownChildId);
  });

  test("a parent is refused another family's child by id", async ({ page }) => {
    const mobile = uniqueMobile();
    const { strangerChildId } = await createParentWithChild(mobile);
    await signIn(page, mobile);

    const response = await page.request.get(
      `/api/v1/players/${strangerChildId}`,
    );

    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("OUT_OF_SCOPE");
  });

  test("another family's child is absent from the parent's list", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { ownChildId, strangerChildId } = await createParentWithChild(mobile);
    await signIn(page, mobile);

    const response = await page.request.get("/api/v1/players?pageSize=100");
    const body = await response.json();
    const ids = body.data.map((player: { id: string }) => player.id);

    expect(ids).toContain(ownChildId);
    expect(ids).not.toContain(strangerChildId);
    // The total reflects the narrowed query, so it cannot be used to count
    // players the caller may not see.
    expect(body.meta.total).toBe(body.data.length);
  });

  test("the parent's page refuses a tampered id", async ({ page }) => {
    const mobile = uniqueMobile();
    const { strangerChildId } = await createParentWithChild(mobile);
    await signIn(page, mobile);

    const response = await page.goto(
      `/dashboard/people/players/${strangerChildId}`,
    );

    // The page must not render another family's child.
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });

  test("a coach with no team assignment sees no players", async ({ page }) => {
    await signInAs(page, ["STAFF"]);

    const response = await page.request.get("/api/v1/players");
    expect(response.status()).toBe(200);

    // The account holds player:read but is assigned to no team, so scope is
    // empty — erring closed rather than open.
    expect((await response.json()).data).toHaveLength(0);
  });

  test("an administrator is not narrowed", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);

    const response = await page.request.get("/api/v1/players?pageSize=100");
    const body = await response.json();

    expect(body.meta.total).toBeGreaterThan(0);
  });

  test("a coach may not assign themselves to a team", async ({ page }) => {
    await signInAs(page, ["STAFF"]);

    // Widening one's own reach requires staff:write, which a coach lacks.
    const response = await page.request.post("/api/v1/staff/any-id/teams", {
      data: { teamId: "any-team", role: "HEAD_COACH" },
    });

    expect(response.status()).toBe(403);
  });
});
