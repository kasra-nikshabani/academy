import type { Page } from "@playwright/test";
import { hashOtpCode } from "../../lib/auth/otp";
import { createUserWithRoles, plantCodeHash, resetUser } from "./db";

const KNOWN_CODE = "424242";

/** A stable, unique source address per test account. */
function ipFor(mobile: string): string {
  const tail = Number(mobile.slice(-6));
  return `10.${(tail >> 16) & 0xff}.${(tail >> 8) & 0xff}.${tail & 0xff}`;
}

/**
 * Signs in through the real UI.
 *
 * The code is hashed before storage and never returned by the API, so the test
 * plants a known hash onto the pending row. Everything else — both endpoints,
 * the cookie, the redirect — runs for real.
 */
export async function signIn(page: Page, mobile: string): Promise<void> {
  await resetUser(mobile);

  // Every test otherwise arrives from localhost, so they share one source and
  // collectively trip the per-IP limiter. Giving each its own address keeps the
  // limiter under test rather than switching it off.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ipFor(mobile) });

  await page.goto("/login");
  await page.getByLabel("شماره موبایل").fill(mobile);
  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
  await page.getByRole("heading", { name: "کد تأیید" }).waitFor();

  await plantCodeHash(mobile, hashOtpCode(mobile, KNOWN_CODE));

  await page.getByLabel("کد تأیید").fill(KNOWN_CODE);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
}

let counter = 0;

/**
 * A unique, well-formed test mobile: `09` plus nine digits.
 *
 * Built here rather than inline in each test — hand-assembled numbers came out
 * ten digits long and were rejected by the form, which looks exactly like a
 * broken page.
 */
export function uniqueMobile(): string {
  counter += 1;
  const digits = `${process.pid % 100000}${counter}`.padStart(9, "0").slice(-9);
  return `09${digits}`;
}

/**
 * A fresh account with the given roles, signed in.
 *
 * Returns the mobile number so a test can reuse it. Each call gets its own
 * number: OTP rate limits are per number, and sharing one across parallel
 * workers puts them into each other's cooldown.
 */
export async function signInAs(
  page: Page,
  roles: readonly string[],
): Promise<string> {
  const mobile = uniqueMobile();

  await createUserWithRoles(mobile, roles);
  await signIn(page, mobile);
  return mobile;
}
