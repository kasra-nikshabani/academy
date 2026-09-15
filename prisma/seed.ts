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

    // --- academy structure ----------------------------------------------
    const football = await prisma.sport.upsert({
      where: { slug: "football" },
      update: { name: "فوتبال", nameEn: "Football", displayOrder: 1 },
      create: {
        slug: "football",
        name: "فوتبال",
        nameEn: "Football",
        description: "رشته اصلی آکادمی",
        displayOrder: 1,
      },
    });

    const volleyball = await prisma.sport.upsert({
      where: { slug: "volleyball" },
      update: { name: "والیبال", nameEn: "Volleyball", displayOrder: 2 },
      create: {
        slug: "volleyball",
        name: "والیبال",
        nameEn: "Volleyball",
        displayOrder: 2,
      },
    });

    console.info("  ✓ 2 sports");

    // Bands are stored as ages; the birth years they admit are derived from
    // the active season (docs/BUSINESS_RULES.md §4).
    const bands = [
      { code: "U12", name: "نونهالان", minAge: 10, maxAge: 11, order: 1 },
      { code: "U14", name: "نوجوانان", minAge: 12, maxAge: 13, order: 2 },
      { code: "U16", name: "نوجوانان بزرگ", minAge: 14, maxAge: 15, order: 3 },
      { code: "U18", name: "جوانان", minAge: 16, maxAge: 17, order: 4 },
      { code: "U21", name: "امید", minAge: 18, maxAge: 20, order: 5 },
    ];

    for (const band of bands) {
      await prisma.ageGroup.upsert({
        where: { sportId_code: { sportId: football.id, code: band.code } },
        update: {
          name: band.name,
          minAge: band.minAge,
          maxAge: band.maxAge,
          displayOrder: band.order,
        },
        create: {
          sportId: football.id,
          code: band.code,
          name: band.name,
          minAge: band.minAge,
          maxAge: band.maxAge,
          displayOrder: band.order,
        },
      });
    }
    console.info(`  \u2713 ${bands.length} age groups (football)`);

    // A second sport with its own bands — proof the structure is not
    // football-shaped.
    for (const band of [
      { code: "U15", name: "نوجوانان", minAge: 13, maxAge: 14, order: 1 },
      { code: "U18", name: "جوانان", minAge: 16, maxAge: 17, order: 2 },
    ]) {
      await prisma.ageGroup.upsert({
        where: { sportId_code: { sportId: volleyball.id, code: band.code } },
        update: {},
        create: {
          sportId: volleyball.id,
          code: band.code,
          name: band.name,
          minAge: band.minAge,
          maxAge: band.maxAge,
          displayOrder: band.order,
        },
      });
    }

    const season = await prisma.season.upsert({
      where: { name: "۱۴۰۴-۱۴۰۵" },
      update: { startYear: 1405, status: "ACTIVE" },
      create: {
        name: "۱۴۰۴-۱۴۰۵",
        startYear: 1405,
        // Seasons run Mordad to Khordad; stored UTC, shown Jalali.
        startDate: new Date("2026-07-23T00:00:00Z"),
        endDate: new Date("2027-06-21T00:00:00Z"),
        status: "ACTIVE",
      },
    });

    await prisma.season.updateMany({
      where: { status: "ACTIVE", id: { not: season.id } },
      data: { status: "COMPLETED" },
    });

    await prisma.season.upsert({
      where: { name: "۱۴۰۳-۱۴۰۴" },
      update: {},
      create: {
        name: "۱۴۰۳-۱۴۰۴",
        startYear: 1404,
        startDate: new Date("2025-07-23T00:00:00Z"),
        endDate: new Date("2026-06-21T00:00:00Z"),
        status: "COMPLETED",
      },
    });
    console.info(`  \u2713 2 seasons (active: ${season.name})`);

    await prisma.school.upsert({
      where: { slug: "football-school-isfahan" },
      update: {},
      create: {
        sportId: football.id,
        slug: "football-school-isfahan",
        name: "مدرسه فوتبال سپاهان — اصفهان",
        description: "مدرسه پایه آکادمی",
        city: "اصفهان",
      },
    });
    console.info("  \u2713 1 school");

    const footballBands = await prisma.ageGroup.findMany({
      where: { sportId: football.id },
    });

    for (const band of footballBands) {
      await prisma.team.upsert({
        where: { slug: `football-${band.code.toLowerCase()}` },
        update: { name: `فوتبال ${band.code}` },
        create: {
          sportId: football.id,
          ageGroupId: band.id,
          slug: `football-${band.code.toLowerCase()}`,
          name: `فوتبال ${band.code}`,
        },
      });
    }
    console.info(`  \u2713 ${footballBands.length} teams`);

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
