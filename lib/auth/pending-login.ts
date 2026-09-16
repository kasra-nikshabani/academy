import { cookies } from "next/headers";
import { isProduction } from "@/lib/env";

const PENDING_COOKIE = "academy_pending_login";
const PENDING_TTL_SECONDS = 15 * 60;

/**
 * Remembers which number is midway through signing in.
 *
 * Held in an httpOnly cookie rather than passed as `?mobile=` — a phone number
 * in a URL ends up in browser history, server logs and referrer headers, and
 * these numbers belong to children and their parents (docs/SECURITY.md).
 */
export async function setPendingLoginMobile(mobile: string): Promise<void> {
  const store = await cookies();
  store.set(PENDING_COOKIE, mobile, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_TTL_SECONDS,
  });
}

export async function getPendingLoginMobile(): Promise<string | null> {
  const store = await cookies();
  return store.get(PENDING_COOKIE)?.value ?? null;
}

export async function clearPendingLoginMobile(): Promise<void> {
  const store = await cookies();
  store.set(PENDING_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
