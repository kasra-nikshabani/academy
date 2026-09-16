import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env, isProduction } from "@/lib/env";

/**
 * Proof that a visitor holds the phone number they typed.
 *
 * Public tryout registration has no account behind it, so the only thing the
 * server can know about an applicant is that a code sent to their number came
 * back. That fact is carried between the OTP step and the submit step as a
 * **signed** token in an httpOnly cookie.
 *
 * Signed, not merely httpOnly: `httpOnly` stops a script on the page from
 * reading the cookie, but any client can put whatever it likes in a request.
 * An unsigned "I verified 0912…" cookie would let anyone register under
 * anyone's number.
 */

const ISSUER = "sepahan-academy";
const AUDIENCE = "sepahan-academy-tryout";
const COOKIE = "academy_tryout";

/** Long enough to fill in a form for a child, short enough to be a proof. */
const TTL_SECONDS = 30 * 60;

const secretKey = new TextEncoder().encode(env.AUTH_SECRET);

export async function createTryoutVerificationToken(
  mobile: string,
): Promise<string> {
  return new SignJWT({ mobile })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secretKey);
}

/** The verified mobile, or null for anything expired, tampered or absent. */
export async function readVerifiedTryoutMobile(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });

    return typeof payload["mobile"] === "string" ? payload["mobile"] : null;
  } catch {
    // An anonymous visitor, not an error. The token is never logged.
    return null;
  }
}

export async function setTryoutVerificationCookie(
  token: string,
): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearTryoutVerificationCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
