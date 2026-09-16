import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as evaluations from "@/lib/services/evaluation.service";
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
let manager: AuthorizedUser;
let coach: AuthorizedUser;
let otherCoach: AuthorizedUser;

let templateId: string;
let coachStaffId: string;
let otherCoachStaffId: string;
/** A player in the coach's own squad, and one in nobody's. */
let squadPlayerId: string;
let outsidePlayerId: string;

const createdEvaluations: string[] = [];
const createdTemplates: string[] = [];
/**
 * Every player this file writes an evaluation for.
 *
 * Submitting writes an `EVALUATION` entry on the player's timeline, and some
 * of these players are **seeded** ones — so without clearing them the baseline
 * grows by one on every run, which is how a count another test asserts on
 * eventually drifts (docs/PROJECT_RULES.md §6.1).
 */
const touchedPlayerIds = new Set<string>();

beforeAll(async () => {
  [admin, manager, coach, otherCoach] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000002"),
    authorizedUser("09120000003"),
    authorizedUser("09120000006"),
  ]);

  templateId = (
    await prisma.evaluationTemplate.findFirstOrThrow({
      where: { title: "ارزیابی پایه فوتبال" },
    })
  ).id;

  coachStaffId = (
    await prisma.staff.findFirstOrThrow({
      where: { person: { userId: coach.id } },
    })
  ).id;

  const u14 = await prisma.team.findUniqueOrThrow({
    where: { slug: "football-u14" },
  });
  squadPlayerId = (
    await prisma.teamMembership.findFirstOrThrow({
      where: { teamId: u14.id, status: "ACTIVE" },
    })
  ).playerId;

  // A tryout applicant: in no squad, so unreachable except by assignment.
  outsidePlayerId = (
    await prisma.tryoutApplication.findFirstOrThrow({
      where: { trackingCode: "SEP-T-SEEDA001" },
    })
  ).playerId;

  // The second seeded coach has no Staff row of their own; make one so the
  // "assigned to someone else" cases are real.
  const otherPerson = await prisma.person.findFirst({
    where: { userId: otherCoach.id },
  });
  const staff = otherPerson
    ? await prisma.staff.upsert({
        where: { personId: otherPerson.id },
        update: { status: "ACTIVE" },
        create: { personId: otherPerson.id, status: "ACTIVE" },
      })
    : await prisma.staff.create({
        data: {
          person: {
            create: {
              firstName: "مربی",
              lastName: "دوم",
              userId: otherCoach.id,
            },
          },
        },
      });
  otherCoachStaffId = staff.id;
});

afterAll(async () => {
  if (createdEvaluations.length > 0) {
    await prisma.evaluation.deleteMany({
      where: { id: { in: createdEvaluations } },
    });
  }
  if (createdTemplates.length > 0) {
    await prisma.evaluationTemplate.deleteMany({
      where: { id: { in: createdTemplates } },
    });
  }
  if (touchedPlayerIds.size > 0) {
    await prisma.playerJourneyEvent.deleteMany({
      where: { playerId: { in: [...touchedPlayerIds] }, type: "EVALUATION" },
    });
  }
});

async function assign(
  playerId: string,
  evaluatorId = coachStaffId,
  applicationId?: string,
) {
  const evaluation = await evaluations.requestEvaluation(manager, {
    playerId,
    templateId,
    evaluatorId,
    ...(applicationId ? { applicationId } : {}),
  });
  createdEvaluations.push(evaluation.id);
  touchedPlayerIds.add(playerId);
  return evaluation;
}

/** Full marks on every criterion of the seeded template. */
async function fullMarks() {
  const template = await prisma.evaluationTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { criteria: true },
  });
  return template.criteria.map((criterion) => ({
    criterionId: criterion.id,
    score: criterion.maxScore,
  }));
}

