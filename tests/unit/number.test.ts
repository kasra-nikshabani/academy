import { describe, expect, it } from "vitest";
import {
  formatNumber,
  formatPercent,
  toEnglishDigits,
  toPersianDigits,
} from "@/lib/utils/number";

describe("digit conversion", () => {
  it("converts ASCII digits to Persian", () => {
    expect(toPersianDigits("1405/06/24")).toBe("۱۴۰۵/۰۶/۲۴");
    expect(toPersianDigits(42)).toBe("۴۲");
  });

  it("converts Persian digits back to ASCII", () => {
    expect(toEnglishDigits("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
  });

  /**
   * Some Android keyboards emit Arabic-Indic digits rather than Persian ones.
   * A mobile number typed on such a keyboard must still validate.
   */
  it("converts Arabic-Indic digits back to ASCII", () => {
    expect(toEnglishDigits("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
  });

  it("leaves non-digits untouched", () => {
    expect(toEnglishDigits("کد ملی: ۱۲۳")).toBe("کد ملی: 123");
    expect(toPersianDigits("U12")).toBe("U۱۲");
  });

  it("round-trips", () => {
    expect(toEnglishDigits(toPersianDigits("09123456789"))).toBe("09123456789");
  });
});

describe("number formatting", () => {
  it("groups thousands in Persian", () => {
    expect(formatNumber(12500)).toBe("۱۲٬۵۰۰");
  });

  it("formats attendance rates as percentages", () => {
    // fa-IR places the sign after the number.
    expect(formatPercent(0.847)).toBe("۸۵٪");
    expect(formatPercent(1)).toBe("۱۰۰٪");
  });
});
