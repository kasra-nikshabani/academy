import type { NextRequest } from "next/server";
import { apiHandler, created, okPaginated, parsePagination } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createStaff, listStaff } from "@/lib/services/people.service";
import { createStaffSchema } from "@/lib/validation/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const pagination = parsePagination(new URL(request.url).searchParams);
  const { items, meta } = await listStaff(caller, pagination);
  return okPaginated(items, meta);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createStaffSchema.parse(await request.json());
  return created(await createStaff(caller, input));
});
