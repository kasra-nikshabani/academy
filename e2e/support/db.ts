import { randomInt } from "node:crypto";
import { Client } from "pg";

/**
 * Direct SQL for end-to-end test setup.
 *
 * The Prisma client is generated as ESM and cannot be loaded by Playwright's
 * CommonJS test runner, and these helpers only need a couple of statements —
 * so the tests talk to Postgres directly rather than bending the runtime.
 *
 * ## Always bind a timestamp with `utcParam`, never a `Date`
 *
 * Prisma maps `DateTime` to `timestamp without time zone` and reads it back as
 * UTC. `pg` binds a JS `Date` to that column using the **machine's local
 * offset**, so a fixture written here and read by the application comes back
 * shifted by that offset — 3½ hours on a machine set to Tehran. Every date
 * these fixtures wrote was wrong that way until a session scheduled "two hours
 * ago" was refused as being in the future.
 */

/**
 * A timestamp bound so the stored wall clock *is* the UTC time, which is how
 * Prisma will read it back. See the note above — this is not optional.
 */
function utcParam(date: Date): string {
  return date.toISOString();
}
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
  assertNotSeeded(mobile);

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
 * Seeded accounts use the 0912000xxxx range and are shared by every test.
 * A fixture that writes to one of them changes the ground other tests stand
 * on — which is exactly how a seeded coach ended up with an extra team.
 */
function assertNotSeeded(mobile: string): void {
  if (mobile.startsWith("0912000")) {
    throw new Error(
      `${mobile} is a seeded account; fixtures must create their own`,
    );
  }
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
 * Two throwaway football U14 teams, named so the teardown can find them.
 *
 * Created per call rather than reusing the seeded squads: fixtures that write
 * into shared teams grow a coach's scope a little on every run, and the
 * assertions that eventually break are in some other test entirely.
 */
async function insertTeamPair(client: Client): Promise<[string, string]> {
  personSequence += 1;
  const unique = `${(process.pid % 1000).toString().padStart(3, "0")}${personSequence
    .toString()
    .padStart(3, "0")}${Date.now() % 100000}`;

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

  return teamIds as [string, string];
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
  assertNotSeeded(mobile);

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
  staffId: string;
  teamId: string;
  otherTeamId: string;
  squadPlayerId: string;
  otherTeamPlayerId: string;
}> {
  assertNotSeeded(mobile);

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
    const [teamId, otherTeamId] = await insertTeamPair(client);

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

    return { staffId, teamId, otherTeamId, squadPlayerId, otherTeamPlayerId };
  });
}

/**
 * A guardian whose child is in a squad, plus a squad the child is not in.
 *
 * Training is the first thing a parent signs in for, and the pair of teams is
 * what proves the line: they see when their own child trains, and nothing of
 * the other squad's week.
 */
export async function createParentOfSquadPlayer(mobile: string): Promise<{
  childId: string;
  teamId: string;
  otherTeamId: string;
}> {
  assertNotSeeded(mobile);

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

    const childId = await insertPlayer(client, "فرزند");
    await client.query(
      `INSERT INTO "PlayerGuardian" ("id","playerId","guardianId","relation","isPrimary","createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'FATHER', true, now())`,
      [childId, guardianId],
    );

    const [teamId, otherTeamId] = await insertTeamPair(client);

    const { rows: seasonRows } = await client.query<{ id: string }>(
      `SELECT id FROM "Season" WHERE status = 'ACTIVE' LIMIT 1`,
    );
    await client.query(
      `INSERT INTO "TeamMembership"
         ("id","playerId","teamId","seasonId","status","isPrimary","joinedAt","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'ACTIVE', true, now(), now(), now())`,
      [childId, teamId, seasonRows[0]!.id],
    );

    return { childId, teamId, otherTeamId };
  });
}

/**
 * A training session, written straight to the database.
 *
 * Used where the session is the *setup* rather than the thing under test — a
 * parent's read, a coach's narrowed calendar. Tests that are about creating a
 * session go through the API like a coach would.
 */
