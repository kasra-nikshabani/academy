import { expect, test } from "@playwright/test";
import { signInAs } from "./support/sign-in";

test.describe("roles and permissions", () => {
  test("the dashboard shows the roles a user holds", async ({ page }) => {
    await signInAs(page, ["STAFF"]);
    await expect(page.getByText("کادر فنی")).toBeVisible();
  });

  test("a user with two roles sees both", async ({ page }) => {
    await signInAs(page, ["STAFF", "PARENT"]);
    await expect(page.getByText("کادر فنی")).toBeVisible();
    await expect(page.getByText("ولی", { exact: true })).toBeVisible();
  });

  test("/api/v1/me reports roles and permissions", async ({ page }) => {
    await signInAs(page, ["STAFF"]);

    const response = await page.request.get("/api/v1/me");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.roles.map((role: { key: string }) => role.key)).toEqual([
      "STAFF",
    ]);

    const keys = body.data.permissions.map((p: { key: string }) => p.key);
    expect(keys).toContain("training:write");
    expect(keys).not.toContain("user:write");
  });

  test("an administrator may list users, with pagination meta", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);

    const response = await page.request.get("/api/v1/users?page=1&pageSize=2");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 2 });
    expect(body.meta.totalPages).toBeGreaterThan(0);
  });

  /**
   * The check the whole phase exists for: the coach never sees a link to user
   * management, but hiding the link is not what stops them — calling the
   * endpoint directly is refused by the backend.
   */
  test("a coach calling the users endpoint directly is refused", async ({
    page,
  }) => {
    await signInAs(page, ["STAFF"]);

    const response = await page.request.get("/api/v1/users");
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
  });

  test("a player calling the roles endpoint directly is refused", async ({
    page,
  }) => {
    await signInAs(page, ["MAIN_TEAM_PLAYER"]);

    const response = await page.request.get("/api/v1/roles");
    expect(response.status()).toBe(403);
  });

  test("the user-management card is hidden from a coach", async ({ page }) => {
    await signInAs(page, ["STAFF"]);
    await expect(page.getByText("مدیریت کاربران")).toBeHidden();
  });

  test("the user-management card is shown to an administrator", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);
    await expect(page.getByText("مدیریت کاربران")).toBeVisible();
  });

  test("a page size beyond the cap is rejected", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);

    const response = await page.request.get("/api/v1/users?pageSize=5000");
    expect(response.status()).toBe(422);

    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
