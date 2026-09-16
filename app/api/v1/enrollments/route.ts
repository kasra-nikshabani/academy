import type { NextRequest } from "next/server";
import { apiHandler, created, okPaginated, parsePagination } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  enrollPlayerInSchool,
  listEnrollments,
} from "@/lib/services/enrollment.service";
import { createEnrollmentSchema } from "@/lib/validation/enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;

  const { items, meta } = await listEnrollments(
    caller,
    parsePagination(params),
    {
      schoolId: params.get("schoolId") ?? undefined,
      seasonId: params.get("seasonId") ?? undefined,
      status: params.get("status") ?? undefined,
    },
  );

  return okPaginated(items, meta);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createEnrollmentSchema.parse(await readJsonBody(request));
  return created(await enrollPlayerInSchool(caller, input));
});
