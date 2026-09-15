import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Captures what would have been sent by SMS, so a test can read the code the
 * service generated. Nothing else can — the code is hashed before storage and
 * never returned by the API.
 */
const sentMessages: Array<{ mobile: string; text: string }> = [];

vi.mock("@/lib/sms", () => ({
  getSmsProvider: () => ({
    send: async (message: { mobile: string; text: string }) => {
      sentMessages.push(message);
    },
  }),
}));

const { prisma } = await import("@/lib/db");
const { hashIp, requestLoginOtp, verifyLoginOtp } =
  await import("@/lib/services/auth.service");
const { verifySessionToken } = await import("@/lib/auth/session");
const { env } = await import("@/lib/env");

const ACTIVE_MOBILE = "09120000001";
const BLOCKED_MOBILE = "09120000009";
const UNKNOWN_MOBILE = "09129999999";

function lastCode(): string {
  const text = sentMessages.at(-1)?.text ?? "";
  return /(\d{6})/.exec(text)?.[1] ?? "";
}

/** Rate limits are time-based, so each test starts from a clean slate. */
async function resetOtps(): Promise<void> {
  await prisma.otpCode.deleteMany({
    where: { mobile: { in: [ACTIVE_MOBILE, BLOCKED_MOBILE, UNKNOWN_MOBILE] } },
  });
}

beforeEach(async () => {
  sentMessages.length = 0;
  await resetOtps();
  await prisma.user.upsert({
    where: { mobile: ACTIVE_MOBILE },
    update: { status: "ACTIVE" },
    create: { mobile: ACTIVE_MOBILE, status: "ACTIVE" },
  });
  await prisma.user.upsert({
    where: { mobile: BLOCKED_MOBILE },
    update: { status: "BLOCKED" },
    create: { mobile: BLOCKED_MOBILE, status: "BLOCKED" },
  });
});

describe("login: happy path", () => {
  it("issues a code and exchanges it for a session", async () => {
    const result = await requestLoginOtp(ACTIVE_MOBILE, null);
    expect(result.expiresInSeconds).toBe(env.OTP_TTL_SECONDS);
    expect(sentMessages).toHaveLength(1);

    const { token, userId } = await verifyLoginOtp(ACTIVE_MOBILE, lastCode());

    const session = await verifySessionToken(token);
    expect(session?.sub).toBe(userId);
    expect(session?.mobile).toBe(ACTIVE_MOBILE);
  });

  it("records the login time", async () => {
    await requestLoginOtp(ACTIVE_MOBILE, null);
    await verifyLoginOtp(ACTIVE_MOBILE, lastCode());

    const user = await prisma.user.findUnique({
      where: { mobile: ACTIVE_MOBILE },
    });
    expect(user?.lastLoginAt).not.toBeNull();
  });

  it("never stores the code in readable form", async () => {
    await requestLoginOtp(ACTIVE_MOBILE, null);
    const code = lastCode();

    const record = await prisma.otpCode.findFirst({
      where: { mobile: ACTIVE_MOBILE },
      orderBy: { createdAt: "desc" },
    });

    expect(record?.codeHash).not.toContain(code);
    expect(record?.codeHash).toHaveLength(64); // hex sha256
  });
});

