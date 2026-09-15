import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

export async function findUserByMobile(mobile: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { mobile } });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function markUserLoggedIn(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}