export async function createTrainingSession(params: {
  teamId: string;
  startsAt: Date;
  durationMinutes?: number;
  location?: string;
}): Promise<string> {
  return withClient(async (client) => {
    const { rows: seasonRows } = await client.query<{ id: string }>(
      `SELECT id FROM "Season"
        WHERE "startDate" <= $1 AND "endDate" >= $1
        ORDER BY "startYear" DESC LIMIT 1`,
      [utcParam(params.startsAt)],
    );
    const seasonId = seasonRows[0]?.id;
    if (!seasonId) {
      throw new Error(`no season covers ${params.startsAt.toISOString()}`);
    }

    const endsAt = new Date(
      params.startsAt.getTime() + (params.durationMinutes ?? 90) * 60 * 1000,
    );

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO "TrainingSession"
         ("id","teamId","seasonId","type","status","startsAt","endsAt","location","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'TECHNICAL', 'SCHEDULED', $3, $4, $5, now(), now())
       RETURNING id`,
      [
        params.teamId,
        seasonId,
        utcParam(params.startsAt),
        utcParam(endsAt),
        params.location ?? "زمین آزمایشی",
      ],
    );
    return rows[0]!.id;
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
        utcParam(new Date(Date.UTC(jalaliYear + 621, 7, 15, 9))),
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

/**
 * Removes a player a test created, with everything hanging off them.
 *
 * Journey events are append-only in the application and cannot be deleted
 * through it — which is right for a record, and exactly why a test that
 * creates players must clear them here instead of leaving them to pile up.
 */
export async function removePlayer(playerId: string): Promise<void> {
  await withClient(async (client) => {
    const { rows } = await client.query<{ personId: string }>(
      `SELECT "personId" FROM "Player" WHERE id = $1`,
      [playerId],
    );
    const personId = rows[0]?.personId;
    if (!personId) return;

    // Person cascades to Player, and Player cascades to the rest.
    await client.query(`DELETE FROM "Person" WHERE id = $1`, [personId]);
  });
}

/**
 * A structurally valid national code reserved for tests.
 *
 * Always begins `999`, which the seed never uses — that prefix is what the
 * teardown deletes by. The public tryout form requires a national code, so
 * unlike every other fixture these people *do* have one, and the teardown's
 * usual "no national code means a test person" rule cannot see them.
 *
 * The tail is **random**, not derived from the process id. A pid-derived value
 * is not unique — Playwright runs several workers at once and their pids
 * collide modulo a thousand, which is how two tests in the same run ended up
 * registering the same child (docs/PROJECT_RULES.md §6.1).
 */
export function testNationalCode(): string {
  const tail = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const nine = `999${tail}`;

  const sum = [...nine].reduce(
    (total, digit, index) => total + Number(digit) * (10 - index),
    0,
  );
  const remainder = sum % 11;
  const check = remainder < 2 ? remainder : 11 - remainder;
  return `${nine}${check}`;
}

/** A trial belonging to this test alone, open for registration right now. */
export async function createTryout(params: {
  ageGroupCode?: string;
  status?: "OPEN" | "CLOSED" | "DRAFT";
  opensAt?: Date;
  closesAt?: Date;
}): Promise<{ id: string; slug: string }> {
  return withClient(async (client) => {
    const { rows: bandRows } = await client.query<{
      id: string;
      sportId: string;
    }>(
      `SELECT ag.id, ag."sportId" FROM "AgeGroup" ag
         JOIN "Sport" s ON s.id = ag."sportId"
        WHERE s.slug = 'football' AND ag.code = $1 LIMIT 1`,
      [params.ageGroupCode ?? "U14"],
    );
    const band = bandRows[0]!;

    const { rows: seasonRows } = await client.query<{ id: string }>(
      `SELECT id FROM "Season" WHERE status = 'ACTIVE' LIMIT 1`,
    );

    const slug = `e2e-tryout-${process.pid % 1000}-${Date.now() % 1000000}`;
    const opensAt =
      params.opensAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const closesAt =
      params.closesAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO "Tryout"
         ("id","sportId","ageGroupId","seasonId","slug","title","city","venue",
          "opensAt","closesAt","status","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,'اصفهان','زمین آزمایشی',
               $6,$7,$8,now(),now())
       RETURNING id`,
      [
        band.sportId,
        band.id,
        seasonRows[0]!.id,
        slug,
        `استعدادیابی آزمایشی ${slug}`,
        utcParam(opensAt),
        utcParam(closesAt),
        params.status ?? "OPEN",
      ],
    );

    return { id: rows[0]!.id, slug };
  });
}

/** The application a registration produced, so a test can act on it. */
export async function findApplicationByTrackingCode(
  trackingCode: string,
): Promise<{ id: string; playerId: string; status: string } | null> {
  return withClient(async (client) => {
    const { rows } = await client.query<{
      id: string;
      playerId: string;
      status: string;
    }>(
      `SELECT id, "playerId", status FROM "TryoutApplication" WHERE "trackingCode" = $1`,
      [trackingCode],
    );
    return rows[0] ?? null;
  });
}

/**
 * Hands a coach an evaluation to fill in.
 *
 * The assignment is the only route a coach has to a player they cannot
 * otherwise see, so a test that wants to exercise it has to make one
 * (docs/BUSINESS_RULES.md §16).
 */
export async function assignEvaluation(params: {
  playerId: string;
  evaluatorStaffId: string;
  applicationId?: string;
}): Promise<{ id: string; criteria: Array<{ id: string; maxScore: number }> }> {
  return withClient(async (client) => {
    const { rows: templateRows } = await client.query<{ id: string }>(
      `SELECT id FROM "EvaluationTemplate" WHERE "isActive" = true ORDER BY "createdAt" ASC LIMIT 1`,
    );
    const templateId = templateRows[0]?.id;
    if (!templateId) throw new Error("no evaluation template is seeded");

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO "Evaluation"
         ("id","playerId","templateId","evaluatorId","applicationId","status","createdAt","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'DRAFT', now(), now())
       RETURNING id`,
      [
        params.playerId,
        templateId,
        params.evaluatorStaffId,
        params.applicationId ?? null,
      ],
    );

    const { rows: criteria } = await client.query<{
      id: string;
      maxScore: number;
    }>(
      `SELECT id, "maxScore" FROM "EvaluationCriterion"
        WHERE "templateId" = $1 ORDER BY "displayOrder" ASC`,
      [templateId],
    );

    return { id: rows[0]!.id, criteria };
  });
}

/**
 * The notifications waiting for a player and their guardians.
 *
 * Reads the database rather than the API on purpose: the point of the
 * acceptance test is that the family is told, and a trial family has **no
 * account** to sign in with and read an inbox. Checking through the API would
 * only be able to test the case that is not the interesting one.
 */
export async function countNotificationsForPlayer(
  playerId: string,
): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM "Notification" n
        WHERE n."personId" IN (
          SELECT p."personId" FROM "Player" p WHERE p.id = $1
          UNION
          SELECT g."personId"
            FROM "PlayerGuardian" pg
            JOIN "Guardian" g ON g.id = pg."guardianId"
           WHERE pg."playerId" = $1
        )`,
      [playerId],
    );
    return Number(rows[0]?.count ?? 0);
  });
}