describe("the assignment is the coach's route to a trial player", () => {
  /**
   * The design the whole module is built around: a coach holds no `tryout:*`
   * permission, so the only way they reach an applicant is by being handed
   * the evaluation.
   */
  it("lets a coach open an evaluation for a player outside their squad", async () => {
    expect(coach.permissions).not.toContain("tryout:read");

    const evaluation = await assign(outsidePlayerId);

    await expect(
      evaluations.getEvaluation(coach, evaluation.id),
    ).resolves.toMatchObject({ id: evaluation.id });
  });

  it("refuses another coach the same evaluation", async () => {
    const evaluation = await assign(outsidePlayerId, coachStaffId);

    await expect(
      evaluations.getEvaluation(otherCoach, evaluation.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("still lets a coach evaluate their own squad without an assignment", async () => {
    const evaluation = await assign(squadPlayerId, otherCoachStaffId);

    // Assigned to someone else, but the player is in this coach's squad.
    await expect(
      evaluations.getEvaluation(coach, evaluation.id),
    ).resolves.toBeDefined();
  });

  it("shows a coach their assignments in the list", async () => {
    const evaluation = await assign(outsidePlayerId);

    const list = await evaluations.listEvaluations(coach);
    expect(list.map((row) => row.id)).toContain(evaluation.id);
  });
});

describe("a coach cannot assign their way around the tryout permission", () => {
  it("refuses a coach an evaluation tied to an application", async () => {
    const application = await prisma.tryoutApplication.findFirstOrThrow({
      where: { trackingCode: "SEP-T-SEEDA001" },
    });

    await expect(
      evaluations.requestEvaluation(coach, {
        playerId: application.playerId,
        templateId,
        evaluatorId: coachStaffId,
        applicationId: application.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses a coach assigning to someone else", async () => {
    await expect(
      evaluations.requestEvaluation(coach, {
        playerId: squadPlayerId,
        templateId,
        evaluatorId: otherCoachStaffId,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses a coach a player outside their squad", async () => {
    await expect(
      evaluations.requestEvaluation(coach, {
        playerId: outsidePlayerId,
        templateId,
        evaluatorId: coachStaffId,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  /** The club's yardstick is not a coach's to redraw. */
  it("refuses a coach a new template", async () => {
    const sport = await prisma.sport.findFirstOrThrow({
      where: { slug: "football" },
    });

    await expect(
      evaluations.createEvaluationTemplate(coach, {
        sportId: sport.id,
        title: "الگوی خودساخته",
        criteria: [{ dimension: "TECHNICAL", title: "هرچه", maxScore: 10, weight: 1 }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("filling in the sheet", () => {
  it("saves a partial draft without finishing it", async () => {
    const evaluation = await assign(squadPlayerId);
    const marks = await fullMarks();

    const saved = await evaluations.saveEvaluation(coach, evaluation.id, {
      scores: marks.slice(0, 2),
      submit: false,
    });

    expect(saved.status).toBe("DRAFT");
    expect(saved.overallScore).toBeNull();
    expect(saved.scores).toHaveLength(2);
  });

  /** An overall averaged over half a sheet is a different number. */
  it("refuses to finish with criteria left unmarked", async () => {
    const evaluation = await assign(squadPlayerId);
    const marks = await fullMarks();

    await expect(
      evaluations.saveEvaluation(coach, evaluation.id, {
        scores: marks.slice(0, 3),
        submit: true,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses a mark above the criterion's maximum", async () => {
    const evaluation = await assign(squadPlayerId);
    const marks = await fullMarks();

    await expect(
      evaluations.saveEvaluation(coach, evaluation.id, {
        scores: [{ ...marks[0]!, score: 99 }],
        submit: false,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses a criterion from another template", async () => {
    const evaluation = await assign(squadPlayerId);
    const foreign = await prisma.evaluationCriterion.create({
      data: {
        template: {
          create: {
            sportId: (
              await prisma.sport.findFirstOrThrow({ where: { slug: "football" } })
            ).id,
            title: `الگوی بیگانه ${Date.now()}`,
          },
        },
        dimension: "TECHNICAL",
        title: "معیار بیگانه",
      },
    });
    createdTemplates.push(foreign.templateId);

    await expect(
      evaluations.saveEvaluation(coach, evaluation.id, {
        scores: [{ criterionId: foreign.id, score: 5 }],
        submit: false,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("counts marks saved earlier when finishing", async () => {
    const evaluation = await assign(squadPlayerId);
    const marks = await fullMarks();

    await evaluations.saveEvaluation(coach, evaluation.id, {
      scores: marks.slice(0, 4),
      submit: false,
    });

    // The rest arrive with the submission; the first four still count.
    const done = await evaluations.saveEvaluation(coach, evaluation.id, {
      scores: marks.slice(4),
      recommendation: "ACCEPT",
      submit: true,
    });

    expect(done.status).toBe("SUBMITTED");
    expect(done.overallScore).toBe(10);
  });
});

describe("a submitted evaluation is a record", () => {
  it("freezes, and refuses further marks", async () => {
    const evaluation = await assign(squadPlayerId);
    const marks = await fullMarks();

    await evaluations.saveEvaluation(coach, evaluation.id, {
      scores: marks,
      recommendation: "WAITLIST",
      submit: true,
    });

    await expect(
      evaluations.saveEvaluation(coach, evaluation.id, {
        scores: [{ ...marks[0]!, score: 1 }],
        submit: false,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  /**
   * The reason the overall is stored rather than derived: the yardstick may
   * be redrawn next season, and what a coach concluded this season must not
   * silently change with it.
   */
  it("keeps its score when the template's weights change afterwards", async () => {
    const evaluation = await assign(squadPlayerId);
    const template = await prisma.evaluationTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { criteria: { orderBy: { displayOrder: "asc" } } },
    });

    // A deliberately uneven sheet, so a weight change would move the average.
    const marks = template.criteria.map((criterion, index) => ({
      criterionId: criterion.id,
      score: index === 0 ? 2 : 9,
    }));

    const submitted = await evaluations.saveEvaluation(coach, evaluation.id, {
      scores: marks,
      submit: true,
    });
    const frozen = submitted.overallScore;
    expect(frozen).not.toBeNull();

    const first = template.criteria[0]!;
    await prisma.evaluationCriterion.update({
      where: { id: first.id },
      data: { weight: first.weight + 8 },
    });

    try {
      const reread = await evaluations.getEvaluation(coach, evaluation.id);
      expect(reread.overallScore).toBe(frozen);
    } finally {
      await prisma.evaluationCriterion.update({
        where: { id: first.id },
        data: { weight: first.weight },
      });
    }
  });

  it("writes the timeline entry with the submission", async () => {
    const evaluation = await assign(squadPlayerId);
    const marks = await fullMarks();

    await evaluations.saveEvaluation(coach, evaluation.id, {
      scores: marks,
      submit: true,
    });

    const journey = await getPlayerJourney(admin, squadPlayerId);
    expect(journey[0]!.type).toBe("EVALUATION");
    expect(journey[0]!.description).toContain("۱۰");
  });
});

describe("the recommendation is advice, not a decision", () => {
  it("does not change the application's status", async () => {
    const application = await prisma.tryoutApplication.findFirstOrThrow({
      where: { trackingCode: "SEP-T-SEEDB002" },
    });
    const before = application.status;

    const evaluation = await assign(
      application.playerId,
      coachStaffId,
      application.id,
    );
    const marks = await fullMarks();

    await evaluations.saveEvaluation(coach, evaluation.id, {
      scores: marks,
      recommendation: "ACCEPT",
      submit: true,
    });

    const after = await prisma.tryoutApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(after.status).toBe(before);
    expect(after.decidedAt).toBeNull();
  });

  it("shows up in the summary the manager reads", async () => {
    const application = await prisma.tryoutApplication.findFirstOrThrow({
      where: { trackingCode: "SEP-T-SEEDB002" },
    });

    const summary = await evaluations.summariseApplicationEvaluations(manager, [
      application.id,
    ]);

    expect(summary.get(application.id)?.submitted).toBeGreaterThan(0);
    expect(summary.get(application.id)?.average).toBe(10);
  });
});
