import { createHash } from "node:crypto";
import {
  generateOtpCode,
  hashOtpCode,
  otpExpiryDate,
  verifyOtpCode,
} from "@/lib/auth/otp";
import { createSessionToken } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { RateLimitError, UnauthenticatedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getSmsProvider } from "@/lib/sms";
import {
  consumeOtherActiveOtps,
  consumeOtpCode,
  countOtpsForIpSince,
  countOtpsSince,
  createOtpCode,
  findLatestActiveOtp,
  findLatestOtp,
  incrementOtpAttempts,
} from "@/lib/repositories/otp.repository";
import {
  findUserByMobile,
  markUserLoggedIn,
} from "@/lib/repositories/user.repository";
import { createTryoutVerificationToken } from "@/lib/auth/tryout-verification";
import type { OtpPurpose } from "@/lib/generated/prisma/enums";

const HOUR_MS = 60 * 60 * 1000;

export interface RequestOtpResult {
  /** Seconds before another code may be requested. */
  cooldownSeconds: number;
  /** Seconds before the code just issued expires. */
  expiresInSeconds: number;
}

export interface VerifyOtpResult {
  token: string;
  userId: string;
}

/** IP addresses identify a child's household; only a digest is ever stored. */
export function hashIp(ip: string | null): string | undefined {
  if (!ip) return undefined;
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Every rejected verification produces this same error.
 *
 * "No code was requested", "the code expired", "too many wrong guesses" and
 * "wrong code" are indistinguishable to the caller on purpose: telling them
 * apart would let someone enumerate which mobile numbers belong to academy
 * members (docs/SECURITY.md §4).
 */
function invalidCodeError(): UnauthenticatedError {
  return new UnauthenticatedError("کد تأیید نادرست یا منقضی شده است.");
}

async function assertWithinRateLimits(
  mobile: string,
  ipHash: string | undefined,
  purpose: OtpPurpose = "LOGIN",
): Promise<void> {
  const previous = await findLatestOtp(mobile, purpose);

  if (previous) {
    const elapsedSeconds = Math.floor(
      (Date.now() - previous.createdAt.getTime()) / 1000,
    );
    const remaining = env.OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;
    if (remaining > 0) {
      throw new RateLimitError(
        remaining,
        `تا ارسال مجدد کد ${remaining} ثانیه صبر کنید.`,
      );
    }
  }

  const since = new Date(Date.now() - HOUR_MS);

  if ((await countOtpsSince(mobile, since)) >= env.OTP_MAX_PER_HOUR) {
    throw new RateLimitError(
      HOUR_MS / 1000,
      "تعداد درخواست کد برای این شماره بیش از حد مجاز است. یک ساعت دیگر تلاش کنید.",
    );
  }

  if (
    ipHash &&
    (await countOtpsForIpSince(ipHash, since)) >= env.OTP_MAX_PER_IP_PER_HOUR
  ) {
    throw new RateLimitError(
      HOUR_MS / 1000,
      "تعداد درخواست‌ها بیش از حد مجاز است. بعداً تلاش کنید.",
    );
  }
}

/**
 * Issues a login code.
 *
 * The response is identical whether or not the number belongs to an account,
 * and a row is recorded either way. That second part matters: if rows were
 * only written for real accounts, an unknown number would never hit the rate
 * limit, and the difference in behaviour would itself reveal who is a member.
 * For an unknown number the stored hash is random, so no code can ever match
 * it, and no SMS is sent.
 */
export async function requestLoginOtp(
  mobile: string,
  ip: string | null,
): Promise<RequestOtpResult> {
  const ipHash = hashIp(ip);
  await assertWithinRateLimits(mobile, ipHash);

  const user = await findUserByMobile(mobile);
  const deliverable = user !== null && user.status === "ACTIVE";

  const code = deliverable ? generateOtpCode() : null;
  const expiresAt = otpExpiryDate();

  const record = await createOtpCode({
    mobile,
    purpose: "LOGIN",
    codeHash: code
      ? hashOtpCode(mobile, code)
      : // Unmatchable by construction: no six-digit input hashes to this.
        createHash("sha256").update(crypto.randomUUID()).digest("hex"),
    expiresAt,
    userId: user?.id,
    ipHash,
  });

  // Requesting a new code retires any earlier one, so only the most recent
  // code can ever be used.
  await consumeOtherActiveOtps(mobile, "LOGIN", record.id);

  if (deliverable && code) {
    await getSmsProvider().send({
      mobile,
      text: `کد ورود شما به آکادمی سپاهان: ${code}`,
    });
  } else {
    logger.info("otp requested for a number without an active account", {
      mobile,
    });
  }

  return {
    cooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    expiresInSeconds: env.OTP_TTL_SECONDS,
  };
}

/**
 * Checks a code and, on success, returns a signed session.
 *
 * A code is single-use: it is consumed before the session is issued, so the
 * same code cannot be replayed even if the response is lost in transit.
 */
export async function verifyLoginOtp(
  mobile: string,
  code: string,
): Promise<VerifyOtpResult> {
  const record = await findLatestActiveOtp(mobile, "LOGIN");

  if (!record) throw invalidCodeError();
  if (record.expiresAt.getTime() <= Date.now()) throw invalidCodeError();
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) throw invalidCodeError();

  if (!verifyOtpCode(mobile, code, record.codeHash)) {
    await incrementOtpAttempts(record.id);
    logger.warn("failed otp verification", { mobile, otpId: record.id });
    throw invalidCodeError();
  }

  await consumeOtpCode(record.id);

  // A code can exist without an account (see requestLoginOtp), but one can
  // never be matched, so reaching here without a user would be a bug.
  if (!record.userId) throw invalidCodeError();

  const user = await markUserLoggedIn(record.userId);
  if (user.status !== "ACTIVE") throw invalidCodeError();

  logger.info("user signed in", { userId: user.id });

  const token = await createSessionToken({ sub: user.id, mobile: user.mobile });
  return { token, userId: user.id };
}

