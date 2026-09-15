import type { NextRequest } from "next/server";
import { apiHandler, created, okPaginated, parsePagination } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { buildPaginationMeta } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createTeam, listTeams } from "@/lib/services/academy.service";
import { createTeamSchema } from "@/lib/validation/academy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;
  const pagination = parsePagination(params);

  const { items, total } = await listTeams(caller, {
    sportId: params.get("sportId") ?? undefined,
    ageGroupId: params.get("ageGroupId") ?? undefined,
    includeInactive: params.get("includeInactive") === "true",
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  });

  return okPaginated(items, buildPaginationMeta(pagination, total));
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createTeamSchema.parse(await readJsonBody(request));
  return created(await createTeam(caller, input));
});
