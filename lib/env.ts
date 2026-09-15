import { z } from "zod";

/**
 * Server-side environment, validated once at startup.
 * Importing this module from a Client Component is a bug: it would leak
 * secrets into the browser bundle. Only `lib/**` and Server Components may
 * import it.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.url().default("http://localhost:3200"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .startsWith("postgresql://", "DATABASE_URL must be a PostgreSQL URL"),

  // --- auth (consumed from Phase 2) ---
  AUTH_SECRET: z.string().default(""),
  SESSION_COOKIE_NAME: z.string().default("academy_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),

  // --- OTP (consumed from Phase 2) ---
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  SMS_PROVIDER: z.enum(["console"]).default("console"),

  // --- storage (consumed from Phase 18) ---
  STORAGE_PROVIDER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage/uploads"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    // Only the offending variable NAMES are printed — never their values.
    const invalid = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `پیکربندی محیط نامعتبر است. متغیرهای زیر را بررسی کنید: ${invalid}`,
    );
  }

  return parsed.data;
}

export const env: ServerEnv = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
