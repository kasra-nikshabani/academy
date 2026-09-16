import { env } from "@/lib/env";
import { consoleSmsProvider } from "./providers/console";
import type { SmsProvider } from "./sms";

export type { SmsMessage, SmsProvider } from "./sms";

/**
 * Resolves the configured SMS channel.
 *
 * Only the console provider exists today. A real gateway is added here when
 * the club picks one — nothing outside this module knows which provider is in
 * use (docs/SECURITY.md).
 */
export function getSmsProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case "console":
      return consoleSmsProvider;
  }
}
