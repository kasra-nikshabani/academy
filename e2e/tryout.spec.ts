import { expect, test, type Page } from "@playwright/test";
import { hashOtpCode } from "../lib/auth/otp";
import { signInAs, uniqueMobile } from "./support/sign-in";
import {
  createTryout,
  findApplicationByTrackingCode,
  plantCodeHash,
  testNationalCode,
} from "./support/db";

const KNOWN_CODE = "424242";

/**
 * Fills in the public registration form and returns the tracking code.
 *
 * Everything runs for real — both OTP endpoints, the signed verification
 * cookie, the submission — except that the code is planted, because the real
 * one is hashed before storage and never returned by the API.
 */
async function registerThroughTheForm(
  page: Page,
  slug: string,
  mobile: string,
  nationalCode: string,
  lastName: string,
): Promise<string> {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.99.${process.pid % 255}.${Math.floor(Math.random() * 255)}`,
  });
  await page.goto(`/tryouts/${slug}`);

  await page.getByLabel("شماره موبایل").fill(mobile);
  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();

  await page.getByLabel("کد تأیید").waitFor();
  await plantCodeHash(mobile, hashOtpCode(mobile, KNOWN_CODE));
  await page.getByLabel("کد تأیید").fill(KNOWN_CODE);
  await page.getByRole("button", { name: "تأیید شماره" }).click();

  await page.getByLabel("نام", { exact: true }).waitFor();
  await page.getByLabel("نام", { exact: true }).fill("داوطلب");
  await page.getByLabel("نام خانوادگی", { exact: true }).fill(lastName);
  await page.getByLabel("کد ملی").fill(nationalCode);

  // 1392 sits inside U14 for the seeded 1405 season. The calendar's day cells
  // are named by their full Jalali date, so one is picked by that.
  await page.getByLabel("تاریخ تولد").click();
  await page.getByLabel("سال").selectOption("1392");
  await page.getByLabel("ماه", { exact: true }).selectOption("5");
  await page.getByRole("button", { name: /۱۵ مرداد ۱۳۹۲/ }).click();

  // A 13-year-old: the guardian block appears from the date of birth alone.
  await expect(page.getByLabel("نام ولی")).toBeVisible();
  await page.getByLabel("نام ولی").fill("ولی");
  await page.getByLabel("نام خانوادگی ولی").fill(lastName);

  await page.getByRole("button", { name: "ثبت درخواست" }).click();
  await expect(page.getByText("درخواست شما ثبت شد")).toBeVisible();

  const code = await page.locator("bdi.font-mono").first().innerText();
  return code.trim();
}

test.describe("public tryout registration", () => {
  /** The mandatory scenario: a stranger registers a child for a trial. */
  test("a visitor registers and is given a tracking code", async ({ page }) => {
    const { slug } = await createTryout({});
    const mobile = uniqueMobile();
    const nationalCode = testNationalCode();

    const trackingCode = await registerThroughTheForm(
      page,
      slug,
      mobile,
      nationalCode,
      `ثبت${Date.now() % 10000}`,
    );

    expect(trackingCode).toMatch(/^SEP-T-[0-9A-Z]{8}$/);

    const application = await findApplicationByTrackingCode(trackingCode);
    expect(application?.status).toBe("SUBMITTED");
  });

  test("the tracking code needs the number that made it", async ({ page }) => {
    const { slug } = await createTryout({});
    const mobile = uniqueMobile();

    const trackingCode = await registerThroughTheForm(
      page,
      slug,
      mobile,
      testNationalCode(),
      `پیگیری${Date.now() % 10000}`,
    );

    await page.goto("/tryouts/status");
    await page.getByLabel("کد پیگیری").fill(trackingCode);
    await page.getByLabel("شماره موبایل").fill(mobile);
    await page.getByRole("button", { name: "مشاهده وضعیت" }).click();
    await expect(page.getByText("ثبت‌شده")).toBeVisible();

    // The same code with someone else's number tells them nothing.
    await page.getByLabel("شماره موبایل").fill("09129999999");
    await page.getByRole("button", { name: "مشاهده وضعیت" }).click();
    await expect(
      page.getByText("درخواستی با این کد پیگیری و شماره موبایل یافت نشد"),
    ).toBeVisible();
  });

  test("submitting without verifying the number is refused", async ({
    page,
  }) => {
    const { slug } = await createTryout({});
    await page.goto(`/tryouts/${slug}`);

    const refused = await page.request.post(
      `/api/v1/tryouts/public/${slug}/applications`,
      {
        data: {
          firstName: "بدون",
          lastName: "تأیید",
          nationalCode: testNationalCode(),
          dateOfBirth: "2013-08-15T09:00:00.000Z",
          gender: "MALE",
        },
      },
    );

    expect(refused.status()).toBe(401);
  });

  test("a closed trial shows no form", async ({ page }) => {
    const { slug } = await createTryout({
      status: "CLOSED",
      closesAt: new Date(Date.now() - 86400000),
    });

    await page.goto(`/tryouts/${slug}`);
    await expect(page.getByText("ثبت‌نام این دوره باز نیست")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "دریافت کد تأیید" }),
    ).toHaveCount(0);
  });
});

test.describe("screening and the acceptance transaction", () => {
  /**
   * The second mandatory scenario. Acceptance must leave the application
   * accepted, the player in a squad and the timeline written — or none of it
   * (docs/BUSINESS_RULES.md §3).
   */
  test("an accepted applicant lands in the squad with a timeline entry", async ({
    browser,
  }) => {
    const { id: tryoutId, slug } = await createTryout({});
    const mobile = uniqueMobile();

    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    const trackingCode = await registerThroughTheForm(
      visitorPage,
      slug,
      mobile,
      testNationalCode(),
      `پذیرش${Date.now() % 10000}`,
    );
    await visitorContext.close();

    const application = await findApplicationByTrackingCode(trackingCode);
    expect(application).not.toBeNull();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signInAs(adminPage, ["ADMIN"]);

    await adminPage.goto(`/dashboard/tryouts/${tryoutId}`);
    await expect(adminPage.getByText(trackingCode)).toBeVisible();

    // Screening first: passing the paperwork is not being accepted.
    await adminPage.getByRole("button", { name: "تأیید غربالگری" }).click();
    await expect(adminPage.getByText("غربالگری تأیید شد")).toBeVisible();

    await adminPage.getByRole("button", { name: "پذیرش", exact: true }).click();
    await expect(adminPage.getByText("بازیکن پذیرفته شد")).toBeVisible();

    const decided = await findApplicationByTrackingCode(trackingCode);
    expect(decided?.status).toBe("ACCEPTED");

    // The squad place and the timeline entry that had to come with it.
    const memberships = await (
      await adminPage.request.get(
        `/api/v1/players/${application!.playerId}/memberships`,
      )
    ).json();
    expect(memberships.data.length).toBeGreaterThan(0);

    const journey = await (
      await adminPage.request.get(
        `/api/v1/players/${application!.playerId}/journey`,
      )
    ).json();
    expect(journey.data[0].type).toBe("TRYOUT_ACCEPTED");

    await adminContext.close();
  });
});
