import { Client } from "pg";

/**
 * Direct SQL for end-to-end test setup.
 *
 * The Prisma client is generated as ESM and cannot be loaded by Playwright's
 * CommonJS test runner, and these helpers only need a couple of statements —
 * so the tests talk to Postgres directly rather than bending the runtime.
 */
async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env["DATABASE_URL"] });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** An ACTIVE account with no codes outstanding. */
export async function resetUser(mobile: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(`DELETE FROM "OtpCode" WHERE "mobile" = $1`, [mobile]);
    await client.query(
      `INSERT INTO "User" ("id", "mobile", "status", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'ACTIVE', now(), now())
       ON CONFLICT ("mobile") DO UPDATE SET "status" = 'ACTIVE'`,
      [mobile],
    );
  });
}

export async function removeUser(mobile: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(`DELETE FROM "OtpCode" WHERE "mobile" = $1`, [mobile]);
    await client.query(`DELETE FROM "User" WHERE "mobile" = $1`, [mobile]);
  });
}

/**
 * Replaces the hash on the pending code with one the test knows.
 *
 * The real code is hashed before storage and never returned by the API, so a
 * browser test cannot read it. Everything else in the flow — the form, both
 * endpoints, the cookie, the redirect — runs for real.
 */
export async function plantCodeHash(
  mobile: string,
  codeHash: string,
): Promise<void> {
  const updated = await withClient(async (client) =>
    client.query(
      `UPDATE "OtpCode"
          SET "codeHash" = $2, "attempts" = 0
        WHERE "id" = (
          SELECT "id" FROM "OtpCode"
           WHERE "mobile" = $1 AND "consumedAt" IS NULL
           ORDER BY "createdAt" DESC
           LIMIT 1
        )`,
      [mobile, codeHash],
    ),
  );

  if (updated.rowCount === 0) {
    throw new Error(`no pending code for ${mobile}`);
  }
}

/**
 * Creates a throwaway account holding the given roles.
 *
 * Tests run in parallel, and OTP rate limits are per mobile number — two tests
 * signing in as the same seeded account race each other into a cooldown. Each
 * test gets its own number instead, so nothing is shared between workers.
 */
export async function createUserWithRoles(
  mobile: string,
  roleKeys: readonly string[],
): Promise<void> {
  await withClient(async (client) => {
    await client.query(`DELETE FROM "OtpCode" WHERE "mobile" = $1`, [mobile]);
    await client.query(
      `INSERT INTO "User" ("id", "mobile", "status", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'ACTIVE', now(), now())
       ON CONFLICT ("mobile") DO UPDATE SET "status" = 'ACTIVE'`,
      [mobile],
    );

    const { rows } = await client.query<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "mobile" = $1`,
      [mobile],
    );
    const userId = rows[0]?.id;
    if (!userId) throw new Error(`could not create ${mobile}`);

    await client.query(`DELETE FROM "UserRole" WHERE "userId" = $1`, [userId]);

    for (const key of roleKeys) {
      await client.query(
        `INSERT INTO "UserRole" ("id", "userId", "roleId", "assignedAt")
         SELECT gen_random_uuid()::text, $1, r."id", now()
           FROM "Role" r WHERE r."key" = $2::"RoleKey"
         ON CONFLICT ("userId", "roleId") DO NOTHING`,
        [userId, key],
      );
    }
  });
}

/** Removes a sport a test created, so the dev database does not accumulate. */
export async function removeSport(slug: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM "Team" WHERE "sportId" IN (SELECT id FROM "Sport" WHERE slug = $1)`,
      [slug],
    );
    await client.query(
      `DELETE FROM "School" WHERE "sportId" IN (SELECT id FROM "Sport" WHERE slug = $1)`,
      [slug],
    );
    await client.query(
      `DELETE FROM "AgeGroup" WHERE "sportId" IN (SELECT id FROM "Sport" WHERE slug = $1)`,
      [slug],
    );
    await client.query(`DELETE FROM "Sport" WHERE slug = $1`, [slug]);
  });
}

/**
 * Test people are created without a national code.
 *
 * An earlier version derived one from the process id, which meant the value
 * repeated once a pid was recycled and the unique constraint fired — as an
 * intermittent failure several runs later. The column is nullable and nothing
 * here asserts on it, so the simplest fix is not to set it.
 */

let personSequence = 0;

