import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as notifications from "@/lib/services/notification.service";
import * as announcements from "@/lib/services/announcement.service";
import { createAnnouncementSchema } from "@/lib/validation/announcement";

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
let manager: AuthorizedUser;
let coach: AuthorizedUser;
let parent: AuthorizedUser;

let u14Id: string;
let u16Id: string;
let parentPersonId: string;

const createdAnnouncementIds: string[] = [];

/**
 * Seeded notifications that were unread before this suite ran.
 *
 * "Mark all read" does exactly what it says, and what it says includes the
 * seeded announcement sitting in the same inbox. Deleting this suite's own
 * announcements afterwards cleans up its rows but cannot un-read a row it did
 * not create — and a seeded notification that is read from the second run
 * onward means the badge is empty on a fresh database
 * (docs/PROJECT_RULES.md §6.1).
 */
let preReadIds: string[] = [];

const PAGE = { page: 1, pageSize: 50 };

async function draft(caller: AuthorizedUser, input: Record<string, unknown>) {
  const created = await announcements.createAnnouncement(
    caller,
    createAnnouncementSchema.parse({
      title: "اطلاعیه آزمایشی",
      body: "متن اطلاعیه آزمایشی برای تست.",
      ...input,
    }),
  );
  createdAnnouncementIds.push(created.id);
  return created;
}

beforeAll(async () => {
  [admin, manager, coach, parent] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000002"),
    authorizedUser("09120000003"),
    authorizedUser("09120000005"),
  ]);

  u14Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u14" } })
  ).id;
  u16Id = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u16" } })
  ).id;

  parentPersonId = (
    await prisma.person.findUniqueOrThrow({ where: { userId: parent.id } })
  ).id;

  preReadIds = (
    await prisma.notification.findMany({
      where: { readAt: null },
      select: { id: true },
    })
  ).map((row) => row.id);
});

afterAll(async () => {
  // Deleting the announcement cascades to the notifications it fanned out, so
  // the seeded inbox counts come back exactly.
  if (createdAnnouncementIds.length > 0) {
    await prisma.announcement.deleteMany({
      where: { id: { in: createdAnnouncementIds } },
    });
  }

  // And anything seeded that this suite read on its way past.
  if (preReadIds.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: preReadIds } },
      data: { readAt: null },
    });
  }
});

