import { expect, test } from "@playwright/test";
import { signIn, uniqueMobile } from "./support/sign-in";
import { assignEvaluation, createCoachWithSquad } from "./support/db";
import { getJsonOrNull } from "./support/api";

test.describe("evaluation", () => {
  /**
   * The design this phase is built around: a coach holds no `tryout:*`
   * permission at all, and still gets to assess the player — because the
   * evaluation was handed to them (docs/BUSINESS_RULES.md §16).
   */
  test("a coach fills in an assignment they could not otherwise reach", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { staffId, otherTeamPlayerId } = await createCoachWithSquad(mobile);

    // A player in a team this coach is not assigned to: out of their scope.
    const evaluation = await assignEvaluation({
      playerId: otherTeamPlayerId,
      evaluatorStaffId: staffId,
    });

    await signIn(page, mobile);

    // The talent pipeline itself stays closed to them.
    const tryouts = await page.request.get("/api/v1/tryouts");
    expect(tryouts.status()).toBe(403);

    // The assignment does not.
    await page.goto("/dashboard/evaluations");
    await expect(
      page.getByRole("heading", { name: "ارزیابی‌ها" }),
    ).toBeVisible();

    await page.goto(`/dashboard/evaluations/${evaluation.id}`);
    await expect(page.getByText("در انتظار تکمیل")).toBeVisible();

    // Mark every criterion, then finish.
    for (const [index, criterion] of evaluation.criteria.entries()) {
      const field = page.getByRole("spinbutton").nth(index);
      await field.fill(String(criterion.maxScore));
    }

    await page.getByRole("button", { name: "ثبت نهایی ارزیابی" }).click();
    await expect(page.getByText("ارزیابی ثبت نهایی شد")).toBeVisible();

    /**
     * Polled, and the transport error turned into a value.
     *
     * The dev server Playwright runs is Turbopack under several workers, and
     * it occasionally resets a keep-alive connection while recompiling. A
     * thrown `ECONNRESET` **aborts** `expect.poll` rather than retrying it, so
     * `getJsonOrNull` returns null instead and the poll goes round again
     * (docs/PROJECT_RULES.md §6.1).
     */
    await expect
      .poll(
        async () => {
          const body = (await getJsonOrNull(
            page,
            `/api/v1/evaluations/${evaluation.id}`,
          )) as { data?: { status?: string; overallScore?: number } } | null;

          return body?.data
            ? {
                status: body.data.status,
                overallScore: body.data.overallScore,
              }
            : null;
        },
        { timeout: 15_000 },
      )
      .toEqual({ status: "SUBMITTED", overallScore: 10 });
  });

  test("a submitted evaluation stops accepting marks", async ({ page }) => {
    const mobile = uniqueMobile();
    const { staffId, squadPlayerId } = await createCoachWithSquad(mobile);
    const evaluation = await assignEvaluation({
      playerId: squadPlayerId,
      evaluatorStaffId: staffId,
    });

    await signIn(page, mobile);

    const marks = evaluation.criteria.map((criterion) => ({
      criterionId: criterion.id,
      score: criterion.maxScore,
    }));

    const submitted = await page.request.put(
      `/api/v1/evaluations/${evaluation.id}`,
      { data: { scores: marks, recommendation: "ACCEPT", submit: true } },
    );
    expect(submitted.status(), await submitted.text()).toBe(200);

    const again = await page.request.put(
      `/api/v1/evaluations/${evaluation.id}`,
      { data: { scores: [{ ...marks[0]!, score: 1 }], submit: false } },
    );
    expect(again.status()).toBe(409);

    // And the page shows it as a record rather than a form.
    await page.goto(`/dashboard/evaluations/${evaluation.id}`);
    await expect(page.getByText("ثبت نهایی شد")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ثبت نهایی ارزیابی" }),
    ).toHaveCount(0);
  });

  test("finishing needs every criterion marked", async ({ page }) => {
    const mobile = uniqueMobile();
    const { staffId, squadPlayerId } = await createCoachWithSquad(mobile);
    const evaluation = await assignEvaluation({
      playerId: squadPlayerId,
      evaluatorStaffId: staffId,
    });

    await signIn(page, mobile);

    const partial = await page.request.put(
      `/api/v1/evaluations/${evaluation.id}`,
      {
        data: {
          scores: evaluation.criteria.slice(0, 2).map((criterion) => ({
            criterionId: criterion.id,
            score: criterion.maxScore,
          })),
          submit: true,
        },
      },
    );

    expect(partial.status()).toBe(422);
    expect((await partial.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("a coach cannot hand themselves a player they cannot see", async ({
    page,
  }) => {
    const mobile = uniqueMobile();
    const { otherTeamPlayerId } = await createCoachWithSquad(mobile);
    await signIn(page, mobile);

    const templates = await (
      await page.request.get("/api/v1/evaluations/templates")
    ).json();

    const refused = await page.request.post("/api/v1/evaluations", {
      data: {
        playerId: otherTeamPlayerId,
        templateId: templates.data[0].id,
        evaluatorId: "any",
      },
    });

    expect(refused.status()).toBe(422);
  });
});