async function insertPlayer(client: Client, label: string): Promise<string> {
  personSequence += 1;
  const unique = `${(process.pid % 1000).toString().padStart(3, "0")}${personSequence
    .toString()
    .padStart(3, "0")}`;

  const { rows } = await client.query<{ id: string }>(
    `WITH p AS (
       INSERT INTO "Person" ("id","firstName","lastName","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $3, now(), now())
       RETURNING id
     )
     INSERT INTO "Player" ("id","personId","playerCode","status","joinedAt","createdAt","updatedAt")
     SELECT gen_random_uuid()::text, p.id, $2, 'ACTIVE', now(), now(), now() FROM p
     RETURNING "Player".id`,
    [
      label,
      `E2E-${unique}-${Date.now() % 100000}`,
      // Unique surname, so an assertion on a name cannot match another run's
      // leftovers.
      `ت${unique}${Date.now() % 10000}`,
    ],
  );
  return rows[0]!.id;
}

/**
 * A guardian account linked to one child, plus an unrelated child.
 *
 * The second id is the point: it is what the parent must not be able to reach
 * by editing the URL.
 */
export async function createParentWithChild(mobile: string): Promise<{
  ownChildId: string;
  strangerChildId: string;
}> {
  return withClient(async (client) => {
    await client.query(`DELETE FROM "OtpCode" WHERE "mobile" = $1`, [mobile]);
    await client.query(
      `INSERT INTO "User" ("id","mobile","status","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'ACTIVE', now(), now())
       ON CONFLICT ("mobile") DO UPDATE SET "status" = 'ACTIVE'`,
      [mobile],
    );
    const { rows: userRows } = await client.query<{ id: string }>(
      `SELECT id FROM "User" WHERE mobile = $1`,
      [mobile],
    );
    const userId = userRows[0]!.id;

    await client.query(`DELETE FROM "UserRole" WHERE "userId" = $1`, [userId]);
    await client.query(
      `INSERT INTO "UserRole" ("id","userId","roleId","assignedAt")
       SELECT gen_random_uuid()::text, $1, r.id, now() FROM "Role" r WHERE r.key = 'PARENT'`,
      [userId],
    );

    const { rows: guardianRows } = await client.query<{ id: string }>(
      `WITH p AS (
         INSERT INTO "Person" ("id","firstName","lastName","userId","createdAt","updatedAt")
         VALUES (gen_random_uuid()::text, 'ولی', 'آزمایشی', $1, now(), now())
         RETURNING id
       )
       INSERT INTO "Guardian" ("id","personId","createdAt","updatedAt")
       SELECT gen_random_uuid()::text, p.id, now(), now() FROM p
       RETURNING "Guardian".id`,
      [userId],
    );
    const guardianId = guardianRows[0]!.id;

    const ownChildId = await insertPlayer(client, "فرزند");
    const strangerChildId = await insertPlayer(client, "بیگانه");

    await client.query(
      `INSERT INTO "PlayerGuardian" ("id","playerId","guardianId","relation","isPrimary","createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'MOTHER', true, now())`,
      [ownChildId, guardianId],
    );

    return { ownChildId, strangerChildId };
  });
}

/**
 * A coach assigned to a team of their own, with one player in that squad and
 * one in a different team.
 *
 * The teams are created per call rather than reusing the seeded U14/U16. An
 * earlier version added players to the shared squads on every run, so a
 * coach's scope grew without bound across runs and assertions that page
 * through it eventually broke — intermittently, which is the worst kind.
 */
