import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import {
  resolveScheduleTeamIds,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import * as training from "@/lib/services/training.service";

async function authorizedUser(mobile: string): Promise<AuthorizedUser> {
  const account = await prisma.user.findUniqueOrThrow({ where: { mobile } });
  const { roles, permissionKeys } = await findUserAuthorization(account.id);
  const known = new Set<string>(ALL_PERMISSIONS);

  return {
    id: account.id,
    mobile: account.mobile,
    roles,
    permissions: permissionKeys.filter((key): key is Permission =>
      known.has(key),
    ),
  };
}

let admin: AuthorizedUser;
let coach: AuthorizedUser;
let parent: AuthorizedUser;
let player: AuthorizedUser;

let u14Id: string;
let u16Id: string;

const createdSessions: string[] = [];
const createdPlans: string[] = [];

/**
 * A slot inside the active season but far from the week the seed fills.
 *
 * Every call returns a different day, so one test's session can never be the
 * reason another test's clash check fires.
 */
let slot = 0;
function nextSlot(): Date {
  slot += 1;
  return new Date(Date.UTC(2027, 2, 1, 6, 0) + slot * 24 * 60 * 60 * 1000);
}

async function createSession(
  caller: AuthorizedUser,
  teamId: string,
  startsAt: Date,
  extra: { durationMinutes?: number } = {},
) {
  const session = await training.createTrainingSession(caller, {
    teamId,
    startsAt,
    durationMinutes: extra.durationMinutes ?? 90,
    type: "TECHNICAL",
    status: "SCHEDULED",
  });
  createdSessions.push(session.id);
  return session;
}

beforeAll(async () => {
  [admin, coach, parent, player] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000003"),
    authorizedUser("09120000005"),
    authorizedUser("09120000004"),
  ]);

  u14Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u14" } })
  ).id;
  u16Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u16" } })
  ).id;
});

afterAll(async () => {
  if (createdSessions.length > 0) {
    await prisma.trainingSession.deleteMany({
      where: { id: { in: createdSessions } },
    });
  }
  if (createdPlans.length > 0) {
    await prisma.trainingSession.updateMany({
      where: { planId: { in: createdPlans } },
      data: { planId: null },
    });
    await prisma.trainingPlan.deleteMany({
      where: { id: { in: createdPlans } },
    });
  }
});

