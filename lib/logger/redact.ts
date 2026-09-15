/**
 * Redaction rules for structured logs.
 *
 * CLAUDE.md §27 forbids logging OTP codes, tokens, secrets and sensitive PII.
 * This is enforced here — at the logger — rather than trusted to every call
 * site, so a careless `logger.info("...", { otp })` still cannot leak.
 */

/** Values under these keys are replaced entirely. */
const SECRET_KEYS = new Set(
  [
    "otp",
    "otpcode",
    "otp_code",
    "code",
    "token",
    "accesstoken",
    "access_token",
    "refreshtoken",
    "refresh_token",
    "sessiontoken",
    "session_token",
    "password",
    "passwordhash",
    "secret",
    "authsecret",
    "auth_secret",
    "apikey",
    "api_key",
    "authorization",
    "cookie",
    "setcookie",
    "set_cookie",
    "databaseurl",
    "database_url",
  ].map((k) => k.toLowerCase()),
);

/** National identifiers: present but never readable. */
const NATIONAL_ID_KEYS = new Set(
  ["nationalcode", "national_code", "nationalid", "national_id"].map((k) =>
    k.toLowerCase(),
  ),
);

/** Contact numbers: partially masked so support can still correlate reports. */
const PHONE_KEYS = new Set(
  [
    "mobile",
    "mobilenumber",
    "mobile_number",
    "phone",
    "phonenumber",
    "phone_number",
  ].map((k) => k.toLowerCase()),
);

export const REDACTED = "[REDACTED]";

const MAX_DEPTH = 6;

/** `09123456789` → `0912***6789`; anything unexpected is fully redacted. */
export function maskPhone(value: unknown): string {
  if (typeof value !== "string") return REDACTED;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return REDACTED;
  return `${digits.slice(0, 4)}***${digits.slice(-4)}`;
}

/** Keeps only the length, so "was it empty?" stays answerable. */
function maskNationalId(value: unknown): string {
  if (typeof value !== "string") return REDACTED;
  return `[NATIONAL_ID:${value.length}]`;
}

export function redact(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[MAX_DEPTH]";
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) {
    return input.map((item) => redact(item, depth + 1));
  }

  if (input instanceof Error) {
    return {
      name: input.name,
      message: input.message,
      ...(input.stack ? { stack: input.stack } : {}),
    };
  }

  if (typeof input === "object") {
    const source = input as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
      const normalized = key.toLowerCase();

      if (SECRET_KEYS.has(normalized)) {
        output[key] = REDACTED;
      } else if (NATIONAL_ID_KEYS.has(normalized)) {
        output[key] = maskNationalId(value);
      } else if (PHONE_KEYS.has(normalized)) {
        output[key] = maskPhone(value);
      } else {
        output[key] = redact(value, depth + 1);
      }
    }

    return output;
  }

  return input;
}
