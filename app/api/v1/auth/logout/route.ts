import { apiHandler, ok } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/auth/logout — always succeeds, signed in or not. */
export const POST = apiHandler(async () => {
  await clearSessionCookie();
  return ok({ signedOut: true });
});
