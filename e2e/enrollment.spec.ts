import { expect, test } from "@playwright/test";
import {
  createCoachWithSquad,
  createPlayerBornIn,
  removeMembership,
} from "./support/db";
import { signIn, signInAs, uniqueMobile } from "./support/sign-in";

test.describe("enrolment and squad scope", () => {
  /**
   * The step this phase exists for: a coach's reach now runs through
   * TeamMembership to the players in their squad — and stops there.
   */
  test("a coach reaches a player in their own squad", async ({ page }) => {
    const mobile = uniqueMobile();
    const { squadPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const response = await page.request.get(`/api/v1/players/${squadPlayerId}`);
    expect(response.status()).toBe(200);
  });

  test("a coach is refused a player from another squad", async ({ page }) => {
    const mobile = uniqueMobile();
    const { otherTeamPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const response = await page.request.get(
      `/api/v1/players/${otherTeamPlayerId}`,
    );

    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("OUT_OF_SCOPE");
  });

  test("another squad's player is absent from the coach's list", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { squadPlayerId, otherTeamPlayerId } =
      await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const body = await (
      await page.request.get("/api/v1/players?pageSize=100")
    ).json();
    const ids = body.data.map((player: { id: string }) => player.id);

    expect(ids).toContain(squadPlayerId);
    expect(ids).not.toContain(otherTeamPlayerId);
    expect(body.meta.total).toBe(body.data.length);
  });

  test("a coach sees their own team's roster page", async ({ page }) => {
    const mobile = uniqueMobile();
    const { teamId, squadPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    // Look the player's code up rather than matching on a first name — several
    // runs leave players sharing one, and the assertion would match many rows.
    const player = await (
      await page.request.get(`/api/v1/players/${squadPlayerId}`)
    ).json();

    await page.goto(`/dashboard/academy/teams/${teamId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText(player.data.playerCode, { exact: false }),
    ).toBeVisible();
  });

  test("a coach may not add a player to a squad", async ({ page }) => {
    const mobile = uniqueMobile();
    const { squadPlayerId, teamId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    // Moving players between squads is a manager's decision.
    const response = await page.request.post("/api/v1/memberships", {
      data: { playerId: squadPlayerId, teamId, isPrimary: true },
    });

    expect(response.status()).toBe(403);
  });

  test("an out-of-band birth year is refused with the allowed range", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);

    const teams = await (
      await page.request.get("/api/v1/teams?pageSize=50")
    ).json();
    const u14 = teams.data.find(
      (team: { ageGroup: { code: string } }) => team.ageGroup.code === "U14",
    );

    // Created here rather than hunted for among the seeded players: a test
    // that skips when it cannot find its fixture is not testing anything.
    const tooOld = await createPlayerBornIn(1388);

    const response = await page.request.post("/api/v1/memberships", {
      data: { playerId: tooOld, teamId: u14.id, isPrimary: false },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details?.allowed).toBeDefined();
  });

  test("an administrator may waive the age band", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);

    const teams = await (
      await page.request.get("/api/v1/teams?pageSize=50")
    ).json();
    const u14 = teams.data.find(
      (team: { ageGroup: { code: string } }) => team.ageGroup.code === "U14",
    );

    const tooOld = await createPlayerBornIn(1388);

    const response = await page.request.post("/api/v1/memberships", {
      data: {
        playerId: tooOld,
        teamId: u14.id,
        isPrimary: false,
        ageException: true,
      },
    });

    expect(response.status()).toBe(201);
    // The exception is recorded on the membership, not left to memory.
    expect((await response.json()).data.notes).toContain("استثنای رده سنی");

    // This test writes into a seeded squad, so it puts it back.
    await removeMembership(tooOld, u14.id);
  });
});
