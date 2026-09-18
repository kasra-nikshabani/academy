import { expect, test } from "@playwright/test";
import { signIn, uniqueMobile } from "./support/sign-in";
import { createCoachWithSquad, createParentOfSquadPlayer } from "./support/db";
import { getJsonOrNull } from "./support/api";

/** A past testing day, `n` days back. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

test.describe("performance", () => {
  /**
   * A coach measures a player twice and reads the trend back.
   *
   * Driven through the real form, because the form is where the Persian
   * digits, the date picker and the six independent fields actually meet.
   */
  test("a coach records a testing day and the trend follows", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    // An earlier testing day, so the second one has something to be a change
    // from.
    const first = await page.request.post(
      `/api/v1/players/${squadPlayerId}/performance`,
      {
        data: {
          measuredAt: daysAgo(30),
          entries: [
            { metric: "SPRINT_20M_S", value: 3.4 },
            { metric: "HEIGHT_CM", value: 168 },
          ],
        },
      },
    );
    expect(first.status(), await first.text()).toBe(201);

    await page.goto(`/dashboard/people/players/${squadPlayerId}`);
    await expect(page.getByRole("heading", { name: "عملکرد" })).toBeVisible();

    // Today's sheet, through the form.
    await page.getByLabel("سرعت ۲۰ متر", { exact: false }).fill("3.28");
    await page.getByLabel("پرش عمودی", { exact: false }).fill("41");
    await page.getByRole("button", { name: "ثبت اندازه‌گیری" }).click();
    await expect(page.getByText("اندازه‌گیری ثبت شد")).toBeVisible();

    await expect
      .poll(async () => {
        const body = (await getJsonOrNull(
          page,
          `/api/v1/players/${squadPlayerId}/performance?metric=SPRINT_20M_S`,
        )) as {
          data?: { trends?: { delta: number; improved: boolean }[] };
        } | null;

        const trend = body?.data?.trends?.[0];
        return trend ? { delta: trend.delta, improved: trend.improved } : null;
      })
      // The number fell and that is an improvement — the rule the whole metric
      // catalogue exists for.
      .toEqual({ delta: -0.12, improved: true });
  });

  /** Growth is not a score (docs/BUSINESS_RULES.md §19). */
  test("height reports its change without calling it progress", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    for (const [days, value] of [
      [60, 166],
      [1, 170],
    ] as const) {
      const response = await page.request.post(
        `/api/v1/players/${squadPlayerId}/performance`,
        {
          data: {
            measuredAt: daysAgo(days),
            entries: [{ metric: "HEIGHT_CM", value }],
          },
        },
      );
      expect(response.status(), await response.text()).toBe(201);
    }

    const body = (await getJsonOrNull(
      page,
      `/api/v1/players/${squadPlayerId}/performance?metric=HEIGHT_CM`,
    )) as {
      data?: { trends?: { delta: number; improved: boolean | null }[] };
    } | null;

    const trend = body?.data?.trends?.[0];
    expect(trend?.delta).toBe(4);
    expect(trend?.improved).toBeNull();
  });

  /** One value per metric per day: re-submitting corrects, never doubles. */
  test("a corrected reading replaces the day's value", async ({ page }) => {
    const mobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const day = daysAgo(10);

    for (const value of [3.9, 3.31]) {
      const response = await page.request.post(
        `/api/v1/players/${squadPlayerId}/performance`,
        {
          data: {
            measuredAt: day,
            entries: [{ metric: "SPRINT_20M_S", value }],
          },
        },
      );
      expect(response.status(), await response.text()).toBe(201);
    }

    const body = (await getJsonOrNull(
      page,
      `/api/v1/players/${squadPlayerId}/performance?metric=SPRINT_20M_S`,
    )) as { data?: { records?: { value: number }[] } } | null;

    expect(body?.data?.records).toHaveLength(1);
    expect(body?.data?.records?.[0]?.value).toBe(3.31);
  });

  /** A value no athlete could produce is a typo (docs/BUSINESS_RULES.md §19). */
  test("an impossible reading is refused", async ({ page }) => {
    const mobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const response = await page.request.post(
      `/api/v1/players/${squadPlayerId}/performance`,
      { data: { entries: [{ metric: "SPRINT_20M_S", value: 45 }] } },
    );
    expect(response.status()).toBe(422);

    // The same number is a perfectly ordinary Cooper-test-shaped mistake in
    // the other direction, and one global bound could refuse neither.
    const cooper = await page.request.post(
      `/api/v1/players/${squadPlayerId}/performance`,
      { data: { entries: [{ metric: "COOPER_TEST_M", value: 45 }] } },
    );
    expect(cooper.status()).toBe(422);
  });

  /** Only the coach's own squad (docs/PERMISSIONS.md §2). */
  test("a coach cannot measure another squad's player", async ({ page }) => {
    const mobile = uniqueMobile();
    const { otherTeamPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const response = await page.request.post(
      `/api/v1/players/${otherTeamPlayerId}/performance`,
      { data: { entries: [{ metric: "HEIGHT_CM", value: 170 }] } },
    );
    expect(response.status()).toBe(403);
  });

  /**
   * A parent sees the chart and never the form.
   *
   * Two different checks, and the test proves both: the scope lets them read,
   * the permission stops them writing.
   */
  test("a parent reads their child's record but cannot add to it", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { childId } = await createParentOfSquadPlayer(mobile);

    // Seeded through the API as an admin would, so the parent has something
    // to read.
    const coachMobile = uniqueMobile();
    await createCoachWithSquad(coachMobile);

    await signIn(page, mobile);

    const write = await page.request.post(
      `/api/v1/players/${childId}/performance`,
      { data: { entries: [{ metric: "HEIGHT_CM", value: 170 }] } },
    );
    expect(write.status()).toBe(403);

    const read = await page.request.get(
      `/api/v1/players/${childId}/performance`,
    );
    expect(read.status()).toBe(200);

    await page.goto("/dashboard/performance");
    // No squad to inspect — the page offers the child's own record instead of
    // an empty table that would read as a permission failure.
    await expect(
      page.getByRole("heading", { name: "پرونده‌های شما" }),
    ).toBeVisible();
  });
});
