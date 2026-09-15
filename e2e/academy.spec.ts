import { expect, test } from "@playwright/test";
import { signInAs } from "./support/sign-in";

test.describe("academy structure", () => {
  test("an administrator can walk the whole structure", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);

    for (const [label, heading] of [
      ["رشته‌ها", "رشته‌های ورزشی"],
      ["رده‌های سنی", "رده‌های سنی"],
      ["فصل‌ها", "فصل‌ها"],
      ["مدارس", "مدارس ورزشی"],
      ["تیم‌ها", "تیم‌ها"],
    ] as const) {
      await page.getByRole("link", { name: label }).click();
      await expect(
        page.getByRole("heading", { name: heading, level: 1 }),
      ).toBeVisible();
    }
  });

  test("only the current section is marked in the sidebar", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);
    await page.goto("/dashboard/academy/teams");

    const current = page.locator(
      'nav[aria-label="منوی اصلی"] [aria-current="page"]',
    );
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText("تیم‌ها");
  });

  test("teams show the band and the birth years it admits", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);
    await page.goto("/dashboard/academy/teams");

    const row = page.getByRole("row").filter({ hasText: "U14" }).first();
    await expect(row).toBeVisible();
    // Derived from the active season, not stored on the row.
    await expect(row).toContainText("متولد");
  });

  test("a coach may read the structure", async ({ page }) => {
    await signInAs(page, ["STAFF"]);
    await page.goto("/dashboard/academy/teams");

    await expect(
      page.getByRole("heading", { name: "تیم‌ها", level: 1 }),
    ).toBeVisible();
  });

  test("a coach may not create a team", async ({ page }) => {
    await signInAs(page, ["STAFF"]);

    const response = await page.request.post("/api/v1/teams", {
      data: {
        sportId: "any",
        ageGroupId: "any",
        slug: "should-not-exist",
        name: "تیم غیرمجاز",
      },
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  test("an administrator creating a duplicate slug gets a conflict, not a 500", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);

    const slug = `e2e-sport-${Date.now()}`;
    const first = await page.request.post("/api/v1/sports", {
      data: { slug, name: "رشته آزمایشی" },
    });
    expect(first.status()).toBe(201);

    const second = await page.request.post("/api/v1/sports", {
      data: { slug, name: "رشته تکراری" },
    });
    expect(second.status()).toBe(409);
    expect((await second.json()).error.code).toBe("CONFLICT");
  });

  test("an invalid age band is refused with field details", async ({
    page,
  }) => {
    await signInAs(page, ["ADMIN"]);

    const sports = await (await page.request.get("/api/v1/sports")).json();

    const response = await page.request.post("/api/v1/age-groups", {
      data: {
        sportId: sports.data[0].id,
        code: "BAD",
        name: "نامعتبر",
        minAge: 18,
        maxAge: 12,
      },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details?.[0]?.field).toBe("minAge");
  });

  test("teams are paginated", async ({ page }) => {
    await signInAs(page, ["ADMIN"]);

    const response = await page.request.get("/api/v1/teams?page=1&pageSize=2");
    const body = await response.json();

    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 2 });
  });
});
