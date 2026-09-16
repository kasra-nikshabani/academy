import { Client } from "pg";

/**
 * Removes everything the E2E fixtures created.
 *
 * Fixtures build their own accounts, teams and players so tests never lean on
 * shared state. Without this they also never go away: a run was leaving about
 * twenty players behind, and after enough runs the squads and counts other
 * tests assert on had drifted far enough to fail intermittently.
 *
 * Seeded data is identified positively and left alone: accounts on
 * `0912000xxxx`, teams named `football-*`, and players coded `SEP-*`.
 *
 * Order matters. Teams and schools are `Restrict`-referenced by memberships
 * and enrolments, so the people go first — deleting a `Person` cascades to
 * their player, guardian or staff record and everything hanging off it — and
 * the now-unreferenced teams follow.
 */
export default async function globalTeardown(): Promise<void> {
  const client = new Client({ connectionString: process.env["DATABASE_URL"] });
  await client.connect();

  try {
    // 1. People created by fixtures, or through the API by a test.
    //
    // A player created through the API gets a real `SEP-` code, so the code
    // cannot tell them apart from a seeded player. The seed always assigns a
    // national code and tests never do, so that is the discriminator — see the
    // note in prisma/seed.ts.
    await client.query(`
      DELETE FROM "Person"
       WHERE "nationalCode" IS NULL
         AND id IN (SELECT "personId" FROM "Player")
    `);
    await client.query(`DELETE FROM "Person" WHERE "lastName" = 'آزمایشی'`);

    // 2. Anything still pointing at a fixture team, then the team itself.
    //
    // Journey events include the ones written onto a *seeded* player by a test
    // that moved them into a fixture team. Those events are correct to keep in
    // production — an event outlives the team it mentions — but here they are
    // residue, and they show up on a seeded player's timeline.
    await client.query(`
      DELETE FROM "PlayerJourneyEvent"
       WHERE "teamId" IN (SELECT id FROM "Team" WHERE slug LIKE 'e2e-%')
    `);

    // Training sessions hold their team with `Restrict`, so they have to go
    // before the team does. Plans would cascade with the team, but are
    // removed explicitly so a session's `planId` is never the reason a delete
    // is refused.
    await client.query(`
      DELETE FROM "TrainingSession"
       WHERE "teamId" IN (SELECT id FROM "Team" WHERE slug LIKE 'e2e-%')
    `);
    await client.query(`
      DELETE FROM "TrainingPlan"
       WHERE "teamId" IN (SELECT id FROM "Team" WHERE slug LIKE 'e2e-%')
    `);
    await client.query(`
      DELETE FROM "TeamMembership"
       WHERE "teamId" IN (SELECT id FROM "Team" WHERE slug LIKE 'e2e-%')
    `);
    await client.query(`
      DELETE FROM "StaffTeam"
       WHERE "teamId" IN (SELECT id FROM "Team" WHERE slug LIKE 'e2e-%')
    `);
    await client.query(`DELETE FROM "Team" WHERE slug LIKE 'e2e-%'`);

    // 3. Accounts a fixture signed in as.
    await client.query(`DELETE FROM "User" WHERE mobile NOT LIKE '0912000%'`);
  } finally {
    await client.end();
  }
}
