import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { activateSeason, updateSeason } from "@/lib/services/academy.service";
import { updateSeasonSchema } from "@/lib/validation/academy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const PATCH = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = updateSeasonSchema.parse(await readJsonBody(request));

  // `?activate=true` is the explicit "make this the current season" action,
  // which closes any other active season in the same transaction.
  if (new URL(request.url).searchParams.get("activate") === "true") {
    return ok(await activateSeason(caller, id));
  }

  return ok(await updateSeason(caller, id, input));
});
