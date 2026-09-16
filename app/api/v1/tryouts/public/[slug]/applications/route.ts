import type { NextRequest } from "next/server";
import { apiHandler, created } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import {
  clearTryoutVerificationCookie,
  readVerifiedTryoutMobile,
} from "@/lib/auth";
import { UnauthenticatedError } from "@/lib/errors";
import { submitTryoutApplication } from "@/lib/services/tryout.service";
import { submitApplicationSchema } from "@/lib/validation/tryout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

/**
 * POST — submits an application. **Public, but the number must be verified.**
 *
 * The mobile comes from the signed cookie and never from the body: the OTP
 * step exists precisely so the number is the one fact the server knows, and
 * reading it from the payload would hand that back to the client.
 */
export const POST = apiHandler(async (request: NextRequest, ctx: Context) => {
  const { slug } = await ctx.params;

  const verifiedMobile = await readVerifiedTryoutMobile();
  if (!verifiedMobile) {
    throw new UnauthenticatedError(
      "ابتدا شماره موبایل خود را با کد تأیید، تأیید کنید.",
    );
  }

  const input = submitApplicationSchema.parse(await readJsonBody(request));
  const result = await submitTryoutApplication(slug, verifiedMobile, input);

  // The proof is spent: one verification, one application.
  await clearTryoutVerificationCookie();

  return created(result);
});
