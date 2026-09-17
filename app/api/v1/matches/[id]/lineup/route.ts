import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { saveLineup } from "@/lib/services/match.service";
import { saveLineupSchema } from "@/lib/validation/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * PUT — the whole team sheet.
 *
 * What is sent **is** the lineup; anyone left out is left out of the squad.
 * That is what redrawing a team sheet means, and it makes the request
 * idempotent: sending the same sheet twice leaves the same eleven.
 */
export const PUT = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = saveLineupSchema.parse(await readJsonBody(request));
  return ok(await saveLineup(caller, id, input));
});
