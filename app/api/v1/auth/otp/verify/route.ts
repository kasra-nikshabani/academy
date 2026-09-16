import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { setSessionCookie } from "@/lib/auth";
import { clearPendingLoginMobile } from "@/lib/auth/pending-login";
import { verifyLoginOtp } from "@/lib/services/auth.service";
import { verifyOtpSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/otp/verify
 *
 * On success the session is set as an httpOnly cookie; the token itself is
 * never in the response body, so no script can read it.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { mobile, code } = verifyOtpSchema.parse(await readJsonBody(request));
  const { token, userId } = await verifyLoginOtp(mobile, code);

  await setSessionCookie(token);
  await clearPendingLoginMobile();

  return ok({ userId });
});
