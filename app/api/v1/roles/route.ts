import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listRolesForCaller } from "@/lib/services/role.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/roles — requires `role:read`. */
export const GET = apiHandler(async () => {
  const caller = await requireUser();
  return ok(await listRolesForCaller(caller));
});
