import type { NextRequest } from "next/server";
import { apiHandler, okPaginated, parsePagination } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listUsersForCaller } from "@/lib/services/user.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/users — requires `user:read`.
 * Thin: resolve the caller, parse the query, delegate. The permission check
 * itself lives in the service.
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const search = url.searchParams.get("search") ?? undefined;

  const { items, meta } = await listUsersForCaller(caller, pagination, search);

  return okPaginated(items, meta);
});
