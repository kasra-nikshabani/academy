import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  getSessionRegister,
  saveAttendance,
} from "@/lib/services/attendance.service";
import { saveAttendanceSchema } from "@/lib/validation/attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** GET — the register: every squad member, marked or still pending. */
export const GET = apiHandler(async (_request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await getSessionRegister(caller, id));
});

/**
 * PUT — takes or corrects the register.
 *
 * `PUT` rather than `POST`: sending the same register twice leaves the same
 * result, and a coach on a phone at the side of a pitch will press it twice.
 */
export const PUT = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = saveAttendanceSchema.parse(await readJsonBody(request));
  return ok(await saveAttendance(caller, id, input));
});
