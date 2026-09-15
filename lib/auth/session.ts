import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env, isProduction } from "@/lib/env";

const ISSUER = "sepahan-academy";
const AUDIENCE = "sepahan-academy-web";

const secretKey = new TextEncoder().encode(env.AUTH_SECRET);

export interface SessionPayload {
  /** User id. */
  sub: string;
  mobile: string;
}

/**
 * Signs the session as a short-lived JWT held in an httpOnly cookie.
 *
 * httpOnly keeps the token out of reach of any script on the page, so an XSS
 * bug cannot walk away with a session. `sameSite: lax` blocks the cookie from
 * riding along on cross-site POSTs while still surviving normal navigation.
 */
export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ mobile: payload.mobile })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${env.SESSION_TTL_HOURS}h`)
    .sign(secretKey);
}

/** Returns null for anything invalid — expired, tampered, or foreign. */
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload["mobile"] !== "string"
    ) {
      return null;
    }

    return { sub: payload.sub, mobile: payload["mobile"] };
  } catch {
    // A failed verification is not an error condition — it is an anonymous
    // visitor. Nothing is logged here; the token itself must never be.
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_TTL_HOURS * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(env.SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function readSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(env.SESSION_COOKIE_NAME)?.value;
}
