import { z } from "zod";
import { toEnglishDigits } from "@/lib/utils/number";

/**
 * Iranian identifiers.
 *
 * Every schema here normalises before it validates. Persian keyboards produce
 * `۰۹…` and some Android keyboards produce Arabic-Indic `٠٩…`; a user typing a
 * perfectly correct number on their own phone must not be rejected because of
 * the numeral system their keyboard uses.
 */

/** `09XXXXXXXXX` — the only shape stored anywhere. */
const MOBILE_PATTERN = /^09\d{9}$/;

/**
 * Accepts the forms people actually type — `09123456789`, `+989123456789`,
 * `00989123456789`, `9123456789`, with or without spaces and dashes — and
 * returns the canonical one.
 */
export function normalizeMobile(input: string): string {
  let value = toEnglishDigits(input).replace(/[\s\-()./]/g, "");

  if (value.startsWith("+98")) value = `0${value.slice(3)}`;
  else if (value.startsWith("0098")) value = `0${value.slice(4)}`;
  else if (value.startsWith("98") && value.length === 12) {
    value = `0${value.slice(2)}`;
  } else if (value.startsWith("9") && value.length === 10) {
    value = `0${value}`;
  }

  return value;
}

export const mobileSchema = z
  .string()
  .trim()
  .min(1, "شماره موبایل را وارد کنید.")
  .transform(normalizeMobile)
  .refine((value) => MOBILE_PATTERN.test(value), {
    message: "شماره موبایل معتبر نیست. نمونه درست: ۰۹۱۲۳۴۵۶۷۸۹",
  });

/**
 * Iranian national code: ten digits whose last digit is a checksum over the
 * first nine.
 *
 * Sequences of one repeated digit (`0000000000`, `1111111111`, …) pass the
 * arithmetic but are not issued to anyone, so they are rejected explicitly —
 * otherwise they become the obvious filler value in real records.
 */
export function isValidNationalCode(input: string): boolean {
  const value = toEnglishDigits(input).trim();

  if (!/^\d{10}$/.test(value)) return false;
  if (/^(\d)\1{9}$/.test(value)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index++) {
    sum += Number(value[index]) * (10 - index);
  }

  const remainder = sum % 11;
  const checkDigit = Number(value[9]);

  return remainder < 2
    ? checkDigit === remainder
    : checkDigit === 11 - remainder;
}

export const nationalCodeSchema = z
  .string()
  .trim()
  .min(1, "کد ملی را وارد کنید.")
  .transform((value) => toEnglishDigits(value).trim())
  .refine(isValidNationalCode, { message: "کد ملی معتبر نیست." });

/** The six digits sent by SMS. */
export const otpCodeSchema = z
  .string()
  .trim()
  .min(1, "کد تأیید را وارد کنید.")
  .transform((value) => toEnglishDigits(value).replace(/\s/g, ""))
  .refine((value) => /^\d{6}$/.test(value), {
    message: "کد تأیید باید ۶ رقم باشد.",
  });
