import { expect, test } from "@playwright/test";
import { signIn, uniqueMobile } from "./support/sign-in";
import { createCoachWithSquad } from "./support/db";
import { getJsonOrNull } from "./support/api";

/** A kick-off already in the past, so statistics may be recorded. */
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

test.describe("matches", () => {
  /**
   * The mandatory scenario from CLAUDE.md §28, driven through the real sheet:
   * a coach names the squad, then records what each player did.
   */
  test("a coach names the squad and records the result", async ({ page }) => {
    const mobile = uniqueMobile();
    const { teamId, squadPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const created = await page.request.post("/api/v1/matches", {
      data: {
        teamId,
        opponent: "حریف آزمایشی",
        competition: "دوستانه",
        homeAway: "HOME",
        kickoffAt: hoursAgo(3).toISOString(),
        durationMinutes: 80,
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const match = (await created.json()).data;

    await page.goto(`/dashboard/matches/${match.id}`);
    await expect(
      page.getByRole("heading", { name: /حریف آزمایشی/ }),
    ).toBeVisible();

    // Name the one squad member as a starter, then save the sheet.
    const row = page.getByRole("listitem").filter({ hasText: "هم‌تیمی" });
    await row.getByRole("radio", { name: "اصلی" }).click();
    await page.getByRole("button", { name: "ثبت ترکیب" }).click();
    await expect(page.getByText("ترکیب ثبت شد")).toBeVisible();

    // The match has kicked off, so the statistics appear.
    await page.reload();
    const named = page.getByRole("listitem").filter({ hasText: "هم‌تیمی" });
    await named.getByRole("spinbutton", { name: /^دقیقه/ }).fill("80");
    await named.getByRole("spinbutton", { name: /^گل/ }).fill("2");

    await page.getByRole("button", { name: "ثبت آمار مسابقه" }).click();
    await expect(page.getByText("آمار مسابقه ثبت شد")).toBeVisible();

    await expect
      .poll(async () => {
        const body = (await getJsonOrNull(
          page,
          `/api/v1/players/${squadPlayerId}/matches`,
        )) as {
          data?: { totals?: { goals?: number; appearances?: number } };
        } | null;
        return body?.data?.totals
          ? {
              goals: body.data.totals.goals,
              appearances: body.data.totals.appearances,
            }
          : null;
      })
      .toEqual({ goals: 2, appearances: 1 });
  });

  /** Only the squad plays (docs/BUSINESS_RULES.md §18). */
  test("a player from another squad cannot be named", async ({ page }) => {
    const mobile = uniqueMobile();
    const { teamId, otherTeamPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const created = await page.request.post("/api/v1/matches", {
      data: {
        teamId,
        opponent: "حریف",
        homeAway: "AWAY",
        kickoffAt: hoursAgo(2).toISOString(),
        durationMinutes: 80,
      },
    });
    const match = (await created.json()).data;

    const refused = await page.request.put(
      `/api/v1/matches/${match.id}/lineup`,
      { data: { entries: [{ playerId: otherTeamPlayerId, role: "STARTER" }] } },
    );

    expect(refused.status()).toBe(422);
    expect((await refused.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("a clashing fixture is refused, a later one is not", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { teamId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const kickoffAt = hoursAgo(6);

    const first = await page.request.post("/api/v1/matches", {
      data: {
        teamId,
        opponent: "اولی",
        homeAway: "HOME",
        kickoffAt: kickoffAt.toISOString(),
        durationMinutes: 80,
      },
    });
    expect(first.status()).toBe(201);
    const firstMatch = (await first.json()).data;

    const clashing = await page.request.post("/api/v1/matches", {
      data: {
        teamId,
        opponent: "هم‌زمان",
        homeAway: "HOME",
        kickoffAt: new Date(kickoffAt.getTime() + 30 * 60 * 1000).toISOString(),
        durationMinutes: 80,
      },
    });
    expect(clashing.status()).toBe(409);

    const after = await page.request.post("/api/v1/matches", {
      data: {
        teamId,
        opponent: "بعدی",
        homeAway: "HOME",
        kickoffAt: firstMatch.endsAt,
        durationMinutes: 80,
      },
    });
    expect(after.status(), await after.text()).toBe(201);
  });

  test("calling a fixture off keeps it, with the reason", async ({ page }) => {
    const mobile = uniqueMobile();
    const { teamId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const created = await page.request.post("/api/v1/matches", {
      data: {
        teamId,
        opponent: "لغوشده",
        homeAway: "HOME",
        kickoffAt: hoursAgo(1).toISOString(),
        durationMinutes: 80,
      },
    });
    const match = (await created.json()).data;

    const off = await page.request.delete(
      `/api/v1/matches/${match.id}?status=POSTPONED&reason=${encodeURIComponent("بارندگی شدید")}`,
    );
    expect(off.status()).toBe(200);
    expect((await off.json()).data.status).toBe("POSTPONED");

    await page.goto(`/dashboard/matches/${match.id}`);
    await expect(
      page.getByText("این مسابقه به تعویق افتاده است"),
    ).toBeVisible();
    await expect(page.getByText("بارندگی شدید")).toBeVisible();
  });
});
