import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as tryouts from "@/lib/services/tryout.service";
import { getPlayerJourney } from "@/lib/services/journey.service";

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
/** Screening and decisions belong to the academy manager (CLAUDE.md §21). */
let manager: AuthorizedUser;
let coach: AuthorizedUser;

let tryoutId: string;
let tryoutSlug: string;
let u14TeamId: string;

const createdPersonIds: string[] = [];
const createdTryoutIds: string[] = [];

/** A national code with a valid check digit, unique per call. */
let codeSequence = 0;
function nationalCode(): string {
  codeSequence += 1;
  const nine = String(600000000 + ((process.pid * 1000 + codeSequence) % 99999999)).slice(0, 9);
  const sum = [...nine].reduce(
    (total, digit, index) => total + Number(digit) * (10 - index),
    0,
  );
  const remainder = sum % 11;
  const check = remainder < 2 ? remainder : 11 - remainder;
  return `${nine}${check}`;
}

/** A birth date inside the U14 band for the seeded active season (1405). */
function eligibleBirthDate(): Date {
  return new Date(Date.UTC(1392 + 621, 7, 15, 9));
}

async function track(nationalCodeUsed: string): Promise<void> {
  const person = await prisma.person.findUnique({
    where: { nationalCode: nationalCodeUsed },
    select: { id: true },
  });
  if (person) createdPersonIds.push(person.id);
}

beforeAll(async () => {
  [admin, manager, coach] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000002"),
    authorizedUser("09120000003"),
  ]);

  const seeded = await prisma.tryout.findUniqueOrThrow({
    where: { slug: "football-u14-isfahan-1405" },
  });
  tryoutId = seeded.id;
  tryoutSlug = seeded.slug;

  u14TeamId = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u14" } })
  ).id;
});

afterAll(async () => {
  // Applications hold their tryout with Restrict, so the people go first —
  // deleting a Person cascades to their player and everything under it.
  if (createdPersonIds.length > 0) {
    await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
  }
  if (createdTryoutIds.length > 0) {
    await prisma.tryout.deleteMany({ where: { id: { in: createdTryoutIds } } });
  }
});

/** Registers a fresh applicant and returns the tracking code. */
async function register(
  overrides: Partial<Parameters<typeof tryouts.submitTryoutApplication>[2]> = {},
  mobile = "09121110000",
) {
  const code = overrides.nationalCode ?? nationalCode();

  const result = await tryouts.submitTryoutApplication(tryoutSlug, mobile, {
    firstName: "داوطلب",
    lastName: `آزمون${codeSequence}`,
    nationalCode: code,
    dateOfBirth: eligibleBirthDate(),
    gender: "MALE",
    guardian: {
      firstName: "ولی",
      lastName: "داوطلب",
      mobile,
      relation: "FATHER",
    },
    ...overrides,
  });

  await track(code);
  return { ...result, nationalCode: code };
}

