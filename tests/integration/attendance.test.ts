import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as attendance from "@/lib/services/attendance.service";
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

let u14Id: string;
let u16Id: string;
let ownChildId: string;
let strangerChildId: string;

const createdSessions: string[] = [];

/**
 * A past slot inside the active season, far from the week the seed fills.
 *
 * Attendance is refused for a session that has not started, so every session
 * here is deliberately in the past.
 */
let slot = 0;
function pastSlot(): Date {
  slot += 1;
  return new Date(Date.UTC(2026, 7, 1, 6, 0) + slot * 24 * 60 * 60 * 1000);
}

/** A held session: created, then pushed into the past-and-completed state. */
async function heldSession(teamId: string): Promise<string> {
  const session = await training.createTrainingSession(admin, {
    teamId,
    startsAt: pastSlot(),
    durationMinutes: 90,
    type: "TECHNICAL",
    status: "SCHEDULED",
  });
  createdSessions.push(session.id);
  return session.id;
}

beforeAll(async () => {
  [admin, coach, parent] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000003"),
    authorizedUser("09120000005"),
  ]);

  u14Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u14" } })
  ).id;
  u16Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u16" } })
  ).id;

  const link = await prisma.playerGuardian.findFirstOrThrow({
    where: { guardian: { person: { userId: parent.id } } },
  });
  ownChildId = link.playerId;

  const stranger = await prisma.player.findFirstOrThrow({
    where: {
      id: { not: ownChildId },
      teamMemberships: { some: { teamId: u14Id } },
    },
  });
  strangerChildId = stranger.id;
});

afterAll(async () => {
  if (createdSessions.length === 0) return;
  // Attendance cascades with the session.
  await prisma.trainingSession.deleteMany({
    where: { id: { in: createdSessions } },
  });
});

describe("taking the register", () => {
  it("marks the whole squad present in one call", async () => {
    const sessionId = await heldSession(u14Id);

    const register = await attendance.saveAttendance(coach, sessionId, {
      defaultStatus: "PRESENT",
      entries: [],
    });

    expect(register.rows.length).toBeGreaterThan(0);
    expect(register.pending).toBe(0);
    for (const row of register.rows) expect(row.status).toBe("PRESENT");
    expect(register.totals.present).toBe(register.rows.length);
  });

  /** «همه حاضر» and then the two who were not — one request, one write. */
  it("applies the default to everyone the entries do not name", async () => {
    const sessionId = await heldSession(u14Id);

    const register = await attendance.saveAttendance(coach, sessionId, {
      defaultStatus: "PRESENT",
      entries: [
        { playerId: ownChildId, status: "LATE", minutesLate: 12 },
        { playerId: strangerChildId, status: "ABSENT", note: "بیماری" },
      ],
    });

    const own = register.rows.find((row) => row.playerId === ownChildId);
    const other = register.rows.find(
      (row) => row.playerId === strangerChildId,
    );

    expect(own?.status).toBe("LATE");
    expect(own?.minutesLate).toBe(12);
    expect(other?.status).toBe("ABSENT");
    expect(other?.note).toBe("بیماری");
    expect(register.totals.present).toBe(register.rows.length - 2);
  });

  it("is idempotent — the same register twice leaves the same result", async () => {
    const sessionId = await heldSession(u14Id);
    const body = { defaultStatus: "PRESENT" as const, entries: [] };

    const first = await attendance.saveAttendance(coach, sessionId, body);
    const second = await attendance.saveAttendance(coach, sessionId, body);

    expect(second.totals).toEqual(first.totals);
    expect(second.rows).toHaveLength(first.rows.length);
  });

  it("corrects one row without a default, leaving the rest alone", async () => {
    const sessionId = await heldSession(u14Id);
    await attendance.saveAttendance(coach, sessionId, {
      defaultStatus: "PRESENT",
      entries: [],
    });

    const corrected = await attendance.saveAttendance(coach, sessionId, {
      entries: [{ playerId: ownChildId, status: "EXCUSED", note: "اردوی مدرسه" }],
    });

    expect(
      corrected.rows.find((row) => row.playerId === ownChildId)?.status,
    ).toBe("EXCUSED");
    expect(corrected.totals.present).toBe(corrected.rows.length - 1);
  });

  /** A stale number on a player who turned out to be present is a wrong record. */
  it("clears the late minutes when the status stops being late", async () => {
    const sessionId = await heldSession(u14Id);
    await attendance.saveAttendance(coach, sessionId, {
      entries: [{ playerId: ownChildId, status: "LATE", minutesLate: 20 }],
    });

    const fixed = await attendance.saveAttendance(coach, sessionId, {
      entries: [{ playerId: ownChildId, status: "PRESENT" }],
    });

    const row = fixed.rows.find((item) => item.playerId === ownChildId);
    expect(row?.status).toBe("PRESENT");
    expect(row?.minutesLate).toBeNull();
  });

  /** Evidence the session happened, so the calendar follows the fact. */
  it("closes a scheduled session that has already been held", async () => {
    const sessionId = await heldSession(u14Id);
    expect((await training.getTrainingSession(admin, sessionId)).status).toBe(
      "SCHEDULED",
    );

    await attendance.saveAttendance(coach, sessionId, {
      defaultStatus: "PRESENT",
      entries: [],
    });

    expect((await training.getTrainingSession(admin, sessionId)).status).toBe(
      "COMPLETED",
    );
  });
});