export async function createCoachWithSquad(mobile: string): Promise<{
  teamId: string;
  squadPlayerId: string;
  otherTeamPlayerId: string;
}> {
  return withClient(async (client) => {
    await client.query(`DELETE FROM "OtpCode" WHERE "mobile" = $1`, [mobile]);
    await client.query(
      `INSERT INTO "User" ("id","mobile","status","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'ACTIVE', now(), now())
       ON CONFLICT ("mobile") DO UPDATE SET "status" = 'ACTIVE'`,
      [mobile],
    );
    const { rows: userRows } = await client.query<{ id: string }>(
      `SELECT id FROM "User" WHERE mobile = $1`,
      [mobile],
    );
    const userId = userRows[0]!.id;

    await client.query(`DELETE FROM "UserRole" WHERE "userId" = $1`, [userId]);
    await client.query(
      `INSERT INTO "UserRole" ("id","userId","roleId","assignedAt")
       SELECT gen_random_uuid()::text, $1, r.id, now() FROM "Role" r WHERE r.key = 'STAFF'`,
      [userId],
    );

    personSequence += 1;
    const unique = `${(process.pid % 1000).toString().padStart(3, "0")}${personSequence
      .toString()
      .padStart(3, "0")}${Date.now() % 100000}`;

    const { rows: staffRows } = await client.query<{ id: string }>(
      `WITH p AS (
         INSERT INTO "Person" ("id","firstName","lastName","userId","createdAt","updatedAt")
         VALUES (gen_random_uuid()::text, 'مربی', 'آزمایشی', $1, now(), now())
         RETURNING id
       )
       INSERT INTO "Staff" ("id","personId","status","createdAt","updatedAt")
       SELECT gen_random_uuid()::text, p.id, 'ACTIVE', now(), now() FROM p
       RETURNING "Staff".id`,
      [userId],
    );
    const staffId = staffRows[0]!.id;

    // Two teams that belong to this test alone.
    const { rows: bandRows } = await client.query<{
      id: string;
      sportId: string;
    }>(
      `SELECT ag.id, ag."sportId" FROM "AgeGroup" ag
         JOIN "Sport" s ON s.id = ag."sportId"
        WHERE s.slug = 'football' AND ag.code = 'U14' LIMIT 1`,
    );
    const band = bandRows[0]!;

    const teamIds: string[] = [];
    for (const suffix of ["own", "other"]) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO "Team" ("id","sportId","ageGroupId","slug","name","isActive","createdAt","updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, true, now(), now())
         RETURNING id`,
        [
          band.sportId,
          band.id,
          `e2e-${unique}-${suffix}`,
          `تیم آزمایشی ${suffix === "own" ? "خودی" : "دیگر"} ${unique}`,
        ],
      );
      teamIds.push(rows[0]!.id);
    }
    const [teamId, otherTeamId] = teamIds as [string, string];

    await client.query(
      `INSERT INTO "StaffTeam" ("id","staffId","teamId","role","assignedAt","createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'HEAD_COACH', now(), now())`,
      [staffId, teamId],
    );

    const { rows: seasonRows } = await client.query<{ id: string }>(
      `SELECT id FROM "Season" WHERE status = 'ACTIVE' LIMIT 1`,
    );
    const seasonId = seasonRows[0]!.id;

    const squadPlayerId = await insertPlayer(client, "هم‌تیمی");
    const otherTeamPlayerId = await insertPlayer(client, "تیم‌دیگر");

    for (const [playerId, team] of [
      [squadPlayerId, teamId],
      [otherTeamPlayerId, otherTeamId],
    ] as const) {
      await client.query(
        `INSERT INTO "TeamMembership"
           ("id","playerId","teamId","seasonId","status","isPrimary","joinedAt","createdAt","updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'ACTIVE', true, now(), now(), now())`,
        [playerId, team, seasonId],
      );
    }

    return { teamId, squadPlayerId, otherTeamPlayerId };
  });
}

/** A player born in a given Jalali year, for age-band assertions. */
export async function createPlayerBornIn(jalaliYear: number): Promise<string> {
  return withClient(async (client) => {
    personSequence += 1;
    const unique = `${(process.pid % 1000).toString().padStart(3, "0")}${personSequence
      .toString()
      .padStart(3, "0")}`;

    const { rows } = await client.query<{ id: string }>(
      `WITH p AS (
         INSERT INTO "Person" ("id","firstName","lastName","dateOfBirth","createdAt","updatedAt")
         VALUES (gen_random_uuid()::text, 'سن', $3, $1, now(), now())
         RETURNING id
       )
       INSERT INTO "Player" ("id","personId","playerCode","status","joinedAt","createdAt","updatedAt")
       SELECT gen_random_uuid()::text, p.id, $2, 'ACTIVE', now(), now(), now() FROM p
       RETURNING "Player".id`,
      [
        // Mid-year, so the Jalali year is unambiguous either side of Nowruz.
        new Date(Date.UTC(jalaliYear + 621, 7, 15, 9)),
        `AGE-${unique}-${Date.now() % 100000}`,
        `ت${unique}${Date.now() % 10000}`,
      ],
    );
    return rows[0]!.id;
  });
}

/** Removes a membership a test created, so seeded squads stay as seeded. */
export async function removeMembership(
  playerId: string,
  teamId: string,
): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM "TeamMembership" WHERE "playerId" = $1 AND "teamId" = $2`,
      [playerId, teamId],
    );
  });
}