describe("drafting an announcement", () => {
  it("starts as a draft with nobody notified", async () => {
    const created = await draft(admin, { teamId: u14Id });

    expect(created.status).toBe("DRAFT");
    expect(created.publishedAt).toBeNull();
    expect(created.recipients).toBe(0);

    const fanned = await prisma.notification.count({
      where: { announcementId: created.id },
    });
    expect(fanned).toBe(0);
  });

  /** Writing is not sending — the whole reason publishing is a second act. */
  it("refuses a team the author may not write to", async () => {
    await expect(draft(coach, { teamId: u16Id })).rejects.toMatchObject({
      code: "OUT_OF_SCOPE",
    });
  });

  it("lets a coach address their own squad", async () => {
    const created = await draft(coach, { teamId: u14Id });
    expect(created.teamId).toBe(u14Id);
  });

  /**
   * The blast radius of an academy-wide message is the whole club. That is not
   * a coach's call, even though they hold `notification:send`.
   */
  it("refuses a coach the whole academy", async () => {
    await expect(draft(coach, {})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("lets the academy manager address the whole academy", async () => {
    const created = await draft(manager, {});
    expect(created.teamId).toBeNull();
    expect(created.schoolId).toBeNull();
  });

  it("refuses an announcement addressed to both a team and a school", () => {
    expect(() =>
      createAnnouncementSchema.parse({
        title: "هر دو",
        body: "این نباید پذیرفته شود.",
        teamId: "c".repeat(25),
        schoolId: "d".repeat(25),
      }),
    ).toThrow();
  });
});

describe("publishing", () => {
  it("reaches the squad and their guardians", async () => {
    const created = await draft(admin, { teamId: u14Id });
    const published = await announcements.publishAnnouncement(
      admin,
      created.id,
    );

    expect(published?.status).toBe("PUBLISHED");
    expect(published?.publishedAt).not.toBeNull();
    expect(published?.recipients).toBeGreaterThan(0);

    const rows = await prisma.notification.findMany({
      where: { announcementId: created.id },
      select: { personId: true, readAt: true },
    });

    expect(rows).toHaveLength(published!.recipients);
    // Everything arrives unread, or the badge would never light up.
    expect(rows.every((row) => row.readAt === null)).toBe(true);
    // The parent of a U14 player is in the audience.
    expect(rows.map((row) => row.personId)).toContain(parentPersonId);
  });

  /** One notification per person, however many children they have. */
  it("tells nobody twice", async () => {
    const created = await draft(admin, { teamId: u14Id });
    await announcements.publishAnnouncement(admin, created.id);

    const rows = await prisma.notification.findMany({
      where: { announcementId: created.id },
      select: { personId: true },
    });

    expect(new Set(rows.map((row) => row.personId)).size).toBe(rows.length);
  });

  /** A prompt about your own action is noise. */
  it("does not notify the author", async () => {
    const authorPersonId = (
      await prisma.person.findUniqueOrThrow({ where: { userId: coach.id } })
    ).id;

    const created = await draft(coach, { teamId: u14Id });
    await announcements.publishAnnouncement(coach, created.id);

    const rows = await prisma.notification.findMany({
      where: { announcementId: created.id },
      select: { personId: true },
    });

    expect(rows.map((row) => row.personId)).not.toContain(authorPersonId);
  });

  /**
   * Publishing twice would put a second copy in every inbox. The status is in
   * the update's own filter, so the second attempt changes nothing and says so.
   */
  it("happens once", async () => {
    const created = await draft(admin, { teamId: u14Id });
    await announcements.publishAnnouncement(admin, created.id);

    await expect(
      announcements.publishAnnouncement(admin, created.id),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const count = await prisma.notification.count({
      where: { announcementId: created.id },
    });
    const announcement = await prisma.announcement.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(count).toBe(announcement.recipients);
  });

  /**
   * The gap the page showed: a coach cannot *write* an academy-wide
   * announcement, but before this check they could publish one the manager had
   * written — it was sitting in their list with a working send button.
   */
  it("refuses a coach publishing an academy-wide draft", async () => {
    const created = await draft(manager, {});

    await expect(
      announcements.publishAnnouncement(coach, created.id),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const stillDraft = await prisma.announcement.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stillDraft.status).toBe("DRAFT");
    expect(
      await prisma.notification.count({
        where: { announcementId: created.id },
      }),
    ).toBe(0);
  });

  it("refuses a coach publishing another squad's draft", async () => {
    const created = await draft(admin, { teamId: u16Id });

    await expect(
      announcements.publishAnnouncement(coach, created.id),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("answers the button-gating question the same way", async () => {
    expect(await announcements.canPublish(coach, { teamId: u14Id })).toBe(true);
    expect(await announcements.canPublish(coach, { teamId: u16Id })).toBe(
      false,
    );
    expect(await announcements.canPublish(coach, {})).toBe(false);
    expect(await announcements.canPublish(manager, {})).toBe(true);
    expect(await announcements.canPublish(parent, { teamId: u14Id })).toBe(
      false,
    );
  });

  it("refuses someone without permission to send", async () => {
    const created = await draft(admin, { teamId: u14Id });

    await expect(
      announcements.publishAnnouncement(parent, created.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("freezes the recipient count at publication", async () => {
    const created = await draft(admin, { teamId: u14Id });
    const published = await announcements.publishAnnouncement(
      admin,
      created.id,
    );

    // Counting the rows back later would give a different answer as squads
    // change; the stored number is what it actually reached that day.
    expect(published?.recipients).toBe(
      await prisma.notification.count({
        where: { announcementId: created.id },
      }),
    );
  });
});

describe("who sees which announcements", () => {
  it("hides drafts from a reader who cannot send", async () => {
    const created = await draft(admin, { teamId: u14Id });

    const { items } = await announcements.listAnnouncements(parent, PAGE);
    expect(items.map((item) => item.id)).not.toContain(created.id);

    // Not `FORBIDDEN`: a draft should be indistinguishable from nothing.
    await expect(
      announcements.getAnnouncement(parent, created.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("shows a draft to its author", async () => {
    const created = await draft(admin, { teamId: u14Id });
    const found = await announcements.getAnnouncement(admin, created.id);
    expect(found.id).toBe(created.id);
  });

  it("shows a published announcement to everyone", async () => {
    const created = await draft(admin, { teamId: u14Id });
    await announcements.publishAnnouncement(admin, created.id);

    const found = await announcements.getAnnouncement(parent, created.id);
    expect(found.status).toBe("PUBLISHED");
  });
});

describe("the inbox", () => {
  it("returns only the caller's own notifications", async () => {
    const created = await draft(admin, { teamId: u14Id });
    await announcements.publishAnnouncement(admin, created.id);

    const { items } = await notifications.listMyNotifications(parent, PAGE);
    const ids = new Set(items.map((item) => item.id));

    const mine = await prisma.notification.findMany({
      where: { personId: parentPersonId },
      select: { id: true },
    });

    for (const row of mine.slice(0, 20)) {
      // Every row in the caller's own inbox is reachable; nothing else is.
      expect(ids.has(row.id) || items.length === PAGE.pageSize).toBe(true);
    }

    const theirs = await prisma.notification.findMany({
      where: { personId: { not: parentPersonId } },
      select: { id: true },
      take: 5,
    });
    for (const row of theirs) {
      expect(ids.has(row.id)).toBe(false);
    }
  });

  it("counts what is unread", async () => {
    const before = await notifications.myUnreadCount(parent);

    const created = await draft(admin, { teamId: u14Id });
    await announcements.publishAnnouncement(admin, created.id);

    expect(await notifications.myUnreadCount(parent)).toBe(before + 1);
  });

  it("marks one read and stops counting it", async () => {
    const created = await draft(admin, { teamId: u14Id });
    await announcements.publishAnnouncement(admin, created.id);

    const row = await prisma.notification.findFirstOrThrow({
      where: { announcementId: created.id, personId: parentPersonId },
    });

    const before = await notifications.myUnreadCount(parent);
    const result = await notifications.markNotificationRead(parent, row.id);

    expect(result.readAt).not.toBeNull();
    expect(await notifications.myUnreadCount(parent)).toBe(before - 1);
  });

  /** `readAt` should keep saying when it was *first* seen. */
  it("does not move readAt on a second read", async () => {
    const created = await draft(admin, { teamId: u14Id });
    await announcements.publishAnnouncement(admin, created.id);

    const row = await prisma.notification.findFirstOrThrow({
      where: { announcementId: created.id, personId: parentPersonId },
    });

    const first = await notifications.markNotificationRead(parent, row.id);
    const second = await notifications.markNotificationRead(parent, row.id);

    expect(second.readAt?.getTime()).toBe(first.readAt?.getTime());
  });

  /**
   * Someone else's id and an id that does not exist answer identically, so the
   * table cannot be mapped by probing.
   */
  it("refuses another person's notification as not found", async () => {
    const created = await draft(admin, { teamId: u14Id });
    await announcements.publishAnnouncement(admin, created.id);

    const someoneElse = await prisma.notification.findFirstOrThrow({
      where: { announcementId: created.id, personId: { not: parentPersonId } },
    });

    await expect(
      notifications.markNotificationRead(parent, someoneElse.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      notifications.markNotificationRead(parent, "c".repeat(25)),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("clears the badge in one go", async () => {
    const created = await draft(admin, { teamId: u14Id });
    await announcements.publishAnnouncement(admin, created.id);

    expect(await notifications.myUnreadCount(parent)).toBeGreaterThan(0);
    await notifications.markAllNotificationsRead(parent);
    expect(await notifications.myUnreadCount(parent)).toBe(0);
  });

  /**
   * An administrator account with no `Person` has no inbox. An empty answer
   * rather than an error, because this runs in the shell on every page.
   */
  it("gives an account with no person record an empty inbox", async () => {
    const orphan = await prisma.user.create({
      data: { mobile: "09129998877", status: "ACTIVE" },
    });

    try {
      const caller: AuthorizedUser = {
        id: orphan.id,
        mobile: orphan.mobile,
        roles: admin.roles,
        permissions: admin.permissions,
      };

      expect(await notifications.myUnreadCount(caller)).toBe(0);
      const { items } = await notifications.listMyNotifications(caller, PAGE);
      expect(items).toEqual([]);
      expect(await notifications.markAllNotificationsRead(caller)).toBe(0);
    } finally {
      await prisma.user.delete({ where: { id: orphan.id } });
    }
  });
});
