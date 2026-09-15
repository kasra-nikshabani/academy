import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

/**
 * Development seed.
 *
 * Every value here is fabricated. Real player, guardian or staff data must
 * never enter this repository (CLAUDE.md §29).
 *
 * Phase 2 seeds accounts only — roles and permissions arrive with Phase 3, so
 * the labels below are just reminders of who each account will become.
 */
const SEED_USERS = [
  { mobile: "09120000001", note: "admin" },
  { mobile: "09120000002", note: "academy manager" },
  { mobile: "09120000003", note: "coach" },
  { mobile: "09120000004", note: "player" },
  { mobile: "09120000005", note: "parent" },
  {
    mobile: "09120000009",
    note: "blocked account, for testing",
    blocked: true,
  },
] as const;

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    for (const seed of SEED_USERS) {
      const user = await prisma.user.upsert({
        where: { mobile: seed.mobile },
        update: {},
        create: {
          mobile: seed.mobile,
          status: "blocked" in seed && seed.blocked ? "BLOCKED" : "ACTIVE",
        },
      });
      console.info(
        `  ✓ ${seed.mobile.padEnd(12)} ${seed.note} (${user.status})`,
      );
    }

    console.info(`\nSeeded ${SEED_USERS.length} accounts.`);
    console.info(
      "Sign in at /login — the code is printed by the dev server.\n",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
