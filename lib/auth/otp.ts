import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const OTP_LENGTH = 6;

/**
 * A cryptographically random six-digit code.
 *
 * `randomInt` is used rather than `Math.random`: an OTP guessable from a
 * predictable PRNG is not an OTP. Leading zeros are preserved by padding, so
 * `000123` stays a valid six-digit code rather than becoming `123`.
 */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/**
 * HMAC-SHA256 of the code, keyed with AUTH_SECRET and bound to the mobile
 * number.
 *
 * A plain hash of a six-digit code is worthless — an attacker with the
 * database tries all 10^6 inputs instantly. Keying with a server-side secret
 * means a database leak alone reveals nothing, and mixing in the mobile number
 * stops a code captured for one number from being replayed against another.
 */
export function hashOtpCode(mobile: string, code: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${mobile}:${code}`)
    .digest("hex");
}

/** Constant-time comparison, so response timing cannot leak a partial match. */
export function verifyOtpCode(
  mobile: string,
  code: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashOtpCode(mobile, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function otpExpiryDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + env.OTP_TTL_SECONDS * 1000);
}
