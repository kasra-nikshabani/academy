import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as talent from "@/lib/services/talent.service";
import * as tryouts from "@/lib/services/tryout.service";
import * as evaluations from "@/lib/services/evaluation.service";

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

let tryoutId: string;
let templateId: string;
let coachStaffId: string;
let u14TeamId: string;

const createdPersonIds: string[] = [];
const createdEvaluationIds: string[] = [];

let codeSequence = 0;
function nationalCode(): string {
  codeSequence += 1;
  const nine = String(
    700000000 + codeSequence + (process.pid % 10000) * 100,
  ).slice(0, 9);
  const sum = [...nine].reduce(
    (total, digit, index) => total + Number(digit) * (10 - index),
    0,
  );
  const remainder = sum % 11;
  const check = remainder < 2 ? remainder : 11 - remainder;
  return `${nine}${check}`;
}

/** An applicant sitting at a chosen point in the pipeline. */
async function applicant(): Promise<{
  applicationId: string;
  playerId: string;
}> {
  const code = nationalCode();

  const result = await tryouts.submitTryoutApplication(
    "football-u14-isfahan-1405",
    "09123330000",
    {
      firstName: "قیف",
      lastName: `آزمون${codeSequence}`,
      nationalCode: code,
      dateOfBirth: new Date(Date.UTC(1392 + 621, 7, 15, 9)),
      gender: "MALE",
      guardian: {
        firstName: "ولی",
        lastName: "قیف",
        mobile: "09123330000",
        relation: "FATHER",
      },
    },
  );

  const person = await prisma.person.findUniqueOrThrow({
    where: { nationalCode: code },
    select: {
      id: true,
      // The applicant's guardian is a second `Person` the registration
      // creates, and it has no national code — so a cleanup that looks the
      // applicant up by code never sees it. Left behind, they accumulate: 26
      // per `pnpm verify`, and they land on the seeded player every parent
      // test reaches for.
      player: {
        select: {
          guardians: { select: { guardian: { select: { personId: true } } } },
        },
      },
    },
  });
  createdPersonIds.push(person.id);
  for (const link of person.player?.guardians ?? []) {
    createdPersonIds.push(link.guardian.personId);
  }

  const application = await prisma.tryoutApplication.findUniqueOrThrow({
    where: { trackingCode: result.trackingCode },
  });

  return { applicationId: application.id, playerId: application.playerId };
}

beforeAll(async () => {
  [admin, manager, coach] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000002"),
    authorizedUser("09120000003"),
  ]);

  tryoutId = (
    await prisma.tryout.findUniqueOrThrow({
      where: { slug: "football-u14-isfahan-1405" },
    })
  ).id;

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

  u14TeamId = (
    await prisma.team.findUniqueOrThrow({ where: { slug: "football-u14" } })
  ).id;
});

afterAll(async () => {
  if (createdEvaluationIds.length > 0) {
    await prisma.evaluation.deleteMany({
      where: { id: { in: createdEvaluationIds } },
    });
  }
  if (createdPersonIds.length > 0) {
    await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
  }
});

