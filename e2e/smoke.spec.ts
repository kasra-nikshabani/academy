import { expect, test } from "@playwright/test";

test.describe("Phase 0 smoke", () => {
  test("home page renders right-to-left in Persian", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "fa");

    await expect(
      page.getByRole("heading", {
        name: /سامانه مدیریت آکادمی باشگاه فولاد مبارکه سپاهان/,
      }),
    ).toBeVisible();
  });

  test("home page uses the Vazirmatn typeface", async ({ page }) => {
    await page.goto("/");

    const fontFamily = await page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).fontFamily);

    expect(fontFamily).toContain("Vazirmatn");
  });

  test("health endpoint answers with the standard envelope", async ({
    request,
  }) => {
    const response = await request.get("/api/v1/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: { status: "ok", database: "up" },
      meta: { service: "academy-os" },
    });
  });
});
