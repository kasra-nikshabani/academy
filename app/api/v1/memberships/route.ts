import type { NextRequest } from "next/server";
import { apiHandler, created } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { addPlayerToTeam } from "@/lib/services/enrollment.service";
import { createMembershipSchema } from "@/lib/validation/enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/memberships — adds a player to a squad. */
export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createMembershipSchema.parse(await readJsonBody(request));
  return created(await addPlayerToTeam(caller, input));
});
