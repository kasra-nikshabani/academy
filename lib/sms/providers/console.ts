import { logger } from "@/lib/logger";
import { maskPhone } from "@/lib/logger/redact";
import type { SmsMessage, SmsProvider } from "../sms";

/* eslint-disable no-console -- development-only delivery channel */

/**
 * Development delivery: prints the message so a developer can complete a login
 * without an SMS gateway.
 *
 * The body is written straight to stdout and deliberately does **not** go
 * through `logger`: the logger redacts OTP codes, which is exactly right for
 * real logs and exactly wrong for a channel whose whole job is to show the
 * code. Keeping it out of `logger` also means the code can never reach a log
 * aggregator by accident.
 */
export const consoleSmsProvider: SmsProvider = {
  async send(message: SmsMessage): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "consoleSmsProvider must never be used in production — configure a real SMS_PROVIDER.",
      );
    }

    logger.info("otp dispatched", {
      mobile: message.mobile,
      channel: "console",
    });

    console.info(
      [
        "",
        "  ── SMS (development only) ──────────────────",
        `  به: ${maskPhone(message.mobile)}`,
        `  ${message.text}`,
        "  ────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  },
};
