import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { saveMatchStats } from "@/lib/services/match.service";
import { saveStatsSchema } from "@/lib/validation/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** PUT — what each named player did. Only players on the team sheet. */
export const PUT = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = saveStatsSchema.parse(await readJsonBody(request));
  return ok(await saveMatchStats(caller, id, input));
});
