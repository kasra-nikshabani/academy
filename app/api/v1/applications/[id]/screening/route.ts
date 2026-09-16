import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { recordScreening } from "@/lib/services/tryout.service";
import { screeningSchema } from "@/lib/validation/tryout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** PUT — the paperwork check. Idempotent: the same verdict twice is the same. */
export const PUT = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = screeningSchema.parse(await readJsonBody(request));
  return ok(await recordScreening(caller, id, input));
});
