import { describe, expect, it } from "vitest";
import {
  isValidNationalCode,
  mobileSchema,
  nationalCodeSchema,
  normalizeMobile,
  otpCodeSchema,
} from "@/lib/validation/iran";

describe("mobile number", () => {
  it("accepts the canonical form", () => {
    expect(mobileSchema.parse("09123456789")).toBe("09123456789");
  });

  it("normalises the forms people actually type", () => {
    for (const input of [
      "+989123456789",
      "00989123456789",
      "989123456789",
      "9123456789",
      "0912 345 6789",
      "0912-345-6789",
    ]) {
      expect(mobileSchema.parse(input)).toBe("09123456789");
    }
  });

  /** Persian and Arabic-Indic keyboards must not lock a user out. */
  it("accepts Persian and Arabic-Indic digits", () => {
    expect(mobileSchema.parse("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(mobileSchema.parse("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
    expect(mobileSchema.parse("+۹۸۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
  });

  it("rejects malformed numbers", () => {
    for (const input of [
      "",
      "0912345678", // one digit short
      "091234567890", // one too many
      "08123456789", // wrong prefix
      "1234567890",
      "not-a-number",
    ]) {
      expect(() => mobileSchema.parse(input)).toThrow();
    }
  });

  it("normalises without validating", () => {
    expect(normalizeMobile("+98 912 345 6789")).toBe("09123456789");
  });
});

describe("national code", () => {
  /**
   * Check digits computed with the published algorithm; these are structurally
   * valid codes, not real people's.
   */
  it("accepts codes with a correct check digit", () => {
    for (const code of [
      "0499370899",
      "0790419904",
      "1234567891",
      "0067543219",
    ]) {
      expect(isValidNationalCode(code)).toBe(true);
    }
  });

  it("rejects a wrong check digit", () => {
    expect(isValidNationalCode("0499370898")).toBe(false);
    expect(isValidNationalCode("0790419905")).toBe(false);
  });

  it("rejects a single repeated digit", () => {
    // `1111111111` genuinely satisfies the check-digit arithmetic, but codes
    // like these are never issued and would otherwise become the obvious
    // filler value in real records.
    for (const code of ["0000000000", "1111111111", "9999999999"]) {
      expect(isValidNationalCode(code)).toBe(false);
    }
  });

  it("rejects wrong lengths and non-digits", () => {
    for (const code of ["", "123", "04993708999", "abcdefghij"]) {
      expect(isValidNationalCode(code)).toBe(false);
    }
  });

  it("accepts Persian digits through the schema", () => {
    expect(nationalCodeSchema.parse("۰۴۹۹۳۷۰۸۹۹")).toBe("0499370899");
  });
});

describe("otp code", () => {
  it("accepts six digits in either numeral system", () => {
    expect(otpCodeSchema.parse("123456")).toBe("123456");
    expect(otpCodeSchema.parse("۱۲۳۴۵۶")).toBe("123456");
    expect(otpCodeSchema.parse("12 34 56")).toBe("123456");
  });

  it("rejects anything that is not six digits", () => {
    for (const input of ["", "12345", "1234567", "12345a"]) {
      expect(() => otpCodeSchema.parse(input)).toThrow();
    }
  });
});
