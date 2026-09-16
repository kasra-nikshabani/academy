import { expect, test } from "@playwright/test";
import { signInAs } from "./support/sign-in";
import { removePlayer } from "./support/db";

test.describe("player journey", () => {
  test("a new player's timeline starts with their registration", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);

    const created = await page.request.post("/api/v1/players", {
      data: {
        firstName: "مسیر",
        lastName: `آزمون${Date.now() % 100000}`,
        dateOfBirth: "2013-08-15T09:00:00.000Z",
      },
    });
    expect(created.status()).toBe(201);
    const player = (await created.json()).data;

    const journey = await (
      await page.request.get(`/api/v1/players/${player.id}/journey`)
    ).json();

    expect(journey.data).toHaveLength(1);
    expect(journey.data[0].type).toBe("REGISTERED");
    expect(journey.data[0].meta.label).toBe("ثبت‌نام در آکادمی");

    await removePlayer(player.id);
  });

  test("joining a team adds an entry, and the page shows it", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);

    const created = await page.request.post("/api/v1/players", {
      data: {
        firstName: "مسیر",
        lastName: `تیمی${Date.now() % 100000}`,
        dateOfBirth: "2013-08-15T09:00:00.000Z",
      },
    });
    const player = (await created.json()).data;

    const teams = await (
      await page.request.get("/api/v1/teams?pageSize=50")
    ).json();
    const u14 = teams.data.find(
      (team: { ageGroup: { code: string } }) => team.ageGroup.code === "U14",
    );

    const joined = await page.request.post("/api/v1/memberships", {
      data: { playerId: player.id, teamId: u14.id, isPrimary: true },
    });
    expect(joined.status()).toBe(201);

    const journey = await (
      await page.request.get(`/api/v1/players/${player.id}/journey`)
    ).json();

    expect(journey.data[0].type).toBe("TEAM_JOINED");
    expect(journey.data.map((e: { type: string }) => e.type)).toContain(
      "REGISTERED",
    );

    await page.goto(`/dashboard/people/players/${player.id}`);
    await expect(
      page.getByRole("heading", { name: "مسیر بازیکن" }),
    ).toBeVisible();
    await expect(page.getByText("ثبت‌نام در آکادمی")).toBeVisible();

    await removePlayer(player.id);
  });

  /**
   * The transaction doing its job: a refused write must leave no trace on a
   * timeline that can never be corrected by deletion.
   */
  test("a refused membership leaves no entry behind", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);

    const created = await page.request.post("/api/v1/players", {
      data: {
        firstName: "مسیر",
        lastName: `ردشده${Date.now() % 100000}`,
        // Too old for U14.
        dateOfBirth: "2009-08-15T09:00:00.000Z",
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const player = (await created.json()).data;

    const teams = await (
      await page.request.get("/api/v1/teams?pageSize=50")
    ).json();
    const u14 = teams.data.find(
      (team: { ageGroup: { code: string } }) => team.ageGroup.code === "U14",
    );

    const refused = await page.request.post("/api/v1/memberships", {
      data: { playerId: player.id, teamId: u14.id, isPrimary: true },
    });
    expect(refused.status()).toBe(422);

    const journey = await (
      await page.request.get(`/api/v1/players/${player.id}/journey`)
    ).json();

    // Only the registration — nothing about a team.
    expect(journey.data).toHaveLength(1);
    expect(journey.data[0].type).toBe("REGISTERED");

    await removePlayer(player.id);
  });

  test("a parent is refused another family's timeline", async ({ browser }) => {
    // Two sessions, so neither sign-in lands on an already-signed-in page.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAs(adminPage, ["ADMIN"]);

    const created = await adminPage.request.post("/api/v1/players", {
      data: {
        firstName: "مسیر",
        lastName: `خصوصی${Date.now() % 100000}`,
        dateOfBirth: "2013-08-15T09:00:00.000Z",
      },
    });
    const strangerId = (await created.json()).data.id;
    await adminContext.close();

    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    await signInAs(parentPage, ["PARENT"]);

    const response = await parentPage.request.get(
      `/api/v1/players/${strangerId}/journey`,
    );
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("OUT_OF_SCOPE");

    await parentContext.close();
    await removePlayer(strangerId);
  });
});
