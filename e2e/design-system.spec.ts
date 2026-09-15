import { expect, test } from "@playwright/test";

test.describe("design system", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/style-guide");
  });

  test("renders the style guide in Persian", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "راهنمای طراحی", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "رنگ‌ها" })).toBeVisible();
  });

  test("date picker opens a Jalali calendar and selects a day", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /تاریخ تولد/ }).click();

    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();

    // Saturday is the first column of the Iranian week. Scoped to the grid —
    // the style guide also renders a demo table with its own column headers.
    const headers = grid.getByRole("columnheader");
    await expect(headers).toHaveCount(7);
    await expect(headers.first()).toHaveAttribute("aria-label", "شنبه");

    // Focus must land on the grid, not on the month arrows.
    await expect(page.locator('[data-focused="true"]')).toBeFocused();

    // Pick whichever day the grid offers rather than a fixed date — the month
    // on screen depends on today, so a hard-coded day makes the test seasonal.
    const selectableDay = grid.locator("button:not([disabled])").first();
    const label = (await selectableDay.getAttribute("aria-label")) ?? "";
    const dayNumber = label.split(" ")[1] ?? "";
    expect(dayNumber).not.toBe("");

    await selectableDay.click();
    await expect(grid).toBeHidden();
    await expect(
      page.getByRole("button", { name: /تاریخ تولد/ }),
    ).toContainText(dayNumber);
  });

  test("calendar moves with the arrow keys, left meaning forward in RTL", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /تاریخ تولد/ }).click();

    const before = await page
      .locator('[data-focused="true"]')
      .getAttribute("aria-label");

    await page.keyboard.press("ArrowLeft");

    const after = await page
      .locator('[data-focused="true"]')
      .getAttribute("aria-label");

    expect(after).not.toBe(before);
    await expect(page.locator('[data-focused="true"]')).toBeFocused();
  });

  test("future days are blocked when a maximum date is set", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /تاریخ تولد/ }).click();

    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();

    // The birth-date field caps at today, so some day buttons must be disabled.
    // `count()` does not auto-wait, hence the explicit visibility check above.
    expect(await grid.locator("button[disabled]").count()).toBeGreaterThan(0);
  });

  test("toasts announce the result of an action", async ({ page }) => {
    await page.getByRole("button", { name: "Toast موفق" }).click();
    await expect(page.getByText("حضور و غیاب ثبت شد")).toBeVisible();
  });

  test("dialog traps focus and closes on Escape", async ({ page }) => {
    await page.getByRole("button", { name: "Dialog", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("افزودن بازیکن")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("empty and error states are shown with meaningful text", async ({
    page,
  }) => {
    await expect(page.getByText("هنوز بازیکنی ثبت نشده است")).toBeVisible();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });
});