// --- public tryout registration ---------------------------------------------

/**
 * Issues a code for public tryout registration.
 *
 * Unlike the login code, this one is **always** delivered. There is no
 * membership to protect here: anybody may register for a trial, so there is
 * nothing to learn from the fact that a code arrived. The rate limits still
 * apply, and they are counted separately from login so a family registering a
 * child does not lock themselves out of signing in.
 */
export async function requestTryoutOtp(
  mobile: string,
  ip: string | null,
): Promise<RequestOtpResult> {
  const ipHash = hashIp(ip);
  await assertWithinRateLimits(mobile, ipHash, "TRYOUT_REGISTRATION");

  const code = generateOtpCode();
  const record = await createOtpCode({
    mobile,
    purpose: "TRYOUT_REGISTRATION",
    codeHash: hashOtpCode(mobile, code),
    expiresAt: otpExpiryDate(),
    ipHash,
  });

  await consumeOtherActiveOtps(mobile, "TRYOUT_REGISTRATION", record.id);

  await getSmsProvider().send({
    mobile,
    text: `کد ثبت‌نام استعدادیابی سپاهان: ${code}`,
  });

  return {
    cooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    expiresInSeconds: env.OTP_TTL_SECONDS,
  };
}

/**
 * Checks a registration code and returns proof the number is held.
 *
 * The token it returns is the only thing the application submission trusts
 * about the applicant, which is why it is signed rather than merely stored
 * (lib/auth/tryout-verification.ts).
 */
export async function verifyTryoutOtp(
  mobile: string,
  code: string,
): Promise<string> {
  const record = await findLatestActiveOtp(mobile, "TRYOUT_REGISTRATION");

  if (!record) throw invalidCodeError();
  if (record.expiresAt.getTime() <= Date.now()) throw invalidCodeError();
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) throw invalidCodeError();

  if (!verifyOtpCode(mobile, code, record.codeHash)) {
    await incrementOtpAttempts(record.id);
    logger.warn("failed tryout otp verification", { mobile, otpId: record.id });
    throw invalidCodeError();
  }

  await consumeOtpCode(record.id);
  logger.info("tryout registration mobile verified", { mobile });

  return createTryoutVerificationToken(mobile);
}
