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
