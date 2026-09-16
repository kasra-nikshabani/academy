import { expect, test } from "@playwright/test";
import { signIn, signInAs, uniqueMobile } from "./support/sign-in";
import {
  createCoachWithSquad,
  createParentOfSquadPlayer,
  createTrainingSession,
} from "./support/db";

/** A session that has already started, so a register may be taken for it. */
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

test.describe("training attendance", () => {
  /**
   * The mandatory scenario from CLAUDE.md §28, driven through the real sheet:
   * mark the squad present, correct the one who was not, save.
   */
  test("a coach marks the squad present and corrects one row", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { teamId } = await createCoachWithSquad(mobile);
    const sessionId = await createTrainingSession({
      teamId,
      startsAt: hoursAgo(3),
    });

    await signIn(page, mobile);
    await page.goto(`/dashboard/training/sessions/${sessionId}`);

    await expect(
      page.getByRole("heading", { name: "حضور و غیاب" }),
    ).toBeVisible();

    const sheet = page.getByRole("list").filter({ hasText: "هم‌تیمی" });
    await expect(sheet).toBeVisible();

    await page.getByRole("button", { name: "همه حاضر" }).click();

    // The squad has one player; mark them absent instead.
    const row = page.getByRole("listitem").filter({ hasText: "هم‌تیمی" });
    await row.getByRole("radio", { name: "غایب" }).click();
    await row.getByPlaceholder("اختیاری").fill("بیماری");

    await page.getByRole("button", { name: "ثبت حضور و غیاب" }).click();
    await expect(page.getByText("حضور و غیاب ثبت شد")).toBeVisible();

    // Reload: the register came from the server, not from local state.
    await page.reload();
    const savedRow = page.getByRole("listitem").filter({ hasText: "هم‌تیمی" });
    await expect(savedRow.getByRole("radio", { name: "غایب" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(savedRow.getByPlaceholder("اختیاری")).toHaveValue("بیماری");

    // Taking the register is the evidence the session happened.
    const session = await (
      await page.request.get(`/api/v1/training/sessions/${sessionId}`)
    ).json();
    expect(session.data.status).toBe("COMPLETED");
  });

  test("the register is refused before the session begins", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { teamId } = await createCoachWithSquad(mobile);
    const sessionId = await createTrainingSession({
      teamId,
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    await signIn(page, mobile);

    const refused = await page.request.put(
      `/api/v1/training/sessions/${sessionId}/attendance`,
      { data: { defaultStatus: "PRESENT", entries: [] } },
    );
    expect(refused.status()).toBe(422);
    expect((await refused.json()).error.code).toBe("VALIDATION_ERROR");

    // And the sheet on the page offers no controls for it.
    await page.goto(`/dashboard/training/sessions/${sessionId}`);
    await expect(page.getByRole("button", { name: "همه حاضر" })).toHaveCount(0);
  });

  /**
   * The line the module is drawn around: a parent learns that their own child
   * was absent, and nothing about anyone else's (docs/PRODUCT_SPEC.md §8).
   */
  test("a parent sees their child's row and never the sheet", async ({
    browser,
  }) => {
    const parentMobile = uniqueMobile();
    const { teamId, childId } = await createParentOfSquadPlayer(parentMobile);
    const sessionId = await createTrainingSession({
      teamId,
      startsAt: hoursAgo(2),
    });

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAs(adminPage, ["ADMIN"]);

    const saved = await adminPage.request.put(
      `/api/v1/training/sessions/${sessionId}/attendance`,
      {
        data: {
          defaultStatus: "PRESENT",
          entries: [
            { playerId: childId, status: "ABSENT", note: "سرماخوردگی" },
          ],
        },
      },
    );
    expect(saved.status(), await saved.text()).toBe(200);
    await adminContext.close();

    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    await signIn(parentPage, parentMobile);

    // The whole register is closed to them.
    const refused = await parentPage.request.get(
      `/api/v1/training/sessions/${sessionId}/attendance`,
    );
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe("OUT_OF_SCOPE");

    // Their own child's row is not.
    await parentPage.goto(`/dashboard/training/sessions/${sessionId}`);
    await expect(
      parentPage.getByRole("heading", { name: "حضور و غیاب" }),
    ).toBeVisible();
    await expect(parentPage.getByText("غایب")).toBeVisible();
    await expect(parentPage.getByText("سرماخوردگی")).toBeVisible();

    // No sheet, no controls.
    await expect(
      parentPage.getByRole("button", { name: "همه حاضر" }),
    ).toHaveCount(0);

    const own = await (
      await parentPage.request.get(`/api/v1/players/${childId}/attendance`)
    ).json();
    expect(own.data.totals.absent).toBe(1);
    expect(own.data.rate).toBe(0);

    await parentContext.close();
  });
});
