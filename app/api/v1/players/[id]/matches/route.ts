import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getPlayerMatchRecord } from "@/lib/services/match.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/players/:id/matches — one player's own match record.
 *
 * Narrowed by player scope, not team scope: this is the endpoint a parent
 * reads, and it never returns another child's line.
 */
export const GET = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const seasonId =
    new URL(request.url).searchParams.get("seasonId") ?? undefined;

  return ok(await getPlayerMatchRecord(caller, id, { seasonId }));
});
