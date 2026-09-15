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

    // --- people ---------------------------------------------------------
    //
    // The seeded accounts are joined to real Person rows here, because that is
    // what scope resolves through: a coach reaches teams via StaffTeam, a
    // guardian reaches children via PlayerGuardian.

    /** A structurally valid national code. Fabricated — no real person's. */
    function nationalCode(nine: string): string {
      const sum = [...nine].reduce(
        (total, digit, index) => total + Number(digit) * (10 - index),
        0,
      );
      const remainder = sum % 11;
      const check = remainder < 2 ? remainder : 11 - remainder;
      return `${nine}${check}`;
    }

    const userByMobile = new Map<string, string>();
    for (const seed of SEED_USERS) {
      const found = await prisma.user.findUnique({
        where: { mobile: seed.mobile },
        select: { id: true },
      });
      if (found) userByMobile.set(seed.mobile, found.id);
    }

    const teams = await prisma.team.findMany({
      where: { sportId: football.id },
      include: { ageGroup: true },
      orderBy: { ageGroup: { minAge: "asc" } },
    });
    const u14 = teams.find((team) => team.ageGroup.code === "U14")!;
    const u16 = teams.find((team) => team.ageGroup.code === "U16")!;

    // --- coach -----------------------------------------------------------
    const coachPerson = await prisma.person.upsert({
      where: { nationalCode: nationalCode("100000001") },
      update: {},
      create: {
        firstName: "رضا",
        lastName: "محمدی",
        nationalCode: nationalCode("100000001"),
        gender: "MALE",
        city: "اصفهان",
        userId: userByMobile.get("09120000003") ?? null,
        staff: { create: { title: "سرمربی", status: "ACTIVE" } },
      },
      include: { staff: true },
    });

    if (coachPerson.staff) {
      // Assigned to U14 only — the scope tests rely on U16 being out of reach.
      await prisma.staffTeam.upsert({
        where: {
          staffId_teamId: { staffId: coachPerson.staff.id, teamId: u14.id },
        },
        update: { unassignedAt: null },
        create: {
          staffId: coachPerson.staff.id,
          teamId: u14.id,
          role: "HEAD_COACH",
        },
      });
    }

    // A second coach, on U16, so "another coach's team" is a real thing.
    const otherCoach = await prisma.person.upsert({
      where: { nationalCode: nationalCode("100000002") },
      update: {},
      create: {
        firstName: "حسین",
        lastName: "کریمی",
        nationalCode: nationalCode("100000002"),
        gender: "MALE",
        staff: { create: { title: "سرمربی", status: "ACTIVE" } },
      },
      include: { staff: true },
    });

    if (otherCoach.staff) {
      await prisma.staffTeam.upsert({
        where: {
          staffId_teamId: { staffId: otherCoach.staff.id, teamId: u16.id },
        },
        update: { unassignedAt: null },
        create: {
          staffId: otherCoach.staff.id,
          teamId: u16.id,
          role: "HEAD_COACH",
        },
      });
    }

    console.info("  \u2713 2 staff (assigned to U14 and U16)");

    // --- players ---------------------------------------------------------
    const samplePlayers = [
      {
        firstName: "علی",
        lastName: "رضایی",
        nine: "200000001",
        birthYear: 1392,
        userMobile: "09120000004",
      },
      {
        firstName: "محمد",
        lastName: "حسینی",
        nine: "200000002",
        birthYear: 1392,
        userMobile: null,
      },
      {
        firstName: "امیر",
        lastName: "نوری",
        nine: "200000003",
        birthYear: 1390,
        userMobile: null,
      },
      {
        firstName: "سینا",
        lastName: "احمدی",
        nine: "200000004",
        birthYear: 1394,
        userMobile: null,
      },
    ];

    let sequence = 1;
    const createdPlayers: string[] = [];

    for (const sample of samplePlayers) {
      const code = nationalCode(sample.nine);
      const existing = await prisma.person.findUnique({
        where: { nationalCode: code },
        include: { player: true },
      });

      if (existing?.player) {
        createdPlayers.push(existing.player.id);
        continue;
      }

      const person = await prisma.person.create({
        data: {
          firstName: sample.firstName,
          lastName: sample.lastName,
          nationalCode: code,
          // Nowruz-safe: mid-year, so the Jalali year is unambiguous.
          dateOfBirth: new Date(Date.UTC(sample.birthYear + 621, 7, 15, 9)),
          gender: "MALE",
          city: "اصفهان",
          userId: sample.userMobile
            ? (userByMobile.get(sample.userMobile) ?? null)
            : null,
          player: {
            create: {
              playerCode: `SEP-${season.startYear}-${String(sequence++).padStart(4, "0")}`,
            },
          },
        },
        include: { player: true },
      });

      if (person.player) createdPlayers.push(person.player.id);
    }

    console.info(`  \u2713 ${createdPlayers.length} players`);

    // --- guardian --------------------------------------------------------
    const guardianPerson = await prisma.person.upsert({
      where: { nationalCode: nationalCode("300000001") },
      update: {},
      create: {
        firstName: "مریم",
        lastName: "رضایی",
        nationalCode: nationalCode("300000001"),
        gender: "FEMALE",
        userId: userByMobile.get("09120000005") ?? null,
        guardian: { create: { occupation: "معلم" } },
      },
      include: { guardian: true },
    });

    // Linked to the first player only — the parent-access test checks that the
    // second player stays out of reach.
    if (guardianPerson.guardian && createdPlayers[0]) {
      await prisma.playerGuardian.upsert({
        where: {
          playerId_guardianId: {
            playerId: createdPlayers[0],
            guardianId: guardianPerson.guardian.id,
          },
        },
        update: {},
        create: {
          playerId: createdPlayers[0],
          guardianId: guardianPerson.guardian.id,
          relation: "MOTHER",
          isPrimary: true,
        },
      });
    }

    console.info("  \u2713 1 guardian (linked to 1 player)");

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
