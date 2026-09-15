import type { NextRequest } from "next/server";
import { apiHandler, created, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  assignStaffToTeam,
  unassignStaffFromTeam,
} from "@/lib/services/people.service";
import { assignStaffTeamSchema } from "@/lib/validation/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/staff/:id/teams — assigns a team.
 *
 * This is the write that grants a coach access to a team, so it needs
 * `staff:write`: a coach must not be able to widen their own reach.
 */
export const POST = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = assignStaffTeamSchema.parse(await request.json());
  return created(await assignStaffToTeam(caller, id, input));
});

/** DELETE ends the assignment; the row stays as history. */
export const DELETE = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const teamId = new URL(request.url).searchParams.get("teamId");
  if (!teamId) throw new Error("teamId is required");

  return ok(await unassignStaffFromTeam(caller, id, teamId));
});
