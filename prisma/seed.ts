import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PERMISSIONS, splitPermission } from "../lib/permissions/catalogue";
import type { Permission } from "../lib/permissions/catalogue";
import { ROLE_DEFINITIONS } from "../lib/permissions/roles";
import type { RoleKey } from "../lib/generated/prisma/enums";

/**
 * Development seed.
 *
 * Every value here is fabricated. Real player, guardian or staff data must
 * never enter this repository (CLAUDE.md §29).
 *
 * Roles and permissions are synced from the code catalogue, so this is also
 * the migration path when a permission is added: add it to the catalogue and
 * re-run the seed.
 */
const SEED_USERS: ReadonlyArray<{
  mobile: string;
  note: string;
  roles: RoleKey[];
  blocked?: boolean;
}> = [
  { mobile: "09120000001", note: "مدیر سیستم", roles: ["ADMIN"] },
  { mobile: "09120000002", note: "مدیر آکادمی", roles: ["ACADEMY_MANAGER"] },
  { mobile: "09120000003", note: "مربی", roles: ["STAFF"] },
  {
    mobile: "09120000004",
    note: "بازیکن تیم اصلی",
    roles: ["MAIN_TEAM_PLAYER"],
  },
  { mobile: "09120000005", note: "ولی", roles: ["PARENT"] },
  // A coach who is also a parent — ordinary in an academy, and the reason
  // roles are a separate table rather than a column on User.
  {
    mobile: "09120000006",
    note: "مربی که ولی هم هست",
    roles: ["STAFF", "PARENT"],
  },
  { mobile: "09120000007", note: "بازیکن مدرسه", roles: ["SCHOOL_PLAYER"] },
  {
    mobile: "09120000009",
    note: "حساب مسدود، برای تست",
    roles: ["MAIN_TEAM_PLAYER"],
    blocked: true,
  },
];

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // --- permissions ----------------------------------------------------
    for (const key of Object.keys(PERMISSIONS) as Permission[]) {
      const { resource, action } = splitPermission(key);
      await prisma.permission.upsert({
        where: { key },
        update: { resource, action, description: PERMISSIONS[key] },
        create: { key, resource, action, description: PERMISSIONS[key] },
      });
    }
    console.info(`  ✓ ${Object.keys(PERMISSIONS).length} permissions`);

    // --- roles and their default permissions ----------------------------
    for (const definition of ROLE_DEFINITIONS) {
      const role = await prisma.role.upsert({
        where: { key: definition.key },
        update: { name: definition.name, description: definition.description },
        create: {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          isSystem: true,
        },
      });

      const permissions = await prisma.permission.findMany({
        where: { key: { in: [...definition.permissions] } },
        select: { id: true },
      });

      for (const permission of permissions) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }

      // Drop grants that are no longer in the definition, so removing a
      // permission from the catalogue actually takes it away.
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionId: { notIn: permissions.map((item) => item.id) },
        },
      });

      console.info(
        `  ✓ ${definition.key.padEnd(18)} ${permissions.length} permissions`,
      );
    }

    // --- users ----------------------------------------------------------
    for (const seed of SEED_USERS) {
      const user = await prisma.user.upsert({
        where: { mobile: seed.mobile },
        update: { status: seed.blocked ? "BLOCKED" : "ACTIVE" },
        create: {
          mobile: seed.mobile,
          status: seed.blocked ? "BLOCKED" : "ACTIVE",
        },
      });

      for (const roleKey of seed.roles) {
        const role = await prisma.role.findUnique({ where: { key: roleKey } });
        if (!role) continue;
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
          update: {},
          create: { userId: user.id, roleId: role.id },
        });
      }

      console.info(
        `  ✓ ${seed.mobile}  ${seed.note} — ${seed.roles.join(", ")}`,
      );
    }

    console.info(
      "\nSign in at /login — the code is printed by the dev server.\n",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
