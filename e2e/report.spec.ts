import { expect, test } from "@playwright/test";
import { signIn, signInAs, uniqueMobile } from "./support/sign-in";
import { createCoachWithSquad, createParentOfSquadPlayer } from "./support/db";

test.describe("reports", () => {
  test("an administrator runs a report and downloads it", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);
    await page.goto("/dashboard/reports");

    await expect(page.getByRole("heading", { name: "گزارش‌ها" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "فهرست بازیکنان تیم" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "فهرست بازیکنان تیم" }).click();
    await page.waitForURL(/report=roster/);
    // A column this report has and the others do not — «کد بازیکن» appears in
    // several, so asserting on it would not prove the switch happened, and it
    // did not: the download came back as the attendance report.
    await expect(
      page.getByRole("columnheader", { name: "سال تولد" }),
    ).toBeVisible();

    // The download is a plain link, so the browser handles it — which is what
    // gives the file the name the server chose.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "دریافت CSV" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(
      /^sepahan-roster-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  /**
   * The file a spreadsheet actually receives.
   *
   * Fetched through the API rather than the download event so the bytes can be
   * read: the BOM and the Latin digits are the two things that decide whether
   * Excel opens this correctly, and neither is visible on screen.
   */
  test("the CSV is what a spreadsheet needs", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);

    const response = await page.request.get(
      "/api/v1/reports/roster?format=csv",
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toContain("attachment");

    const body = await response.text();

    // The byte-order mark, without which Excel on Windows guesses wrong.
    expect(body.startsWith("﻿")).toBe(true);
    // Persian headers…
    expect(body).toContain("کد بازیکن");
    expect(body).toContain("SEP-");

    // …and every value this module *computes* — dates and numbers — in Latin
    // digits, because the reader is a spreadsheet.
    //
    // Stored text is left exactly as it is, even when it contains digits: the
    // season is **named** «۱۴۰۴-۱۴۰۵», and rewriting a name on the way out
    // would make the file disagree with the screen, which is the failure this
    // whole phase is built to avoid.
    const lines = body
      .replace(/^\ufeff/, "")
      .trim()
      .split("\r\n");
    const columns = lines[0]!.split(",");
    const seasonIndex = columns.indexOf("فصل");
    const yearIndex = columns.indexOf("سال تولد");
    const joinedIndex = columns.indexOf("تاریخ پیوستن");

    expect(lines.length).toBeGreaterThan(1);

    let yearsSeen = 0;
    for (const line of lines.slice(1)) {
      const cells = line.split(",");

      // A blank is a real answer — a player registered without a birth date
      // has none, and an empty cell is what a spreadsheet's `ISBLANK` agrees
      // with. The rule is about the digits *when there are any*.
      if (cells[yearIndex]) {
        expect(cells[yearIndex]).toMatch(/^\d{4}$/);
        yearsSeen += 1;
      }

      expect(cells[joinedIndex]).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
      // The one column that legitimately carries Persian digits.
      expect(cells[seasonIndex]).toMatch(/[۰-۹]/);
    }

    // And the column is not simply empty throughout, which would make the
    // check above pass without testing anything.
    expect(yearsSeen).toBeGreaterThan(0);
  });

  /** A coach exports their own squad and is refused another. */
  test("a coach cannot export another squad", async ({ page }) => {
    const mobile = uniqueMobile();
    const { teamId, otherTeamId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const mine = await page.request.get(
      `/api/v1/reports/roster?format=csv&teamId=${teamId}`,
    );
    expect(mine.status()).toBe(200);

    const theirs = await page.request.get(
      `/api/v1/reports/roster?format=csv&teamId=${otherTeamId}`,
    );
    expect(theirs.status()).toBe(403);
  });

  /** The talent pipeline is not a coach's to export. */
  test("a coach cannot export the talent report", async ({ page }) => {
    const mobile = uniqueMobile();
    await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const response = await page.request.get(
      "/api/v1/reports/applications?format=csv",
    );
    expect(response.status()).toBe(403);
  });

  /** A parent has no management reports at all. */
  test("a parent is refused a squad export", async ({ page }) => {
    const mobile = uniqueMobile();
    await createParentOfSquadPlayer(mobile);
    await signIn(page, mobile);

    const response = await page.request.get(
      "/api/v1/reports/applications?format=csv",
    );
    expect(response.status()).toBe(403);

    await page.goto("/dashboard/reports");
    await expect(
      page.getByRole("link", { name: "گزارش استعدادیابی" }),
    ).toHaveCount(0);
  });

  /** Filters live in the URL, which is what makes a report shareable. */
  test("a filtered report is a shareable link", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);

    await page.goto(
      "/dashboard/reports?report=matches&from=2000-01-01&to=2000-02-01",
    );

    await expect(
      page.getByRole("heading", { name: "گزارش مسابقات" }),
    ).toBeVisible();
    // Nothing happened in that window, which is an answer rather than an error.
    await expect(page.getByText("داده‌ای در این بازه نیست")).toBeVisible();
  });

  test("a backwards range is refused rather than silently ignored", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);

    const response = await page.request.get(
      "/api/v1/reports/matches?from=2026-09-20&to=2026-09-01",
    );
    expect(response.status()).toBe(422);
  });

  test("an unknown report is not found", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);

    const response = await page.request.get("/api/v1/reports/salaries");
    expect(response.status()).toBe(422);
  });
});
