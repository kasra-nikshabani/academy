import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { updateEnrollmentStatus } from "@/lib/services/enrollment.service";
import { updateEnrollmentSchema } from "@/lib/validation/enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/enrollments/:id
 *
 * The only way a school enrolment ends. Joining a team never touches it
 * (BUSINESS_RULES §2).
 */
export const PATCH = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = updateEnrollmentSchema.parse(await readJsonBody(request));
  return ok(await updateEnrollmentStatus(caller, id, input));
});
