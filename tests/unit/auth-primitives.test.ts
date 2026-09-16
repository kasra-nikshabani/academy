import { describe, expect, it } from "vitest";
import {
  OTP_LENGTH,
  generateOtpCode,
  hashOtpCode,
  otpExpiryDate,
  verifyOtpCode,
} from "@/lib/auth/otp";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("otp codes", () => {
  it("always produces six digits, leading zeros kept", () => {
    for (let index = 0; index < 500; index++) {
      const code = generateOtpCode();
      expect(code).toHaveLength(OTP_LENGTH);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("does not repeat itself in a short run", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateOtpCode()));
    // 200 draws from 10^6 should almost never collide more than a little.
    expect(codes.size).toBeGreaterThan(190);
  });

  it("verifies a matching code", () => {
    const code = generateOtpCode();
    const hash = hashOtpCode("09123456789", code);
    expect(verifyOtpCode("09123456789", code, hash)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const hash = hashOtpCode("09123456789", "123456");
    expect(verifyOtpCode("09123456789", "654321", hash)).toBe(false);
  });

  /** A code captured for one number must not work for another. */
  it("binds the code to its mobile number", () => {
    const code = "123456";
    const hash = hashOtpCode("09123456789", code);
    expect(verifyOtpCode("09120000001", code, hash)).toBe(false);
  });

  it("never stores the code itself", () => {
    const hash = hashOtpCode("09123456789", "123456");
    expect(hash).not.toContain("123456");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("survives a malformed stored hash", () => {
    expect(verifyOtpCode("09123456789", "123456", "")).toBe(false);
    expect(verifyOtpCode("09123456789", "123456", "abc")).toBe(false);
  });

  it("expires in the future", () => {
    const now = new Date();
    expect(otpExpiryDate(now).getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("session tokens", () => {
  const payload = { sub: "user_1", mobile: "09123456789" };

  it("round-trips a signed session", async () => {
    const token = await createSessionToken(payload);
    await expect(verifySessionToken(token)).resolves.toEqual(payload);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken(payload);
    const [header, body, signature] = token.split(".");
    const forged = `${header}.${body}x.${signature}`;

    await expect(verifySessionToken(forged)).resolves.toBeNull();
  });

  it("rejects an unsigned token", async () => {
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none" })).toString(
      "base64url",
    )}.${Buffer.from(
      JSON.stringify({ sub: "user_1", mobile: "09123456789" }),
    ).toString("base64url")}.`;

    await expect(verifySessionToken(unsigned)).resolves.toBeNull();
  });

  it("rejects nonsense", async () => {
    for (const token of ["", "not.a.token", "aaa"]) {
      await expect(verifySessionToken(token)).resolves.toBeNull();
    }
  });
});