describe("the three queues", () => {
  it("puts a new application in front of screening and nowhere else", async () => {
    const { applicationId } = await applicant();

    const queues = await talent.getPipelineQueues(manager, {
      tryoutId,
    });

    expect(queues.awaitingScreening.map((row) => row.id)).toContain(
      applicationId,
    );
    expect(queues.awaitingEvaluator.map((row) => row.id)).not.toContain(
      applicationId,
    );
    expect(queues.awaitingDecision.map((row) => row.id)).not.toContain(
      applicationId,
    );
  });

  /**
   * The queue that would otherwise be invisible: past screening, and nobody
   * has been asked to watch them play. Without this list they wait forever
   * with nothing anywhere saying so.
   */
  it("moves it to the evaluator queue once screening approves", async () => {
    const { applicationId } = await applicant();

    await tryouts.recordScreening(manager, applicationId, {
      status: "APPROVED",
      ageEligible: true,
      documentsComplete: true,
    });

    const queues = await talent.getPipelineQueues(manager, { tryoutId });

    expect(queues.awaitingScreening.map((row) => row.id)).not.toContain(
      applicationId,
    );
    expect(queues.awaitingEvaluator.map((row) => row.id)).toContain(
      applicationId,
    );
  });

  it("leaves the evaluator queue the moment an evaluation is assigned", async () => {
    const { applicationId, playerId } = await applicant();

    await tryouts.recordScreening(manager, applicationId, {
      status: "APPROVED",
    });
    const evaluation = await evaluations.requestEvaluation(manager, {
      playerId,
      templateId,
      evaluatorId: coachStaffId,
      applicationId,
    });
    createdEvaluationIds.push(evaluation.id);

    const queues = await talent.getPipelineQueues(manager, { tryoutId });

    // Assigned but unfinished: in neither queue. Nobody is blocked — the
    // coach is holding it.
    expect(queues.awaitingEvaluator.map((row) => row.id)).not.toContain(
      applicationId,
    );
    expect(queues.awaitingDecision.map((row) => row.id)).not.toContain(
      applicationId,
    );
  });

  it("reaches the decision queue once an evaluation is submitted", async () => {
    const { applicationId, playerId } = await applicant();

    await tryouts.recordScreening(manager, applicationId, {
      status: "APPROVED",
    });
    const evaluation = await evaluations.requestEvaluation(manager, {
      playerId,
      templateId,
      evaluatorId: coachStaffId,
      applicationId,
    });
    createdEvaluationIds.push(evaluation.id);

    const template = await prisma.evaluationTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { criteria: true },
    });

    await evaluations.saveEvaluation(coach, evaluation.id, {
      scores: template.criteria.map((criterion) => ({
        criterionId: criterion.id,
        score: criterion.maxScore,
      })),
      recommendation: "ACCEPT",
      submit: true,
    });

    const queues = await talent.getPipelineQueues(manager, { tryoutId });
    const row = queues.awaitingDecision.find(
      (item) => item.id === applicationId,
    );

    expect(row).toBeDefined();
    // The manager sees the score without opening anything.
    expect(row!.evaluations[0]?.overallScore).toBe(10);
    expect(row!.evaluations[0]?.recommendation).toBe("ACCEPT");

    await prisma.playerJourneyEvent.deleteMany({
      where: { playerId, type: "EVALUATION" },
    });
  });

  it("drops out of every queue once decided", async () => {
    const { applicationId } = await applicant();

    await tryouts.recordScreening(manager, applicationId, {
      status: "APPROVED",
    });
    await tryouts.decideApplication(admin, applicationId, {
      decision: "ACCEPTED",
      teamId: u14TeamId,
    });

    const queues = await talent.getPipelineQueues(manager, { tryoutId });

    for (const queue of Object.values(queues)) {
      expect(queue.map((row) => row.id)).not.toContain(applicationId);
    }
  });

  it("puts the longest wait at the top", async () => {
    const queues = await talent.getPipelineQueues(manager, { tryoutId });
    const dates = queues.awaitingScreening.map((row) =>
      row.submittedAt.getTime(),
    );

    for (let index = 1; index < dates.length; index++) {
      expect(dates[index]!).toBeGreaterThanOrEqual(dates[index - 1]!);
    }
  });
});

describe("the funnel", () => {
  it("counts what the queues describe", async () => {
    const pipeline = await talent.getTalentPipeline(manager, { tryoutId });

    const applied = await prisma.tryoutApplication.count({
      where: { tryoutId },
    });
    expect(pipeline.counts.applied).toBe(applied);

    const accepted = await prisma.tryoutApplication.count({
      where: { tryoutId, status: "ACCEPTED" },
    });
    expect(pipeline.counts.accepted).toBe(accepted);

    expect(pipeline.stages[0]!.value).toBe(applied);
    expect(pipeline.stages[0]!.share).toBe(100);
  });

  /** The figure that would otherwise make the last bar look like a bug. */
  it("reports an acceptance nobody evaluated", async () => {
    const before = await talent.getTalentPipeline(manager, { tryoutId });

    const { applicationId } = await applicant();
    await tryouts.recordScreening(manager, applicationId, {
      status: "APPROVED",
    });
    await tryouts.decideApplication(admin, applicationId, {
      decision: "ACCEPTED",
      teamId: u14TeamId,
    });

    const after = await talent.getTalentPipeline(manager, { tryoutId });
    expect(after.acceptedWithoutEvaluation).toBe(
      before.acceptedWithoutEvaluation + 1,
    );
  });

  it("separates a screening rejection from a rejection after it", async () => {
    const early = await applicant();
    await tryouts.recordScreening(manager, early.applicationId, {
      status: "REJECTED",
      note: "مدارک ناقص",
    });

    const late = await applicant();
    await tryouts.recordScreening(manager, late.applicationId, {
      status: "APPROVED",
    });
    await tryouts.decideApplication(admin, late.applicationId, {
      decision: "REJECTED",
      note: "پس از ارزیابی",
    });

    const pipeline = await talent.getTalentPipeline(manager, { tryoutId });
    expect(pipeline.counts.rejectedAtScreening).toBeGreaterThan(0);
    expect(pipeline.counts.rejectedAfterScreening).toBeGreaterThan(0);
  });

  it("counts every season when asked to", async () => {
    const thisSeason = await talent.getTalentPipeline(manager, {});
    const everySeason = await talent.getTalentPipeline(manager, {
      allSeasons: true,
    });

    expect(everySeason.seasonName).toBeNull();
    expect(everySeason.counts.applied).toBeGreaterThanOrEqual(
      thisSeason.counts.applied,
    );
  });
});

describe("who may read the pipeline", () => {
  it("refuses a coach, who holds no tryout permission", async () => {
    await expect(talent.getTalentPipeline(coach, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await expect(talent.getPipelineQueues(coach, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows the academy manager", async () => {
    await expect(talent.getTalentPipeline(manager, {})).resolves.toBeDefined();
  });
});
