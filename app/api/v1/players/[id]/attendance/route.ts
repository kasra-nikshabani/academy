import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getPlayerRegister } from "@/lib/services/attendance.service";
import { playerAttendanceQuerySchema } from "@/lib/validation/attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/players/:id/attendance — one player's own register.
 *
 * Narrowed by player scope, not team scope. This is the endpoint a parent
 * reads; it never returns another child's row.
 */
export const GET = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const filters = playerAttendanceQuerySchema.parse({
    seasonId: params.get("seasonId") ?? undefined,
    teamId: params.get("teamId") ?? undefined,
  });

  return ok(await getPlayerRegister(caller, id, filters));
});
