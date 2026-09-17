import type { NextRequest } from "next/server";
import { apiHandler, created, okPaginated, parsePagination } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { createMatch, listMatches } from "@/lib/services/match.service";
import { createMatchSchema, matchQuerySchema } from "@/lib/validation/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;
  const pagination = parsePagination(params);
  const filters = matchQuerySchema.parse({
    teamId: params.get("teamId") ?? undefined,
    status: params.get("status") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  const { items, meta } = await listMatches(caller, pagination, filters);
  return okPaginated(items, meta);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createMatchSchema.parse(await readJsonBody(request));
  return created(await createMatch(caller, input));
});
