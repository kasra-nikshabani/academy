import { describe, expect, it } from "vitest";
import { REDACTED, maskPhone, redact } from "@/lib/logger/redact";

describe("redact", () => {
  it("removes OTP codes", () => {
    const result = redact({ otp: "123456", otpCode: "654321" }) as Record<
      string,
      unknown
    >;

    expect(result["otp"]).toBe(REDACTED);
    expect(result["otpCode"]).toBe(REDACTED);
    expect(JSON.stringify(result)).not.toContain("123456");
  });

  it("removes tokens, passwords and secrets", () => {
    const result = JSON.stringify(
      redact({
        accessToken: "eyJhbGciOi",
        refresh_token: "r-token",
        password: "hunter2",
        AUTH_SECRET: "s3cret",
        authorization: "Bearer abc",
      }),
    );

    expect(result).not.toContain("eyJhbGciOi");
    expect(result).not.toContain("r-token");
    expect(result).not.toContain("hunter2");
    expect(result).not.toContain("s3cret");
    expect(result).not.toContain("Bearer abc");
  });

  it("hides national codes but keeps their length", () => {
    const result = redact({ nationalCode: "1234567890" }) as Record<
      string,
      unknown
    >;

    expect(result["nationalCode"]).toBe("[NATIONAL_ID:10]");
    expect(JSON.stringify(result)).not.toContain("1234567890");
  });

  it("masks phone numbers instead of dropping them", () => {
    expect(maskPhone("09123456789")).toBe("0912***6789");
    expect(maskPhone("+98 912 345 6789")).toBe("9891***6789");
    expect(maskPhone("123")).toBe(REDACTED);
    expect(maskPhone(undefined)).toBe(REDACTED);
  });

  it("redacts nested structures and arrays", () => {
    const result = JSON.stringify(
      redact({
        user: { profile: { nationalCode: "0011223344" } },
        attempts: [{ otp: "111111" }, { otp: "222222" }],
      }),
    );

    expect(result).not.toContain("0011223344");
    expect(result).not.toContain("111111");
    expect(result).not.toContain("222222");
  });

  it("keeps non-sensitive fields readable", () => {
    const result = redact({ playerId: "p-1", status: "ACTIVE" }) as Record<
      string,
      unknown
    >;

    expect(result["playerId"]).toBe("p-1");
    expect(result["status"]).toBe("ACTIVE");
  });

  it("serialises errors without throwing", () => {
    const result = redact({ error: new Error("boom") }) as {
      error: { message: string };
    };

    expect(result.error.message).toBe("boom");
  });

  it("stops at a bounded depth instead of recursing forever", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;

    expect(() => JSON.stringify(redact(cyclic))).not.toThrow();
  });
});

describe("values that are objects but not records", () => {
  /**
   * A `Date` walked as a plain object yields `{}` — every timestamp in every
   * log line lost, with nothing to show it had happened.
   */
  it("keeps a Date as an ISO string", () => {
    const output = redact({ startsAt: new Date("2026-09-16T12:30:00.000Z") });
    expect(output).toEqual({ startsAt: "2026-09-16T12:30:00.000Z" });
  });

  it("survives an invalid Date", () => {
    expect(redact({ at: new Date("nonsense") })).toEqual({
      at: "[INVALID_DATE]",
    });
  });

  it("keeps a Date nested inside an object", () => {
    expect(redact({ session: { startsAt: new Date(0) } })).toEqual({
      session: { startsAt: "1970-01-01T00:00:00.000Z" },
    });
  });
});
