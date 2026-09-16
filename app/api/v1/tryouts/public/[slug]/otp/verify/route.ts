import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { setTryoutVerificationCookie } from "@/lib/auth";
import { verifyTryoutOtp } from "@/lib/services/auth.service";
import { tryoutOtpVerifySchema } from "@/lib/validation/tryout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — checks the code and remembers the verified number. **Public.**
 *
 * The proof goes back as an httpOnly signed cookie rather than to the client,
 * so the page never holds a token it could leak.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const input = tryoutOtpVerifySchema.parse(await readJsonBody(request));
  const token = await verifyTryoutOtp(input.mobile, input.code);
  await setTryoutVerificationCookie(token);

  return ok({ verified: true });
});
