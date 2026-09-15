import { UnauthenticatedError } from "@/lib/errors";
import { findUserById } from "@/lib/repositories/user.repository";
import type { User } from "@/lib/generated/prisma/client";
import { readSessionCookie, verifySessionToken } from "./session";

/**
 * Resolves the caller from the session cookie, or null when there is none.
 *
 * The user is re-read from the database on every call rather than trusted from
 * the token: a user blocked or deactivated by an administrator must lose
 * access immediately, not when their 12-hour token happens to expire.
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = await readSessionCookie();
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await findUserById(payload.sub);
  if (!user || user.status !== "ACTIVE") return null;

  return user;
}

/** Same as `getCurrentUser`, but for paths that require a signed-in caller. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}
