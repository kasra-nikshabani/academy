import { expect, test } from "@playwright/test";
import { hashOtpCode } from "../lib/auth/otp";
import { plantCodeHash, removeUser, resetUser } from "./support/db";

async function plantKnownCode(mobile: string, code: string): Promise<void> {
  await plantCodeHash(mobile, hashOtpCode(mobile, code));
}

const freshUser = resetUser;

test.describe("authentication", () => {
  test("a member signs in with a code and reaches the dashboard", async ({
    page,
  }) => {
    const mobile = "09121110001";
    await freshUser(mobile);

    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "ورود به سامانه" }),
    ).toBeVisible();

    await page.getByLabel("شماره موبایل").fill(mobile);
    await page.getByRole("button", { name: "دریافت کد تأیید" }).click();

    await expect(page.getByRole("heading", { name: "کد تأیید" })).toBeVisible();
    // The number must never appear in the URL.
    expect(page.url()).not.toContain(mobile);

    await plantKnownCode(mobile, "424242");
    await page.getByLabel("کد تأیید").fill("424242");
    await page.getByRole("button", { name: "ورود", exact: true }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: "خوش آمدید" }),
    ).toBeVisible();
  });

  test("a wrong code is rejected and the user stays put", async ({ page }) => {
    const mobile = "09121110002";
    await freshUser(mobile);

    await page.goto("/login");
    await page.getByLabel("شماره موبایل").fill(mobile);
    await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
    await expect(page.getByRole("heading", { name: "کد تأیید" })).toBeVisible();

    await plantKnownCode(mobile, "424242");
    await page.getByLabel("کد تأیید").fill("999999");
    await page.getByRole("button", { name: "ورود", exact: true }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("an unknown number reaches the code step exactly like a member", async ({
    page,
  }) => {
    const mobile = "09129998887";
    await removeUser(mobile);

    await page.goto("/login");
    await page.getByLabel("شماره موبایل").fill(mobile);
    await page.getByRole("button", { name: "دریافت کد تأیید" }).click();

    // Identical journey — nothing here reveals that the number has no account.
    await expect(page.getByRole("heading", { name: "کد تأیید" })).toBeVisible();
  });

  test("an invalid number is rejected in the form", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("شماره موبایل").fill("12345");
    await page.getByRole("button", { name: "دریافت کد تأیید" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "کد تأیید" })).toBeHidden();
  });

  test("the dashboard is closed to anonymous visitors", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/api/v1/me refuses an anonymous caller", async ({ request }) => {
    const response = await request.get("/api/v1/me");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  test("signing out ends the session", async ({ page }) => {
    const mobile = "09121110003";
    await freshUser(mobile);

    await page.goto("/login");
    await page.getByLabel("شماره موبایل").fill(mobile);
    await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
    await expect(page.getByRole("heading", { name: "کد تأیید" })).toBeVisible();

    await plantKnownCode(mobile, "424242");
    await page.getByLabel("کد تأیید").fill("424242");
    await page.getByRole("button", { name: "ورود", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: "خروج" }).click();
    await expect(page).toHaveURL(/\/login/);

    // And the protected page stays closed afterwards.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
