import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import type { RoleKey } from "@/lib/generated/prisma/enums";

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

export interface UserListItem {
  id: string;
  mobile: string;
  status: User["status"];
  lastLoginAt: Date | null;
  roles: RoleKey[];
}

/**
 * A page of users with their role keys.
 *
 * Count and rows go in one transaction so the total cannot drift between the
 * two queries while someone is paging.
 */
export async function listUsers(params: {
  skip: number;
  take: number;
  search?: string | undefined;
}): Promise<{ items: UserListItem[]; total: number }> {
  const where = params.search ? { mobile: { contains: params.search } } : {};

  // Paired, not transactional — see the note in ./transaction.ts.
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mobile: true,
        status: true,
        lastLoginAt: true,
        userRoles: { select: { role: { select: { key: true } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      mobile: row.mobile,
      status: row.status,
      lastLoginAt: row.lastLoginAt,
      roles: row.userRoles.map((assignment) => assignment.role.key),
    })),
    total,
  };
}
