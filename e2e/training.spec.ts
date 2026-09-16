import { expect, test } from "@playwright/test";
import { signIn, signInAs, uniqueMobile } from "./support/sign-in";
import {
  createCoachWithSquad,
  createParentOfSquadPlayer,
  createTrainingSession,
} from "./support/db";

/**
 * A time inside the week the calendar opens on, so a session created here is
 * visible without navigating. Tehran is UTC+03:30, so 06:30 UTC is 10:00 local.
 */
function thisWeekAt(dayOffset: number, utcHour: number): Date {
  const now = new Date();
  const day = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      utcHour,
      0,
      0,
      0,
    ),
  );
}

test.describe("training calendar", () => {
  test("a coach sees their own team's week and not another's", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { teamId, otherTeamId } = await createCoachWithSquad(mobile);

    const mine = await createTrainingSession({
      teamId,
      startsAt: thisWeekAt(0, 6),
      location: "زمین شماره ۳",
    });
    const theirs = await createTrainingSession({
      teamId: otherTeamId,
      startsAt: thisWeekAt(0, 9),
    });

    await signIn(page, mobile);
    await page.goto("/dashboard/training");

    await expect(
      page.getByRole("heading", { name: "تمرین", exact: true }),
    ).toBeVisible();

    // Asserted on the link, not on any text inside the card: what the card
    // shows depends on how wide its column is, and what must be true is that
    // the session is on the page and reachable.
    await expect(
      page.locator(`a[href="/dashboard/training/sessions/${mine}"]`),
    ).toBeVisible();

    // The other team's session is on neither the page nor its own URL.
    await expect(
      page.locator(`a[href="/dashboard/training/sessions/${theirs}"]`),
    ).toHaveCount(0);

    const ownResponse = await page.request.get(
      `/api/v1/training/sessions/${mine}`,
    );
    expect(ownResponse.status()).toBe(200);

    const otherResponse = await page.request.get(
      `/api/v1/training/sessions/${theirs}`,
    );
    expect(otherResponse.status()).toBe(403);
    expect((await otherResponse.json()).error.code).toBe("OUT_OF_SCOPE");
  });

  test("a coach may schedule for their own team and not another", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { teamId, otherTeamId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const created = await page.request.post("/api/v1/training/sessions", {
      data: {
        teamId,
        startsAt: thisWeekAt(1, 6).toISOString(),
        durationMinutes: 90,
        type: "TECHNICAL",
        location: "زمین اصلی",
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const session = (await created.json()).data;
    expect(session.team.id).toBe(teamId);

    const refused = await page.request.post("/api/v1/training/sessions", {
      data: {
        teamId: otherTeamId,
        startsAt: thisWeekAt(1, 6).toISOString(),
        durationMinutes: 90,
      },
    });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe("OUT_OF_SCOPE");
  });

  /** A squad cannot be in two places at once (docs/BUSINESS_RULES.md §7). */
  test("a clashing session is refused, a back-to-back one is not", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { teamId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const startsAt = thisWeekAt(2, 6);

    const first = await page.request.post("/api/v1/training/sessions", {
      data: { teamId, startsAt: startsAt.toISOString(), durationMinutes: 90 },
    });
    expect(first.status()).toBe(201);
    const firstSession = (await first.json()).data;

    const clashing = await page.request.post("/api/v1/training/sessions", {
      data: {
        teamId,
        startsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
        durationMinutes: 90,
      },
    });
    expect(clashing.status()).toBe(409);
    expect((await clashing.json()).error.code).toBe("CONFLICT");

    const backToBack = await page.request.post("/api/v1/training/sessions", {
      data: {
        teamId,
        startsAt: firstSession.endsAt,
        durationMinutes: 60,
      },
    });
    expect(backToBack.status(), await backToBack.text()).toBe(201);
  });

  test("cancelling keeps the session and says why", async ({ page }) => {
    const mobile = uniqueMobile();
    const { teamId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const created = await page.request.post("/api/v1/training/sessions", {
      data: {
        teamId,
        startsAt: thisWeekAt(3, 6).toISOString(),
        durationMinutes: 90,
      },
    });
    const session = (await created.json()).data;

    const cancelled = await page.request.delete(
      `/api/v1/training/sessions/${session.id}?reason=${encodeURIComponent("بارندگی شدید")}`,
    );
    expect(cancelled.status()).toBe(200);
    expect((await cancelled.json()).data.status).toBe("CANCELLED");

    // The row is still there, and the page explains itself.
    await page.goto(`/dashboard/training/sessions/${session.id}`);
    await expect(page.getByText("این جلسه لغو شده است")).toBeVisible();
    await expect(page.getByText("بارندگی شدید")).toBeVisible();
  });

  test("a parent sees when their child trains, and nothing else", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { teamId, otherTeamId } = await createParentOfSquadPlayer(mobile);

    const childSession = await createTrainingSession({
      teamId,
      startsAt: thisWeekAt(0, 7),
      location: "زمین فرزند",
    });
    const strangerSession = await createTrainingSession({
      teamId: otherTeamId,
      startsAt: thisWeekAt(0, 10),
    });

    await signIn(page, mobile);
    await page.goto("/dashboard/training");

    await expect(
      page.locator(`a[href="/dashboard/training/sessions/${childSession}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/dashboard/training/sessions/${strangerSession}"]`),
    ).toHaveCount(0);

    expect(
      (
        await page.request.get(`/api/v1/training/sessions/${childSession}`)
      ).status(),
    ).toBe(200);

    const refused = await page.request.get(
      `/api/v1/training/sessions/${strangerSession}`,
    );
    expect(refused.status()).toBe(403);

    // Seeing the calendar is not being able to change it.
    const write = await page.request.post("/api/v1/training/sessions", {
      data: {
        teamId,
        startsAt: thisWeekAt(4, 6).toISOString(),
        durationMinutes: 90,
      },
    });
    expect(write.status()).toBe(403);
    expect((await write.json()).error.code).toBe("FORBIDDEN");
  });

  test("an administrator writes a plan and attaches it to a session", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { teamId } = await createCoachWithSquad(mobile);
    await signInAs(page, ["ADMIN"]);

    const planResponse = await page.request.post("/api/v1/training/plans", {
      data: {
        teamId,
        title: `برنامه آزمون ${Date.now() % 100000}`,
        type: "TECHNICAL",
        exercises: [
          { title: "گرم کردن", durationMinutes: 15 },
          { title: "پاس‌کاری", durationMinutes: 30 },
        ],
      },
    });
    expect(planResponse.status(), await planResponse.text()).toBe(201);
    const plan = (await planResponse.json()).data;
    expect(plan.exercises).toHaveLength(2);

    const sessionResponse = await page.request.post(
      "/api/v1/training/sessions",
      {
        data: {
          teamId,
          planId: plan.id,
          startsAt: thisWeekAt(5, 6).toISOString(),
          durationMinutes: 90,
        },
      },
    );
    expect(sessionResponse.status()).toBe(201);
    const session = (await sessionResponse.json()).data;

    await page.goto(`/dashboard/training/sessions/${session.id}`);
    await expect(page.getByRole("heading", { name: plan.title })).toBeVisible();
    await expect(page.getByText("پاس‌کاری")).toBeVisible();

    await page.goto("/dashboard/training/plans");
    await expect(page.getByText(plan.title)).toBeVisible();
  });
});
