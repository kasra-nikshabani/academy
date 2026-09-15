import { prisma } from "@/lib/db";
import type { OtpCode, OtpPurpose } from "@/lib/generated/prisma/client";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

export interface CreateOtpInput {
  mobile: string;
  codeHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  userId?: string | undefined;
  ipHash?: string | undefined;
}

export async function createOtpCode(input: CreateOtpInput): Promise<OtpCode> {
  return prisma.otpCode.create({
    data: {
      mobile: input.mobile,
      codeHash: input.codeHash,
      purpose: input.purpose,
      expiresAt: input.expiresAt,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.ipHash ? { ipHash: input.ipHash } : {}),
    },
  });
}

/** The newest code for a number that is still unconsumed. */
export async function findLatestActiveOtp(
  mobile: string,
  purpose: OtpPurpose,
): Promise<OtpCode | null> {
  return prisma.otpCode.findFirst({
    where: { mobile, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function findLatestOtp(
  mobile: string,
  purpose: OtpPurpose,
): Promise<OtpCode | null> {
  return prisma.otpCode.findFirst({
    where: { mobile, purpose },
    orderBy: { createdAt: "desc" },
  });
}

export async function countOtpsSince(
  mobile: string,
  since: Date,
): Promise<number> {
  return prisma.otpCode.count({
    where: { mobile, createdAt: { gte: since } },
  });
}

export async function countOtpsForIpSince(
  ipHash: string,
  since: Date,
): Promise<number> {
  return prisma.otpCode.count({
    where: { ipHash, createdAt: { gte: since } },
  });
}

export async function incrementOtpAttempts(id: string): Promise<OtpCode> {
  return prisma.otpCode.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
}

export async function consumeOtpCode(id: string): Promise<OtpCode> {
  return prisma.otpCode.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}

/**
 * Invalidates every other live code for a number, so requesting a new code
 * silently retires the previous one instead of leaving several valid at once.
 */
export async function consumeOtherActiveOtps(
  mobile: string,
  purpose: OtpPurpose,
  exceptId: string,
): Promise<void> {
  await prisma.otpCode.updateMany({
    where: { mobile, purpose, consumedAt: null, id: { not: exceptId } },
    data: { consumedAt: new Date() },
  });
}
