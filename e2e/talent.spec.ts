import { expect, test } from "@playwright/test";
import { signIn, signInAs, uniqueMobile } from "./support/sign-in";
import { createCoachWithSquad } from "./support/db";

test.describe("talent pipeline", () => {
  test("the manager's page shows the funnel and the queues", async ({
    page,
  }) => {
    await signInAs(page, ["ACADEMY_MANAGER"]);
    await page.goto("/dashboard/talent");

    await expect(
      page.getByRole("heading", { name: "قیف استعدادیابی" }),
    ).toBeVisible();

    /*
      Asserted on each bar's accessible name rather than the label text.
      "پذیرفته‌شده" is legitimately on the page twice — once as a headline
      metric and once as a funnel stage — so plain text is ambiguous, while
      the bar's name is unique and is the thing a screen reader reads.
    */
    for (const stage of [
      "درخواست ثبت‌شده",
      "عبور از غربالگری",
      "ارزیابی‌شده",
      "پذیرفته‌شده",
    ]) {
      await expect(
        page.getByRole("img", { name: new RegExp(`^${stage}: `) }),
      ).toBeVisible();
    }

    // And the three queues that make the page worth opening.
    for (const queue of [
      "در انتظار غربالگری",
      "در انتظار ارزیاب",
      "در انتظار تصمیم",
    ]) {
      await expect(page.getByText(queue).first()).toBeVisible();
    }
  });

  test("the season toggle changes what is counted", async ({ page }) => {
    await signInAs(page, ["ACADEMY_MANAGER"]);
    await page.goto("/dashboard/talent");

    await expect(page.getByRole("link", { name: "همه فصل‌ها" })).toBeVisible();
    await page.getByRole("link", { name: "همه فصل‌ها" }).click();

    await expect(page).toHaveURL(/allSeasons=true/);
    await expect(
      page.getByRole("link", { name: "فقط فصل جاری" }),
    ).toBeVisible();
  });

  /**
   * A coach holds no tryout permission, so the pipeline is closed to them —
   * both the page and the endpoint behind it (docs/BUSINESS_RULES.md §16).
   */
  test("a coach cannot read the pipeline", async ({ page }) => {
    const mobile = uniqueMobile();
    await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const refused = await page.request.get("/api/v1/talent/pipeline");
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe("FORBIDDEN");

    // The link is not even offered to them.
    await page.goto("/dashboard");
    await expect(
      page.getByRole("link", { name: "قیف استعدادیابی" }),
    ).toHaveCount(0);
  });

  test("a queue row links to the trial it belongs to", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);
    await page.goto("/dashboard/talent");

    const firstQueueLink = page
      .locator('a[href^="/dashboard/tryouts/"]')
      .first();

    if ((await firstQueueLink.count()) > 0) {
      await firstQueueLink.click();
      await expect(page).toHaveURL(/\/dashboard\/tryouts\/.+/);
      await expect(page.getByText("کل درخواست‌ها")).toBeVisible();
    }
  });
});