describe("login: a code is single use", () => {
  it("rejects the same code twice", async () => {
    await requestLoginOtp(ACTIVE_MOBILE, null);
    const code = lastCode();

    await verifyLoginOtp(ACTIVE_MOBILE, code);
    await expect(verifyLoginOtp(ACTIVE_MOBILE, code)).rejects.toThrow();
  });

  it("retires the previous code when a new one is requested", async () => {
    await requestLoginOtp(ACTIVE_MOBILE, null);
    const firstCode = lastCode();

    // Step past the resend cooldown.
    await prisma.otpCode.updateMany({
      where: { mobile: ACTIVE_MOBILE },
      data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    await requestLoginOtp(ACTIVE_MOBILE, null);
    const secondCode = lastCode();
    expect(secondCode).not.toBe("");

    await expect(verifyLoginOtp(ACTIVE_MOBILE, firstCode)).rejects.toThrow();
    await expect(
      verifyLoginOtp(ACTIVE_MOBILE, secondCode),
    ).resolves.toBeDefined();
  });
});

describe("login: wrong and expired codes", () => {
  it("rejects a wrong code and counts the attempt", async () => {
    await requestLoginOtp(ACTIVE_MOBILE, null);
    const wrong = lastCode() === "000000" ? "111111" : "000000";

    await expect(verifyLoginOtp(ACTIVE_MOBILE, wrong)).rejects.toThrow();

    const record = await prisma.otpCode.findFirst({
      where: { mobile: ACTIVE_MOBILE },
      orderBy: { createdAt: "desc" },
    });
    expect(record?.attempts).toBe(1);
  });

  it("kills the code once the attempt cap is reached", async () => {
    await requestLoginOtp(ACTIVE_MOBILE, null);
    const code = lastCode();

    await prisma.otpCode.updateMany({
      where: { mobile: ACTIVE_MOBILE, consumedAt: null },
      data: { attempts: env.OTP_MAX_ATTEMPTS },
    });

    // Even the correct code no longer works.
    await expect(verifyLoginOtp(ACTIVE_MOBILE, code)).rejects.toThrow();
  });

  it("rejects an expired code", async () => {
    await requestLoginOtp(ACTIVE_MOBILE, null);
    const code = lastCode();

    await prisma.otpCode.updateMany({
      where: { mobile: ACTIVE_MOBILE, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(verifyLoginOtp(ACTIVE_MOBILE, code)).rejects.toThrow();
  });

  it("rejects verification when no code was ever requested", async () => {
    await expect(verifyLoginOtp(ACTIVE_MOBILE, "123456")).rejects.toThrow();
  });
});

describe("login: account enumeration", () => {
  /**
   * The whole point: someone probing numbers must not be able to tell a
   * member's number from a stranger's.
   */
  it("answers identically for an unknown number", async () => {
    const known = await requestLoginOtp(ACTIVE_MOBILE, null);
    await resetOtps();
    const unknown = await requestLoginOtp(UNKNOWN_MOBILE, null);

    expect(unknown).toEqual(known);
  });

  it("sends nothing to an unknown number", async () => {
    await requestLoginOtp(UNKNOWN_MOBILE, null);
    expect(sentMessages).toHaveLength(0);
  });

  it("still records a row for an unknown number, so rate limits apply", async () => {
    await requestLoginOtp(UNKNOWN_MOBILE, null);

    const record = await prisma.otpCode.findFirst({
      where: { mobile: UNKNOWN_MOBILE },
    });
    expect(record).not.toBeNull();
    expect(record?.userId).toBeNull();
  });

  it("cannot be verified for an unknown number under any code", async () => {
    await requestLoginOtp(UNKNOWN_MOBILE, null);

    for (const guess of ["000000", "123456", "999999"]) {
      await expect(verifyLoginOtp(UNKNOWN_MOBILE, guess)).rejects.toThrow();
    }
  });

  it("sends nothing to a blocked account", async () => {
    await requestLoginOtp(BLOCKED_MOBILE, null);
    expect(sentMessages).toHaveLength(0);
  });
});

describe("login: rate limiting", () => {
  it("enforces the resend cooldown", async () => {
    await requestLoginOtp(ACTIVE_MOBILE, null);
    await expect(requestLoginOtp(ACTIVE_MOBILE, null)).rejects.toThrow();
  });

  it("caps requests per number per hour", async () => {
    for (let index = 0; index < env.OTP_MAX_PER_HOUR; index++) {
      await requestLoginOtp(ACTIVE_MOBILE, null);
      // Clear the cooldown but stay inside the hour window.
      await prisma.otpCode.updateMany({
        where: { mobile: ACTIVE_MOBILE },
        data: { createdAt: new Date(Date.now() - 5 * 60 * 1000) },
      });
    }

    await expect(requestLoginOtp(ACTIVE_MOBILE, null)).rejects.toThrow();
  });

  it("rate-limits an unknown number too", async () => {
    await requestLoginOtp(UNKNOWN_MOBILE, null);
    await expect(requestLoginOtp(UNKNOWN_MOBILE, null)).rejects.toThrow();
  });

  /**
   * The per-source cap catches bulk abuse across many numbers, where the
   * per-number cap alone would not.
   */
  it("caps requests from one source across different numbers", async () => {
    const ip = "203.0.113.7";
    const ipHash = hashIp(ip)!;
    const since = new Date(Date.now() - 30 * 60 * 1000);

    await prisma.otpCode.deleteMany({ where: { ipHash } });
    await prisma.otpCode.createMany({
      data: Array.from({ length: env.OTP_MAX_PER_IP_PER_HOUR }, (_, index) => ({
        mobile: `0912${String(100000 + index).slice(0, 6)}`,
        codeHash: `filler-${index}`,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: since,
        ipHash,
      })),
    });

    await expect(requestLoginOtp("09121234567", ip)).rejects.toThrow();

    await prisma.otpCode.deleteMany({ where: { ipHash } });
  });

  it("hashes the source address rather than storing it", async () => {
    const ip = "198.51.100.42";
    await requestLoginOtp(ACTIVE_MOBILE, ip);

    const record = await prisma.otpCode.findFirst({
      where: { mobile: ACTIVE_MOBILE },
      orderBy: { createdAt: "desc" },
    });

    expect(record?.ipHash).not.toBe(ip);
    expect(record?.ipHash).toBe(hashIp(ip));
    expect(record?.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
