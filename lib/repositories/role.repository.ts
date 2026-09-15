import { prisma } from "@/lib/db";
import type { RoleKey } from "@/lib/generated/prisma/enums";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

export interface UserAuthorization {
  roles: RoleKey[];
  permissionKeys: string[];
}

/**
 * Roles and permissions for one user, in a single query.
 *
 * This runs on every authenticated request, so it must not fan out: one round
 * trip, only the columns needed, duplicates collapsed here rather than in SQL
 * (a user with two roles legitimately shares permissions between them).
 */
export async function findUserAuthorization(
  userId: string,
): Promise<UserAuthorization> {
  const assignments = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          key: true,
          rolePermissions: {
            select: { permission: { select: { key: true } } },
          },
        },
      },
    },
  });

  const roles = new Set<RoleKey>();
  const permissionKeys = new Set<string>();

  for (const assignment of assignments) {
    roles.add(assignment.role.key);
    for (const granted of assignment.role.rolePermissions) {
      permissionKeys.add(granted.permission.key);
    }
  }

  return { roles: [...roles], permissionKeys: [...permissionKeys] };
}

export async function findRoleByKey(key: RoleKey) {
  return prisma.role.findUnique({ where: { key } });
}

export async function listRoles() {
  return prisma.role.findMany({
    orderBy: { key: "asc" },
    select: { id: true, key: true, name: true, description: true },
  });
}

export async function assignRoleToUser(input: {
  userId: string;
  roleId: string;
  assignedById?: string | undefined;
}): Promise<void> {
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: input.userId, roleId: input.roleId },
    },
    update: {},
    create: {
      userId: input.userId,
      roleId: input.roleId,
      ...(input.assignedById ? { assignedById: input.assignedById } : {}),
    },
  });
}

export async function removeRoleFromUser(
  userId: string,
  roleId: string,
): Promise<void> {
  await prisma.userRole.deleteMany({ where: { userId, roleId } });
}
