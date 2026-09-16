import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { decideApplication } from "@/lib/services/tryout.service";
import { decisionSchema } from "@/lib/validation/tryout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * POST — the final decision, and the transaction BUSINESS_RULES §3 is about.
 *
 * `POST` rather than `PATCH`: a decision is made once. A second attempt is
 * refused rather than quietly overwriting the first.
 */
export const POST = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = decisionSchema.parse(await readJsonBody(request));
  return ok(await decideApplication(caller, id, input));
});
