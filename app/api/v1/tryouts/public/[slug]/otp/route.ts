import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { getClientIp, readJsonBody } from "@/lib/api/request";
import { requestTryoutOtp } from "@/lib/services/auth.service";
import {
  getPublicTryout,
  registrationWindow,
} from "@/lib/services/tryout.service";
import { ConflictError } from "@/lib/errors";
import { tryoutOtpRequestSchema } from "@/lib/validation/tryout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

/**
 * POST — sends a registration code. **Public: no session required.**
 *
 * The trial's window is checked before a code is sent, so a closed trial does
 * not spend an SMS on a registration that cannot be finished.
 */
export const POST = apiHandler(async (request: NextRequest, ctx: Context) => {
  const { slug } = await ctx.params;
  const tryout = await getPublicTryout(slug);

  const window = registrationWindow(tryout);
  if (!window.open) throw new ConflictError(window.reason);

  const { mobile } = tryoutOtpRequestSchema.parse(await readJsonBody(request));
  const result = await requestTryoutOtp(mobile, getClientIp(request));

  return ok(result);
});