describe("writing training needs both a permission and the team", () => {
  it("refuses a player without training:write", async () => {
    await expect(
      training.createTrainingSession(player, {
        teamId: u14Id,
        startsAt: nextSlot(),
        durationMinutes: 90,
        type: "MIXED",
        status: "SCHEDULED",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a coach write for the team they are assigned to", async () => {
    const startsAt = nextSlot();
    const session = await createSession(coach, u14Id, startsAt, {
      durationMinutes: 105,
    });

    expect(session.teamId).toBe(u14Id);
    expect(session.endsAt.getTime() - session.startsAt.getTime()).toBe(
      105 * 60 * 1000,
    );
    // The season is resolved from the date, not from whatever is active.
    expect(session.season.name).toBe("۱۴۰۴-۱۴۰۵");
  });

  /** The line PERMISSIONS §5 draws: the permission is not the licence. */
  it("refuses a coach another team, with the same permission in hand", async () => {
    await expect(createSession(coach, u16Id, nextSlot())).rejects.toMatchObject(
      { code: "OUT_OF_SCOPE" },
    );
  });

  it("lets an administrator write for any team", async () => {
    const session = await createSession(admin, u16Id, nextSlot());
    expect(session.teamId).toBe(u16Id);
  });
});

describe("a squad cannot be in two places at once", () => {
  it("refuses a session that overlaps another of the same team", async () => {
    const startsAt = nextSlot();
    await createSession(admin, u14Id, startsAt, { durationMinutes: 90 });

    // Starts half an hour in.
    const overlapping = new Date(startsAt.getTime() + 30 * 60 * 1000);
    await expect(
      createSession(admin, u14Id, overlapping),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows back-to-back sessions", async () => {
    const startsAt = nextSlot();
    const first = await createSession(admin, u14Id, startsAt, {
      durationMinutes: 90,
    });

    const second = await createSession(admin, u14Id, first.endsAt);
    expect(second.startsAt.getTime()).toBe(first.endsAt.getTime());
  });

  it("does not let one team's session block another's", async () => {
    const startsAt = nextSlot();
    await createSession(admin, u14Id, startsAt);
    const other = await createSession(admin, u16Id, startsAt);
    expect(other.teamId).toBe(u16Id);
  });

  it("frees the slot again once a session is cancelled", async () => {
    const startsAt = nextSlot();
    const first = await createSession(admin, u14Id, startsAt);

    await training.cancelTrainingSession(admin, first.id, "زمین در دسترس نبود");

    const replacement = await createSession(admin, u14Id, startsAt);
    expect(replacement.id).not.toBe(first.id);
  });
});

describe("the season comes from the session's own date", () => {
  it("refuses a date that falls in no season at all", async () => {
    await expect(
      training.createTrainingSession(admin, {
        teamId: u14Id,
        // Long after every seeded season.
        startsAt: new Date(Date.UTC(2035, 0, 10, 12, 0)),
        durationMinutes: 90,
        type: "MIXED",
        status: "SCHEDULED",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("a session is cancelled, never deleted", () => {
  it("keeps the row and the reason", async () => {
    const session = await createSession(admin, u14Id, nextSlot());
    const cancelled = await training.cancelTrainingSession(
      admin,
      session.id,
      "بارندگی",
    );

    expect(cancelled.status).toBe("CANCELLED");

    const stored = await training.getTrainingSession(admin, session.id);
    expect(stored.cancelReason).toBe("بارندگی");
  });

  it("refuses to cancel the same session twice", async () => {
    const session = await createSession(admin, u14Id, nextSlot());
    await training.cancelTrainingSession(admin, session.id);

    await expect(
      training.cancelTrainingSession(admin, session.id),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses to edit a cancelled session", async () => {
    const session = await createSession(admin, u14Id, nextSlot());
    await training.cancelTrainingSession(admin, session.id);

    await expect(
      training.updateTrainingSession(admin, session.id, { notes: "تغییر" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  /**
   * A held session's date is part of the record of what happened — and from
   * Phase 9 it is what attendance hangs on.
   */
  it("refuses to move a session that has already been held", async () => {
    const session = await createSession(admin, u14Id, nextSlot());
    await training.updateTrainingSession(admin, session.id, {
      status: "COMPLETED",
    });

    await expect(
      training.updateTrainingSession(admin, session.id, {
        startsAt: nextSlot(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Its notes are still writable — that is the coach's record of the session.
    const noted = await training.updateTrainingSession(admin, session.id, {
      notes: "تمرکز خوب، پاس‌کاری ضعیف",
    });
    expect(noted.notes).toContain("پاس‌کاری");
  });

  it("lets a scheduled session be moved, and checks the new slot", async () => {
    const first = await createSession(admin, u14Id, nextSlot());
    const second = await createSession(admin, u14Id, nextSlot());

    // Moving `second` onto `first` must be refused.
    await expect(
      training.updateTrainingSession(admin, second.id, {
        startsAt: first.startsAt,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const moved = await training.updateTrainingSession(admin, second.id, {
      startsAt: nextSlot(),
      durationMinutes: 60,
    });
    expect(moved.endsAt.getTime() - moved.startsAt.getTime()).toBe(
      60 * 60 * 1000,
    );
  });
});

describe("reading the calendar reaches further than writing it", () => {
  it("gives a parent the teams their child trains with", async () => {
    const teamIds = await resolveScheduleTeamIds(parent);
    expect(teamIds).toContain(u14Id);
    expect(teamIds).not.toContain(u16Id);
  });

  /**
   * The reason this is a second function and not a widening of `ScopeFilter`:
   * a parent may see when their child trains without seeing who else is in
   * the squad (docs/PRODUCT_SPEC.md §8).
   */
  it("does not widen the parent's team scope for anything else", async () => {
    const scope = await resolveScope(parent);
    expect(scope.teamIds).toEqual([]);
  });

  it("lets a parent read their child's team sessions", async () => {
    const session = await createSession(admin, u14Id, nextSlot());
    await expect(
      training.getTrainingSession(parent, session.id),
    ).resolves.toMatchObject({ id: session.id });
  });

  it("refuses a parent another team's session", async () => {
    const session = await createSession(admin, u16Id, nextSlot());
    await expect(
      training.getTrainingSession(parent, session.id),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("refuses a parent the write, however much of the calendar they can see", async () => {
    await expect(
      training.createTrainingSession(parent, {
        teamId: u14Id,
        startsAt: nextSlot(),
        durationMinutes: 90,
        type: "MIXED",
        status: "SCHEDULED",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  /**
   * A player who trains up an age group belongs to two squads. Their U14
   * coach must not pick up the U16 calendar through them — which is why the
   * schedule scope is built from the caller's *own* players, not from every
   * player they can see.
   */
  it("does not leak another team's calendar through a player who trains up", async () => {
    const person = await prisma.person.create({
      data: {
        firstName: "دو",
        lastName: `رده${Date.now() % 100000}`,
        dateOfBirth: new Date(Date.UTC(2013, 7, 15, 9)),
        player: { create: { playerCode: `TRN-${Date.now() % 1000000}` } },
      },
      include: { player: true },
    });
    const playerId = person.player!.id;
    const season = await prisma.season.findFirstOrThrow({
      where: { status: "ACTIVE" },
    });

    try {
      for (const teamId of [u14Id, u16Id]) {
        await prisma.teamMembership.create({
          data: { playerId, teamId, seasonId: season.id, status: "ACTIVE" },
        });
      }

      // The coach can now see this player — they are in the coach's squad.
      const scope = await resolveScope(coach);
      expect(scope.playerIds).toContain(playerId);

      // But the U16 calendar is still none of their business.
      const teamIds = await resolveScheduleTeamIds(coach);
      expect(teamIds).toContain(u14Id);
      expect(teamIds).not.toContain(u16Id);
    } finally {
      await prisma.person.delete({ where: { id: person.id } });
    }
  });

  it("narrows a coach's list to their own team, count included", async () => {
    await createSession(admin, u16Id, nextSlot());

    const { items, meta } = await training.listTrainingSessions(
      coach,
      { page: 1, pageSize: 100 },
      {},
    );

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.teamId).toBe(u14Id);
    // The total counts what the caller may see, not what exists.
    expect(meta.total).toBe(items.length);
  });
});

describe("training plans", () => {
  it("refuses a coach a plan that belongs to no team", async () => {
    await expect(
      training.createTrainingPlan(coach, {
        title: "برنامه عمومی",
        type: "PHYSICAL",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("lets an administrator write an academy-wide plan, readable by a coach", async () => {
    const plan = await training.createTrainingPlan(admin, {
      title: `برنامه آکادمی ${Date.now() % 100000}`,
      type: "PHYSICAL",
      exercises: [{ title: "دو استقامتی", durationMinutes: 20 }],
    });
    createdPlans.push(plan.id);

    await expect(
      training.getTrainingPlan(coach, plan.id),
    ).resolves.toMatchObject({ id: plan.id });

    // Reading it is not editing it.
    await expect(
      training.updateTrainingPlan(coach, plan.id, { title: "دستکاری" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("keeps a plan's exercises in the order they were written", async () => {
    const plan = await training.createTrainingPlan(coach, {
      teamId: u14Id,
      title: `برنامه فنی ${Date.now() % 100000}`,
      type: "TECHNICAL",
      exercises: [
        { title: "گرم کردن", durationMinutes: 15 },
        { title: "پاس‌کاری", durationMinutes: 25 },
        { title: "بازی کوچک", durationMinutes: 30 },
      ],
    });
    createdPlans.push(plan.id);

    expect(plan.exercises.map((exercise) => exercise.title)).toEqual([
      "گرم کردن",
      "پاس‌کاری",
      "بازی کوچک",
    ]);

    const appended = await training.addPlanExercise(coach, plan.id, {
      title: "سرد کردن",
      durationMinutes: 10,
    });
    expect(appended.displayOrder).toBe(3);

    const reread = await training.getTrainingPlan(coach, plan.id);
    expect(reread.exercises.map((exercise) => exercise.title)).toEqual([
      "گرم کردن",
      "پاس‌کاری",
      "بازی کوچک",
      "سرد کردن",
    ]);

    await training.removePlanExercise(coach, appended.id);
    const afterRemoval = await training.getTrainingPlan(coach, plan.id);
    expect(afterRemoval.exercises).toHaveLength(3);
  });

  it("refuses a coach another team's plan", async () => {
    const plan = await training.createTrainingPlan(admin, {
      teamId: u16Id,
      title: `برنامه دیگری ${Date.now() % 100000}`,
      type: "TACTICAL",
    });
    createdPlans.push(plan.id);

    await expect(
      training.getTrainingPlan(coach, plan.id),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });

    await expect(
      training.updateTrainingPlan(coach, plan.id, { title: "دستکاری" }),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("attaches a plan to a session and reads it back with the session", async () => {
    const plan = await training.createTrainingPlan(coach, {
      teamId: u14Id,
      title: `برنامه جلسه ${Date.now() % 100000}`,
      type: "MIXED",
      exercises: [{ title: "مالکیت توپ", durationMinutes: 20 }],
    });
    createdPlans.push(plan.id);

    const session = await training.createTrainingSession(coach, {
      teamId: u14Id,
      planId: plan.id,
      startsAt: nextSlot(),
      durationMinutes: 90,
      type: "MIXED",
      status: "SCHEDULED",
    });
    createdSessions.push(session.id);

    const read = await training.getTrainingSession(coach, session.id);
    expect(read.plan?.exercises[0]?.title).toBe("مالکیت توپ");
  });
});
