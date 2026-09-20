import { expect, test } from "@playwright/test";
import { signIn, signInAs, uniqueMobile } from "./support/sign-in";
import {
  createCoachWhoIsAlsoAParent,
  createCoachWithSquad,
  createParentOfSquadPlayer,
} from "./support/db";

test.describe("dashboard", () => {
  /**
   * The administrator's view: the whole academy, with the figures that drive a
   * decision and the alerts that need one.
   */
  test("an administrator sees the academy's figures", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "داشبورد" })).toBeVisible();

    for (const label of [
      "کل بازیکنان",
      "بازیکنان تیم‌ها",
      "بازیکنان مدرسه",
      "نرخ حضور",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // The charts this phase turned on.
    await expect(
      page.getByRole("heading", { name: "رشد بازیکنان" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "توزیع رشته‌ها" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "قیف استعدادیابی" }),
    ).toBeVisible();

    // Named for a screen reader, which cannot read a plot.
    await expect(
      page.getByRole("img", { name: /روند تعداد بازیکنان/ }),
    ).toBeVisible();
  });

  /**
   * A coach gets their squads and **not** the academy's totals. An aggregate
   * is still a disclosure (docs/PERMISSIONS.md).
   */
  test("a coach sees their squad and not the academy", async ({ page }) => {
    const mobile = uniqueMobile();
    await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "تیم‌های من" }),
    ).toBeVisible();

    await expect(page.getByText("کل بازیکنان", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "توزیع رشته‌ها" }),
    ).toHaveCount(0);

    // And the endpoint is refused too, not merely hidden.
    const response = await page.request.get("/api/v1/dashboard");
    expect(response.status()).toBe(403);
  });

  /** A parent sees their own child and nothing of the squad. */
  test("a parent sees their child and no roster", async ({ page }) => {
    const mobile = uniqueMobile();
    await createParentOfSquadPlayer(mobile);
    await signIn(page, mobile);

    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "پرونده من" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("heading", { name: "فرزندان من" }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "تیم‌های من" })).toHaveCount(
      0,
    );
    await expect(page.getByText("کل بازیکنان", { exact: true })).toHaveCount(0);

    const response = await page.request.get("/api/v1/dashboard");
    expect(response.status()).toBe(403);
  });

  /**
   * The reason this is one page and not five.
   *
   * A coach with a squad who is also the parent of a child in another squad.
   * One dashboard shows both; five routes would have to pick one and show them
   * half of who they are.
   */
  test("a coach who is also a parent sees both sections", async ({ page }) => {
    const mobile = uniqueMobile();
    await createCoachWhoIsAlsoAParent(mobile);
    await signIn(page, mobile);

    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "تیم‌های من" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "فرزندان من" }),
    ).toBeVisible();
  });
});