describe("public registration", () => {
  it("creates the player, the application and the timeline entry together", async () => {
    const { trackingCode } = await register();

    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
      include: { player: { include: { person: true } }, screening: true },
    });

    expect(application.status).toBe("SUBMITTED");
    // Every application arrives with its paperwork check waiting.
    expect(application.screening?.status).toBe("PENDING");

    const journey = await getPlayerJourney(admin, application.playerId);
    expect(journey[0]!.type).toBe("TRYOUT_REGISTERED");
    expect(journey[0]!.description).toContain(trackingCode);
  });

  it("attaches the guardian the child was registered by", async () => {
    const { trackingCode } = await register();

    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
      include: {
        player: {
          include: { guardians: { include: { guardian: true } } },
        },
      },
    });

    expect(application.player.guardians).toHaveLength(1);
    expect(application.player.guardians[0]!.isPrimary).toBe(true);
  });

  /**
   * BUSINESS_RULES §1: a school player trying out for a main team is the
   * ordinary path in, and a second record would fork their history.
   */
  it("reuses an existing player rather than creating a second one", async () => {
    const seededPlayer = await prisma.player.findFirstOrThrow({
      where: { person: { nationalCode: { not: null } } },
      include: { person: true },
    });

    const before = await prisma.player.count();

    const { trackingCode } = await tryouts.submitTryoutApplication(
      tryoutSlug,
      "09121110001",
      {
        firstName: seededPlayer.person.firstName,
        lastName: seededPlayer.person.lastName,
        nationalCode: seededPlayer.person.nationalCode!,
        dateOfBirth: seededPlayer.person.dateOfBirth!,
        gender: "MALE",
        guardian: {
          firstName: "ولی",
          lastName: "موجود",
          mobile: "09121110001",
          relation: "FATHER",
        },
      },
    );

    expect(await prisma.player.count()).toBe(before);

    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
    });
    expect(application.playerId).toBe(seededPlayer.id);

    await prisma.tryoutApplication.delete({ where: { trackingCode } });
    await prisma.playerJourneyEvent.deleteMany({
      where: { playerId: seededPlayer.id, type: "TRYOUT_REGISTERED" },
    });
  });

  it("refuses a second application for the same player in the same trial", async () => {
    const first = await register();

    await expect(
      register({ nationalCode: first.nationalCode }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses a birth year outside the trial's band", async () => {
    await expect(
      register({ dateOfBirth: new Date(Date.UTC(1386 + 621, 7, 15, 9)) }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  /** A child registered without the adult who brought them is a half-record. */
  it("refuses a child with no guardian", async () => {
    const code = nationalCode();
    await expect(
      tryouts.submitTryoutApplication(tryoutSlug, "09121110002", {
        firstName: "بی",
        lastName: "ولی",
        nationalCode: code,
        dateOfBirth: eligibleBirthDate(),
        gender: "MALE",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses registration once the window has closed", async () => {
    await expect(
      tryouts.submitTryoutApplication(
        "football-u16-isfahan-1405",
        "09121110003",
        {
          firstName: "دیر",
          lastName: "رسیده",
          nationalCode: nationalCode(),
          dateOfBirth: new Date(Date.UTC(1390 + 621, 7, 15, 9)),
          gender: "MALE",
          guardian: {
            firstName: "ولی",
            lastName: "دیر",
            mobile: "09121110003",
            relation: "FATHER",
          },
        },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("never returns a draft trial to the public", async () => {
    const draft = await prisma.tryout.create({
      data: {
        sportId: (await prisma.sport.findFirstOrThrow({ where: { slug: "football" } })).id,
        ageGroupId: (
          await prisma.ageGroup.findFirstOrThrow({ where: { code: "U12" } })
        ).id,
        seasonId: (
          await prisma.season.findFirstOrThrow({ where: { status: "ACTIVE" } })
        ).id,
        slug: `draft-${Date.now()}`,
        title: "پیش‌نویس",
        opensAt: new Date(Date.now() - 1000),
        closesAt: new Date(Date.now() + 86400000),
        status: "DRAFT",
      },
    });
    createdTryoutIds.push(draft.id);

    await expect(tryouts.getPublicTryout(draft.slug)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("registering several applicants at once", () => {
  /**
   * The first minute after a trial opens is the busiest the academy ever is,
   * and the player code is allocated by reading the highest and adding one —
   * which concurrent registrations all read. A collision must be retried, not
   * shown to a family as "a record with these details already exists".
   */
  it("gives every concurrent registration its own code", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        register({ lastName: `هم‌زمان${index}` }, `0912111100${index}`),
      ),
    );

    const codes = results.map((result) => result.trackingCode);
    expect(new Set(codes).size).toBe(results.length);

    const applications = await prisma.tryoutApplication.findMany({
      where: { trackingCode: { in: codes } },
      include: { player: true },
    });

    expect(applications).toHaveLength(results.length);
    const playerCodes = applications.map((row) => row.player.playerCode);
    expect(new Set(playerCodes).size).toBe(results.length);
  });
});

describe("following an application", () => {
  it("needs the code and the number together", async () => {
    const { trackingCode } = await register({}, "09121110004");

    await expect(
      tryouts.lookupApplication(trackingCode, "09121110004"),
    ).resolves.toMatchObject({ trackingCode });

    // The right code with the wrong number tells the caller nothing.
    await expect(
      tryouts.lookupApplication(trackingCode, "09129999999"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("answers the same for a code that does not exist", async () => {
    await expect(
      tryouts.lookupApplication("SEP-T-NOTREAL1", "09121110004"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("screening", () => {
  it("moves an approved application on without deciding it", async () => {
    const { trackingCode } = await register();
    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
    });

    const updated = await tryouts.recordScreening(manager, application.id, {
      status: "APPROVED",
      ageEligible: true,
      documentsComplete: true,
    });

    expect(updated.status).toBe("EVALUATION");
    expect(updated.decidedAt).toBeNull();
  });

  it("ends the application when it rejects, and says so on the timeline", async () => {
    const { trackingCode } = await register();
    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
    });

    const updated = await tryouts.recordScreening(manager, application.id, {
      status: "REJECTED",
      ageEligible: false,
      note: "مدارک ناقص",
    });

    expect(updated.status).toBe("REJECTED");

    const journey = await getPlayerJourney(admin, application.playerId);
    expect(journey[0]!.type).toBe("TRYOUT_REJECTED");
  });

  /**
   * A coach holds no tryout permission at all: the talent pipeline is the
   * academy manager's (CLAUDE.md §21). Coaches reach trial players through
   * evaluation in Phase 11, not through the applications themselves.
   */
  it("refuses a coach, who has no tryout permission", async () => {
    const { trackingCode } = await register();
    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
    });

    await expect(
      tryouts.recordScreening(coach, application.id, { status: "APPROVED" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("the acceptance transaction", () => {
  /** BUSINESS_RULES §3: all of it, or none of it. */
  it("accepts, joins the squad and writes the timeline as one step", async () => {
    const { trackingCode } = await register();
    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
    });

    const decided = await tryouts.decideApplication(admin, application.id, {
      decision: "ACCEPTED",
      teamId: u14TeamId,
      note: "عملکرد خوب در آزمون",
    });

    expect(decided.status).toBe("ACCEPTED");
    expect(decided.decidedAt).not.toBeNull();

    const membership = await prisma.teamMembership.findFirst({
      where: { playerId: application.playerId, teamId: u14TeamId },
    });
    expect(membership).not.toBeNull();
    expect(membership!.isPrimary).toBe(true);

    const journey = await getPlayerJourney(admin, application.playerId);
    expect(journey[0]!.type).toBe("TRYOUT_ACCEPTED");
    expect(journey[0]!.teamId).toBe(u14TeamId);
  });

  /**
   * The half-done state the rule forbids: if the squad write is refused, the
   * application must not be left marked accepted.
   */
  it("leaves nothing behind when the squad it names is wrong", async () => {
    const { trackingCode } = await register();
    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
    });

    const u16TeamId = (
      await prisma.team.findUniqueOrThrow({ where: { slug: "football-u16" } })
    ).id;

    await expect(
      tryouts.decideApplication(admin, application.id, {
        decision: "ACCEPTED",
        teamId: u16TeamId,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const after = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(after.status).not.toBe("ACCEPTED");
    expect(after.decidedAt).toBeNull();

    expect(
      await prisma.teamMembership.count({
        where: { playerId: application.playerId },
      }),
    ).toBe(0);
  });

  it("refuses a second decision on the same application", async () => {
    const { trackingCode } = await register();
    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
    });

    await tryouts.decideApplication(admin, application.id, {
      decision: "WAITLIST",
    });

    await expect(
      tryouts.decideApplication(admin, application.id, {
        decision: "ACCEPTED",
        teamId: u14TeamId,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  /**
   * Screening is a check; the decision is a separate permission. Tested with
   * a caller who holds `tryout:write` but not `tryout:decide` — someone who
   * lacks both proves nothing about the difference between them.
   */
  it("refuses a caller who may screen but may not decide", async () => {
    const { trackingCode } = await register();
    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
    });

    const screener: AuthorizedUser = {
      ...manager,
      permissions: manager.permissions.filter(
        (permission) => permission !== "tryout:decide",
      ),
    };

    // They can still do their own job.
    await expect(
      tryouts.recordScreening(screener, application.id, { status: "APPROVED" }),
    ).resolves.toBeDefined();

    await expect(
      tryouts.decideApplication(screener, application.id, {
        decision: "ACCEPTED",
        teamId: u14TeamId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires a note-free rejection to still land on the timeline", async () => {
    const { trackingCode } = await register();
    const application = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { trackingCode },
    });

    await tryouts.decideApplication(admin, application.id, {
      decision: "REJECTED",
    });

    const journey = await getPlayerJourney(admin, application.playerId);
    expect(journey[0]!.type).toBe("TRYOUT_REJECTED");
  });
});

describe("the funnel", () => {
  it("counts by status in the database, not from a page of rows", async () => {
    const funnel = await tryouts.getTryoutFunnel(admin, tryoutId);

    const total = await prisma.tryoutApplication.count({ where: { tryoutId } });
    expect(funnel.total).toBe(total);

    const pending = await prisma.tryoutApplication.count({
      where: { tryoutId, screening: { status: "PENDING" } },
    });
    expect(funnel.pendingScreening).toBe(pending);
  });
});
