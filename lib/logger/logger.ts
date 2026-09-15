/* eslint-disable no-console -- this module is the single sanctioned console writer */
import { redact } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const configured = process.env["LOG_LEVEL"]?.toLowerCase();
  if (configured && configured in LEVEL_WEIGHT) {
    return configured as LogLevel;
  }
  if (process.env.NODE_ENV === "test") return "error";
  if (process.env.NODE_ENV === "production") return "info";
  return "debug";
}

const minWeight = LEVEL_WEIGHT[resolveMinLevel()];
const isProductionFormat = process.env.NODE_ENV === "production";

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_WEIGHT[level] < minWeight) return;

  const safeContext = context ? (redact(context) as LogContext) : undefined;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(safeContext ?? {}),
  };

  const line = isProductionFormat
    ? JSON.stringify(entry)
    : `${entry.ts} ${level.toUpperCase().padEnd(5)} ${message}${
        safeContext && Object.keys(safeContext).length > 0
          ? ` ${JSON.stringify(safeContext)}`
          : ""
      }`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Central application logger. Every field passed in `context` goes through
 * redaction first (lib/logger/redact.ts) — OTP codes, tokens, secrets and
 * national IDs can never reach the output, and phone numbers are masked.
 *
 * Never call `console.*` directly; ESLint blocks it outside this file.
 */
export const logger = {
  debug: (message: string, context?: LogContext) =>
    write("debug", message, context),
  info: (message: string, context?: LogContext) =>
    write("info", message, context),
  warn: (message: string, context?: LogContext) =>
    write("warn", message, context),
  error: (message: string, context?: LogContext) =>
    write("error", message, context),
};
