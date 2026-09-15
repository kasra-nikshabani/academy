import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { getClientIp } from "@/lib/api/request";
import { setPendingLoginMobile } from "@/lib/auth/pending-login";
import { requestLoginOtp } from "@/lib/services/auth.service";
import { requestOtpSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/otp/send
 *
 * Answers the same way whether or not the number has an account — see
 * requestLoginOtp. The code is never part of the response.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { mobile } = requestOtpSchema.parse(await request.json());
  const result = await requestLoginOtp(mobile, getClientIp(request));

  // Lets /verify know which number is pending without putting it in the URL.
  await setPendingLoginMobile(mobile);

  return ok({
    sent: true,
    cooldownSeconds: result.cooldownSeconds,
    expiresInSeconds: result.expiresInSeconds,
  });
});
