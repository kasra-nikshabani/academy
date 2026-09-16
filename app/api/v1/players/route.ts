import type { NextRequest } from "next/server";
import { apiHandler, created, okPaginated, parsePagination } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { createPlayer, listPlayers } from "@/lib/services/people.service";
import { createPlayerSchema, playerQuerySchema } from "@/lib/validation/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;
  const pagination = parsePagination(params);
  const filters = playerQuerySchema.parse({
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
  });

  const { items, meta } = await listPlayers(caller, pagination, filters);
  return okPaginated(items, meta);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createPlayerSchema.parse(await readJsonBody(request));
  return created(await createPlayer(caller, input));
});
