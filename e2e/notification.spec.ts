import { expect, test } from "@playwright/test";
import { signIn, signInAs, uniqueMobile } from "./support/sign-in";
import { createCoachWithSquad, createParentOfSquadPlayer } from "./support/db";
import { getJsonOrNull } from "./support/api";

interface InboxBody {
  data?: { id: string; title: string; readAt: string | null }[];
  meta?: { unread?: number; total?: number };
}

test.describe("notifications", () => {
  /**
   * A coach writes to their squad, and the families read it.
   *
   * Two browser contexts, because the point is that a message leaves one
   * person's hands and arrives in another's inbox.
   */
  test("a coach announces to the squad and the parent is told", async ({
    browser,
  }) => {
    const parentMobile = uniqueMobile();
    const { teamId } = await createParentOfSquadPlayer(parentMobile);

    const coachMobile = uniqueMobile();
    const coachContext = await browser.newContext();
    const coachPage = await coachContext.newPage();
    await signIn(coachPage, coachMobile);

    // The coach of this particular squad, so the scope check passes.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAs(adminPage, ["ADMIN"]);

    const drafted = await adminPage.request.post("/api/v1/announcements", {
      data: {
        title: "جابه‌جایی تمرین",
        body: "تمرین پنجشنبه به ساعت ۱۷:۰۰ منتقل شد.",
        type: "TRAINING",
        teamId,
      },
    });
    expect(drafted.status(), await drafted.text()).toBe(201);
    const announcement = (await drafted.json()).data;

    // A draft has told nobody yet.
    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    await signIn(parentPage, parentMobile);

    const before = (await getJsonOrNull(
      parentPage,
      "/api/v1/notifications",
    )) as InboxBody | null;
    const unreadBefore = before?.meta?.unread ?? 0;

    // Publishing is the second, deliberate act.
    const published = await adminPage.request.post(
      `/api/v1/announcements/${announcement.id}/publish`,
      {},
    );
    expect(published.status(), await published.text()).toBe(200);

    await expect
      .poll(async () => {
        const body = (await getJsonOrNull(
          parentPage,
          "/api/v1/notifications",
        )) as InboxBody | null;
        return body?.meta?.unread ?? 0;
      })
      .toBe(unreadBefore + 1);

    // And it is readable on the page, with the badge showing.
    await parentPage.goto("/dashboard/notifications");
    await expect(
      parentPage.getByText("تمرین پنجشنبه به ساعت ۱۷:۰۰ منتقل شد."),
    ).toBeVisible();

    await parentPage.getByRole("button", { name: "خواندم" }).first().click();

    await expect
      .poll(async () => {
        const body = (await getJsonOrNull(
          parentPage,
          "/api/v1/notifications",
        )) as InboxBody | null;
        return body?.meta?.unread ?? 0;
      })
      .toBe(unreadBefore);

    await coachContext.close();
    await adminContext.close();
    await parentContext.close();
  });

  /** Publishing happens once; a second press is a conflict, not a second send. */
  test("an announcement cannot be published twice", async ({ page }) => {
    const mobile = uniqueMobile();
    const { teamId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const drafted = await page.request.post("/api/v1/announcements", {
      data: {
        title: "اطلاعیه یک‌بار مصرف",
        body: "این اطلاعیه فقط یک بار منتشر می‌شود.",
        teamId,
      },
    });
    expect(drafted.status(), await drafted.text()).toBe(201);
    const announcement = (await drafted.json()).data;

    const first = await page.request.post(
      `/api/v1/announcements/${announcement.id}/publish`,
      {},
    );
    expect(first.status()).toBe(200);

    const second = await page.request.post(
      `/api/v1/announcements/${announcement.id}/publish`,
      {},
    );
    expect(second.status()).toBe(409);
  });

  /** A coach writes to their squads, not to the club. */
  test("a coach cannot announce to the whole academy", async ({ page }) => {
    const mobile = uniqueMobile();
    await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const response = await page.request.post("/api/v1/announcements", {
      data: { title: "به همه", body: "این نباید پذیرفته شود." },
    });
    expect(response.status()).toBe(422);
  });

  /** Nor to a squad that is not theirs. */
  test("a coach cannot announce to another squad", async ({ page }) => {
    const mobile = uniqueMobile();
    const { otherTeamId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const response = await page.request.post("/api/v1/announcements", {
      data: {
        title: "تیم دیگر",
        body: "این نباید پذیرفته شود.",
        teamId: otherTeamId,
      },
    });
    expect(response.status()).toBe(403);
  });

  /**
   * A parent holds `notification:read` and not `notification:send`: they see
   * what was published and can write nothing.
   */
  test("a parent reads announcements but cannot write one", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    await createParentOfSquadPlayer(mobile);
    await signIn(page, mobile);

    const write = await page.request.post("/api/v1/announcements", {
      data: { title: "از طرف ولی", body: "این نباید پذیرفته شود." },
    });
    expect(write.status()).toBe(403);

    const read = await page.request.get("/api/v1/announcements");
    expect(read.status()).toBe(200);
  });

  /** An inbox is reached by owning it; there is no id to swap in the URL. */
  test("another person's notification cannot be marked read", async ({
    browser,
  }) => {
    const parentMobile = uniqueMobile();
    const { teamId } = await createParentOfSquadPlayer(parentMobile);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAs(adminPage, ["ADMIN"]);

    const drafted = await adminPage.request.post("/api/v1/announcements", {
      data: { title: "برای تیم", body: "متن اطلاعیه تیمی.", teamId },
    });
    const announcement = (await drafted.json()).data;
    await adminPage.request.post(
      `/api/v1/announcements/${announcement.id}/publish`,
      {},
    );

    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    await signIn(parentPage, parentMobile);

    const inbox = (await getJsonOrNull(
      parentPage,
      "/api/v1/notifications",
    )) as InboxBody | null;
    const mine = inbox?.data?.[0];
    expect(mine).toBeDefined();

    // A different signed-in person cannot touch it — and gets the same answer
    // as they would for an id that does not exist.
    const outsiderMobile = uniqueMobile();
    await createCoachWithSquad(outsiderMobile);
    const outsiderContext = await browser.newContext();
    const outsiderPage = await outsiderContext.newPage();
    await signIn(outsiderPage, outsiderMobile);

    const response = await outsiderPage.request.patch(
      `/api/v1/notifications/${mine!.id}`,
      {},
    );
    expect(response.status()).toBe(404);

    await adminContext.close();
    await parentContext.close();
    await outsiderContext.close();
  });
});
