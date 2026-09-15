const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** `1405/06/24` → `۱۴۰۵/۰۶/۲۴`. Non-digits are left untouched. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(
    /\d/g,
    (digit) => PERSIAN_DIGITS[Number(digit)]!,
  );
}

/**
 * Persian **and** Arabic-Indic digits → ASCII.
 *
 * Needed on every numeric input: Persian keyboards produce `۰۹…`, and some
 * Android keyboards produce the Arabic-Indic forms instead. Both must reach the
 * server as plain digits or a mobile number silently fails validation.
 */
export function toEnglishDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);
    if (persianIndex !== -1) return String(persianIndex);
    return String(ARABIC_INDIC_DIGITS.indexOf(digit));
  });
}

/** `12500` → `۱۲٬۵۰۰` */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

/** `0.847` → `۸۵٪` — attendance rates and the like. */
export function formatPercent(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("fa-IR", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
