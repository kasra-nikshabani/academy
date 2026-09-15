import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me — the signed-in user.
 * Roles and permissions join this payload in Phase 3.
 */
export const GET = apiHandler(async () => {
  const user = await requireUser();

  return ok({
    id: user.id,
    mobile: user.mobile,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
  });
});