describe("what a register may not record", () => {
  it("refuses a session that has not started", async () => {
    const future = await training.createTrainingSession(admin, {
      teamId: u14Id,
      startsAt: new Date(Date.UTC(2027, 4, 10, 6, 0)),
      durationMinutes: 90,
      type: "MIXED",
      status: "SCHEDULED",
    });
    createdSessions.push(future.id);

    await expect(
      attendance.saveAttendance(coach, future.id, {
        defaultStatus: "PRESENT",
        entries: [],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses a cancelled session", async () => {
    const sessionId = await heldSession(u14Id);
    await training.cancelTrainingSession(admin, sessionId, "بارندگی");

    await expect(
      attendance.saveAttendance(coach, sessionId, {
        defaultStatus: "PRESENT",
        entries: [],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  /**
   * Without this a coach could file a register against any player in the
   * academy, and the row would look exactly as legitimate as a real one.
   */
  it("refuses a player who is not in the squad", async () => {
    const sessionId = await heldSession(u14Id);
    const outsider = await prisma.player.findFirstOrThrow({
      where: { teamMemberships: { none: { teamId: u14Id } } },
    });

    await expect(
      attendance.saveAttendance(coach, sessionId, {
        entries: [{ playerId: outsider.id, status: "PRESENT" }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("the sheet belongs to the coach, the row belongs to the player", () => {
  it("refuses a coach another team's register", async () => {
    const sessionId = await heldSession(u16Id);

    await expect(
      attendance.getSessionRegister(coach, sessionId),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });

    await expect(
      attendance.saveAttendance(coach, sessionId, {
        defaultStatus: "PRESENT",
        entries: [],
      }),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  /**
   * The line this whole module is drawn around: a parent sees that their own
   * child missed Tuesday, and never learns who else did.
   */
  it("refuses a parent the whole sheet, and gives them their own child's row", async () => {
    const sessionId = await heldSession(u14Id);
    await attendance.saveAttendance(coach, sessionId, {
      defaultStatus: "PRESENT",
      entries: [{ playerId: ownChildId, status: "ABSENT" }],
    });

    await expect(
      attendance.getSessionRegister(parent, sessionId),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });

    const own = await attendance.getOwnRowsForSession(parent, sessionId);
    expect(own).toHaveLength(1);
    expect(own[0]!.playerId).toBe(ownChildId);
    expect(own[0]!.row.status).toBe("ABSENT");
  });

  it("refuses a parent another family's player register", async () => {
    await expect(
      attendance.getPlayerRegister(parent, strangerChildId),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("refuses a parent the write", async () => {
    const sessionId = await heldSession(u14Id);

    await expect(
      attendance.saveAttendance(parent, sessionId, {
        defaultStatus: "PRESENT",
        entries: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("gives an unscoped caller no own-rows, because they have the sheet", async () => {
    const sessionId = await heldSession(u14Id);
    await attendance.saveAttendance(admin, sessionId, {
      defaultStatus: "PRESENT",
      entries: [],
    });

    expect(await attendance.getOwnRowsForSession(admin, sessionId)).toEqual([]);
    expect(
      (await attendance.getSessionRegister(admin, sessionId)).rows.length,
    ).toBeGreaterThan(0);
  });
});

describe("a player's own register", () => {
  it("counts across sessions and reports a rate", async () => {
    const first = await heldSession(u14Id);
    const second = await heldSession(u14Id);

    await attendance.saveAttendance(coach, first, {
      entries: [{ playerId: ownChildId, status: "PRESENT" }],
    });
    await attendance.saveAttendance(coach, second, {
      entries: [{ playerId: ownChildId, status: "ABSENT" }],
    });

    const register = await attendance.getPlayerRegister(parent, ownChildId);

    expect(register.totals.total).toBeGreaterThanOrEqual(2);
    expect(register.rate).not.toBeNull();
    expect(register.entries[0]!.trainingSession.startsAt.getTime()).toBeGreaterThanOrEqual(
      register.entries[1]!.trainingSession.startsAt.getTime(),
    );
  });
});
