import { randomBytes } from "node:crypto";
import { buildPaginationMeta, type PaginationQuery } from "@/lib/api";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requirePermission, type AuthorizedUser } from "@/lib/permissions";
import {
  findActiveSeason,
  findAgeGroupById,
  findSeasonById,
  findSportById,
  findTeamById,
} from "@/lib/repositories/academy.repository";
import { upsertMembership } from "@/lib/repositories/enrollment.repository";
import {
  createGuardianForPerson,
  createGuardianWithPerson,
  createPlayerForPerson,
  createPlayerWithPerson,
  findPersonByNationalCode,
  linkGuardianToPlayer,
} from "@/lib/repositories/people.repository";
import * as repo from "@/lib/repositories/tryout.repository";
import { notifyPlayer } from "./notification.service";
import { runInTransaction, type Db } from "@/lib/repositories/transaction";
import { toJalali } from "@/lib/utils/date";
import type {
  CreateTryoutInput,
  DecisionInput,
  ScreeningInput,
  SubmitApplicationInput,
  TryoutQuery,
  UpdateTryoutInput,
} from "@/lib/validation/tryout";
import { isBirthYearEligible } from "./age-group";
import { recordJourneyEvent } from "./journey.service";
import { createWithPlayerCode } from "./people.service";

/**
 * Talent: trials, applications and the paperwork check before them.
 *
 * This is the only part of the academy a stranger can write to. Everything a
 * visitor posts arrives with exactly one thing proven about it — that a code
 * sent to the number came back (lib/auth/tryout-verification.ts) — so the
 * service treats the rest as a claim and checks it: the trial is open, the
 * birth year fits the band, and the national code is not already someone
 * else's record.
 */

/**
 * The public tracking code.
 *
 * Random rather than sequential, and carrying nothing about the applicant:
 * it appears in a URL the family may share, and `SEP-T-1405-000042` would
 * announce both how many people applied and roughly when.
 *
 * Crockford's alphabet, so a code read aloud over the phone cannot be
 * confused between 0/O or 1/I/L.
 */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function generateTrackingCode(): string {
  const bytes = randomBytes(8);
  const body = [...bytes]
    .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
    .join("");
  return `SEP-T-${body}`;
}

async function requireTryout(id: string) {
  const tryout = await repo.findTryoutById(id);
  if (!tryout) throw new NotFoundError("استعدادیابی یافت نشد.");
  return tryout;
}

// --- administration ---------------------------------------------------------

export async function listTryouts(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
  filters: TryoutQuery = {},
) {
  requirePermission(caller, "tryout:read");

  const { items, total } = await repo.listTryouts({
    ...filters,
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

export async function getTryout(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "tryout:read");
  return requireTryout(id);
}

export async function createTryout(
  caller: AuthorizedUser,
  input: CreateTryoutInput,
) {
  requirePermission(caller, "tryout:write");

  const [sport, ageGroup, season] = await Promise.all([
    findSportById(input.sportId),
    findAgeGroupById(input.ageGroupId),
    input.seasonId ? findSeasonById(input.seasonId) : findActiveSeason(),
  ]);

  if (!sport) throw new ValidationError("رشته ورزشی انتخاب‌شده وجود ندارد.");
  if (!ageGroup) throw new ValidationError("رده سنی انتخاب‌شده وجود ندارد.");
  if (!season) {
    throw new ValidationError(
      "فصل فعالی تعریف نشده است؛ ابتدا فصل جاری را مشخص کنید.",
    );
  }

  // The band belongs to one sport (BUSINESS_RULES §0); a trial that pairs a
  // football band with a volleyball trial would pass every later check.
  if (ageGroup.sportId !== sport.id) {
    throw new ValidationError("رده سنی انتخاب‌شده متعلق به این رشته نیست.");
  }

  const tryout = await repo.createTryout({
    sport: { connect: { id: sport.id } },
    ageGroup: { connect: { id: ageGroup.id } },
    season: { connect: { id: season.id } },
    slug: input.slug,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.venue ? { venue: input.venue } : {}),
    opensAt: input.opensAt,
    closesAt: input.closesAt,
    ...(input.heldAt ? { heldAt: input.heldAt } : {}),
    ...(input.capacity === undefined ? {} : { capacity: input.capacity }),
    status: input.status,
    createdById: caller.id,
  });

  logger.info("tryout created", { tryoutId: tryout.id, actorId: caller.id });
  return tryout;
}

export async function updateTryout(
  caller: AuthorizedUser,
  id: string,
  input: UpdateTryoutInput,
) {
  requirePermission(caller, "tryout:write");
  const existing = await requireTryout(id);

  const opensAt = input.opensAt ?? existing.opensAt;
  const closesAt = input.closesAt ?? existing.closesAt;
  if (opensAt >= closesAt) {
    throw new ValidationError("پایان ثبت‌نام باید بعد از شروع آن باشد.");
  }

  const tryout = await repo.updateTryout(id, {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    ...(input.city === undefined ? {} : { city: input.city }),
    ...(input.venue === undefined ? {} : { venue: input.venue }),
    ...(input.opensAt === undefined ? {} : { opensAt: input.opensAt }),
    ...(input.closesAt === undefined ? {} : { closesAt: input.closesAt }),
    ...(input.heldAt === undefined ? {} : { heldAt: input.heldAt }),
    ...(input.capacity === undefined ? {} : { capacity: input.capacity }),
    ...(input.status === undefined ? {} : { status: input.status }),
  });

  logger.info("tryout updated", { tryoutId: id, actorId: caller.id });
  return tryout;
}

// --- the public side --------------------------------------------------------

/** Trials a visitor may see: open for registration, or closed but announced. */
export async function listPublicTryouts() {
  const { items } = await repo.listTryouts({
    publicOnly: true,
    skip: 0,
    take: 50,
  });
  return items;
}

export async function getPublicTryout(slug: string) {
  const tryout = await repo.findTryoutBySlug(slug);
  if (!tryout || tryout.status === "DRAFT" || tryout.status === "CANCELLED") {
    throw new NotFoundError("استعدادیابی یافت نشد.");
  }
  return tryout;
}

/** Whether the form should accept anything right now, and why not if not. */
export function registrationWindow(tryout: {
  status: string;
  opensAt: Date;
  closesAt: Date;
}): { open: boolean; reason?: string } {
  const now = new Date();

  if (tryout.status !== "OPEN") {
    return { open: false, reason: "ثبت‌نام این استعدادیابی باز نیست." };
  }
  if (now < tryout.opensAt) {
    return {
      open: false,
      reason: "ثبت‌نام این استعدادیابی هنوز شروع نشده است.",
    };
  }
  if (now > tryout.closesAt) {
    return {
      open: false,
      reason: "مهلت ثبت‌نام این استعدادیابی به پایان رسیده است.",
    };
  }
  return { open: true };
}

/** Under this age on the trial's season, a guardian's details are required. */
const GUARDIAN_REQUIRED_UNDER = 18;

/**
 * Registers an applicant for a trial.
 *
 * `verifiedMobile` comes from the signed cookie, never from the body: the
 * whole point of the OTP step is that the number is the one thing the server
 * knows, and taking it from the payload would throw that away.
 *
 * The person is matched by national code and **reused** when found. A school
 * player trying out for a main team is the ordinary path into the academy
 * (BUSINESS_RULES §1, §2 path A), and a second record for them would split
 * their history in two.
 */
export async function submitTryoutApplication(
  slug: string,
  verifiedMobile: string,
  input: SubmitApplicationInput,
) {
  const tryout = await getPublicTryout(slug);

  const window = registrationWindow(tryout);
  if (!window.open) throw new ConflictError(window.reason);

  // Age is checked here rather than left to screening: telling a family at
  // the form that their child is in a different band is kinder, and more
  // honest, than accepting the application and rejecting it a week later.
  const birthYear = toJalali(input.dateOfBirth).jy;
  if (
    !isBirthYearEligible(tryout.ageGroup, tryout.season.startYear, birthYear)
  ) {
    throw new ValidationError(
      `سال تولد با رده سنی ${tryout.ageGroup.code} هم‌خوان نیست.`,
      {
        birthYear,
        allowed: {
          from: tryout.season.startYear - tryout.ageGroup.maxAge,
          to: tryout.season.startYear - tryout.ageGroup.minAge,
        },
      },
    );
  }

  const ageInSeason = tryout.season.startYear - birthYear;
  if (ageInSeason < GUARDIAN_REQUIRED_UNDER && !input.guardian) {
    throw new ValidationError(
      "برای بازیکن زیر ۱۸ سال، ثبت اطلاعات ولی الزامی است.",
    );
  }

  const existingPerson = await findPersonByNationalCode(input.nationalCode);

  // A national code already attached to a *guardian* is a different person's
  // record, not this child's — refusing is safer than joining them.
  if (existingPerson?.player == null && existingPerson?.guardian != null) {
    throw new ConflictError(
      "این کد ملی به‌عنوان ولی در سامانه ثبت شده است؛ با آکادمی تماس بگیرید.",
    );
  }

  if (existingPerson?.player) {
    const duplicate = await repo.findApplication(
      tryout.id,
      existingPerson.player.id,
    );
    if (duplicate) {
      throw new ConflictError(
        "برای این بازیکن قبلاً در همین استعدادیابی درخواست ثبت شده است.",
        { trackingCode: duplicate.trackingCode },
      );
    }
  }

  const season = tryout.season;
  const trackingCode = generateTrackingCode();

  /**
   * The player code is read-then-written, so two registrations arriving in the
   * same second both see the same highest code. On a public form that is not
   * a rare case — it is the first minute after a trial opens — so a collision
   * is retried rather than shown to a family as "a record with these details
   * already exists", which would be both confusing and untrue.
   */
  const result = await createWithPlayerCode(season.startYear, (playerCode) =>
    runInTransaction(async (tx) => {
      const player = existingPerson?.player
        ? existingPerson.player
        : await createApplicantPlayer(
            { existingPersonId: existingPerson?.id, input, verifiedMobile },
            playerCode,
            tx,
          );

      if (input.guardian) {
        await attachGuardian(player.id, input.guardian, tx);
      }

      const application = await repo.createApplication(
        {
          tryoutId: tryout.id,
          playerId: player.id,
          trackingCode,
          position: input.position,
          dominantFoot: input.dominantFoot,
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          previousClub: input.previousClub,
          notes: input.notes,
        },
        tx,
      );

      // The timeline entry goes in with the application, like every other
      // event (docs/BUSINESS_RULES.md §12).
      await recordJourneyEvent(
        {
          playerId: player.id,
          type: "TRYOUT_REGISTERED",
          title: `ثبت‌نام در ${tryout.title}`,
          description: `کد پیگیری ${trackingCode}`,
          seasonId: season.id,
          // Nobody on staff caused this: the applicant did it themselves.
          actorId: undefined,
        },
        tx,
      );

      return { application, playerId: player.id };
    }),
  );

  // Never the national code, never the applicant's name (CLAUDE.md §27).
  logger.info("tryout application submitted", {
    tryoutId: tryout.id,
    applicationId: result.application.id,
    reusedExistingPlayer: Boolean(existingPerson?.player),
  });

  return {
    trackingCode,
    status: result.application.status,
    submittedAt: result.application.submittedAt,
  };
}

/** Creates the player behind an application, reusing a person when there is one. */
async function createApplicantPlayer(
  params: {
    existingPersonId?: string | undefined;
    input: SubmitApplicationInput;
    verifiedMobile: string;
  },
  playerCode: string,
  tx: Db,
) {
  const { input, verifiedMobile, existingPersonId } = params;

  const playerFields = {
    playerCode,
    ...(input.position ? { position: input.position } : {}),
    ...(input.dominantFoot ? { dominantFoot: input.dominantFoot } : {}),
    ...(input.heightCm === undefined ? {} : { heightCm: input.heightCm }),
    ...(input.weightKg === undefined ? {} : { weightKg: input.weightKg }),
  };

  if (existingPersonId) {
    return createPlayerForPerson(existingPersonId, playerFields, tx);
  }

  return createPlayerWithPerson(
    {
      firstName: input.firstName,
      lastName: input.lastName,
      nationalCode: input.nationalCode,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      ...(input.city ? { city: input.city } : {}),
      // A child registered by a parent has the parent's number here only when
      // no guardian is given; otherwise the guardian carries it.
      ...(input.guardian ? {} : { mobile: verifiedMobile }),
    },
    playerFields,
    tx,
  );
}

async function attachGuardian(
  playerId: string,
  guardian: NonNullable<SubmitApplicationInput["guardian"]>,
  tx: Db,
) {
  const existing = guardian.nationalCode
    ? await findPersonByNationalCode(guardian.nationalCode)
    : null;

  const record = existing
    ? (existing.guardian ?? (await createGuardianForPerson(existing.id, tx)))
    : await createGuardianWithPerson(
        {
          firstName: guardian.firstName,
          lastName: guardian.lastName,
          mobile: guardian.mobile,
          ...(guardian.nationalCode
            ? { nationalCode: guardian.nationalCode }
            : {}),
        },
        tx,
      );

  await linkGuardianToPlayer(
    {
      playerId,
      guardianId: record.id,
      relation: guardian.relation,
      isPrimary: true,
    },
    tx,
  );
}

/** The public status page: tracking code plus the number it was made with. */
export async function lookupApplication(trackingCode: string, mobile: string) {
  const application = await repo.findApplicationForTracking(
    trackingCode.trim().toUpperCase(),
    mobile,
  );

  // One answer for "no such code" and "wrong number", so the endpoint cannot
  // be used to test whether a code exists.
  if (!application) {
    throw new NotFoundError(
      "درخواستی با این کد پیگیری و شماره موبایل یافت نشد.",
    );
  }

  return application;
}

// --- screening and decision -------------------------------------------------

export async function listTryoutApplications(
  caller: AuthorizedUser,
  tryoutId: string,
  status?: string,
) {
  requirePermission(caller, "tryout:read");
  await requireTryout(tryoutId);
  return repo.listApplications({ tryoutId, ...(status ? { status } : {}) });
}

/** The funnel the academy manager watches (docs/PRODUCT_SPEC.md §5). */
export async function getTryoutFunnel(
  caller: AuthorizedUser,
  tryoutId: string,
) {
  requirePermission(caller, "tryout:read");
  await requireTryout(tryoutId);

  const [byStatus, pendingScreening] = await Promise.all([
    repo.countApplicationsByStatus(tryoutId),
    repo.countPendingScreenings(tryoutId),
  ]);

  const total = Object.values(byStatus).reduce<number>(
    (sum, count) => sum + (count ?? 0),
    0,
  );

  return {
    total,
    pendingScreening,
    submitted: byStatus["SUBMITTED"] ?? 0,
    screening: byStatus["SCREENING"] ?? 0,
    evaluation: byStatus["EVALUATION"] ?? 0,
    accepted: byStatus["ACCEPTED"] ?? 0,
    rejected: byStatus["REJECTED"] ?? 0,
    waitlist: byStatus["WAITLIST"] ?? 0,
  };
}

/**
 * Records the paperwork check.
 *
 * A rejection here ends the application; an approval moves it on rather than
 * deciding anything. The screening is not the decision — a player can pass
 * the paperwork and still not be taken.
 */
export async function recordScreening(
  caller: AuthorizedUser,
  applicationId: string,
  input: ScreeningInput,
) {
  requirePermission(caller, "tryout:write");

  const application = await repo.findApplicationById(applicationId);
  if (!application) throw new NotFoundError("درخواست یافت نشد.");

  if (["ACCEPTED", "REJECTED", "CANCELLED"].includes(application.status)) {
    throw new ConflictError(
      "این درخواست تصمیم نهایی دارد و غربالگری آن تغییر نمی‌کند.",
    );
  }

  const updated = await runInTransaction(async (tx) => {
    await repo.upsertScreening(
      applicationId,
      { ...input, checkedById: caller.id },
      tx,
    );

    const nextStatus =
      input.status === "APPROVED"
        ? "EVALUATION"
        : input.status === "REJECTED"
          ? "REJECTED"
          : "SCREENING";

    const changed = await repo.updateApplication(
      applicationId,
      {
        status: nextStatus,
        ...(input.status === "REJECTED"
          ? {
              decidedAt: new Date(),
              decidedById: caller.id,
              decisionNote: input.note ?? null,
            }
          : {}),
      },
      tx,
    );

    if (input.status === "REJECTED") {
      await recordJourneyEvent(
        {
          playerId: application.playerId,
          type: "TRYOUT_REJECTED",
          title: `عدم پذیرش در ${application.tryout.title}`,
          description: input.note ?? "در مرحله غربالگری",
          seasonId: application.tryout.seasonId,
          actorId: caller.id,
        },
        tx,
      );
    }

    return changed;
  });

  logger.info("screening recorded", {
    applicationId,
    status: input.status,
    actorId: caller.id,
  });

  return updated;
}

/**
 * The final decision — and the transaction BUSINESS_RULES §3 is about.
 *
 * Accepting does four things that must all happen or none:
 *   the application becomes ACCEPTED,
 *   the player joins the squad,
 *   the timeline records it,
 *   and — from Phase 15 — a notification goes out.
 *
 * A half-done acceptance (an accepted application with no squad place) is the
 * exact state the rule forbids, so all of it runs inside `runInTransaction`.
 * The notification is the one step not yet built; when Phase 15 adds it, it
 * goes **inside** this transaction, not after it.
 */
export async function decideApplication(
  caller: AuthorizedUser,
  applicationId: string,
  input: DecisionInput,
) {
  requirePermission(caller, "tryout:decide");

  const application = await repo.findApplicationById(applicationId);
  if (!application) throw new NotFoundError("درخواست یافت نشد.");

  if (application.decidedAt) {
    throw new ConflictError("برای این درخواست قبلاً تصمیم ثبت شده است.", {
      status: application.status,
    });
  }
  if (application.status === "CANCELLED") {
    throw new ConflictError("این درخواست لغو شده است.");
  }

  const tryout = application.tryout;

  const team =
    input.decision === "ACCEPTED" && input.teamId
      ? await findTeamById(input.teamId)
      : null;

  if (input.decision === "ACCEPTED") {
    if (!team) throw new ValidationError("تیم انتخاب‌شده وجود ندارد.");
    if (team.ageGroupId !== tryout.ageGroupId) {
      throw new ValidationError(
        `تیم انتخاب‌شده در رده ${tryout.ageGroup.code} نیست.`,
      );
    }
  }

  const decided = await runInTransaction(async (tx) => {
    const updated = await repo.updateApplication(
      applicationId,
      {
        status: input.decision,
        decidedAt: new Date(),
        decidedById: caller.id,
        decisionNote: input.note ?? null,
      },
      tx,
    );

    if (input.decision === "ACCEPTED" && team) {
      await upsertMembership(
        {
          playerId: application.playerId,
          teamId: team.id,
          seasonId: tryout.seasonId,
          isPrimary: true,
        },
        tx,
      );

      await recordJourneyEvent(
        {
          playerId: application.playerId,
          type: "TRYOUT_ACCEPTED",
          title: `پذیرش در ${tryout.title}`,
          description: `پیوستن به ${team.name}`,
          seasonId: tryout.seasonId,
          teamId: team.id,
          actorId: caller.id,
        },
        tx,
      );

      // The fourth step of the acceptance transaction, owed since Phase 10
      // (docs/BUSINESS_RULES.md §3). **Inside** the transaction, not after:
      // a family told they were accepted by a write that then rolled back is
      // worse than one told late.
      //
      // It reaches the player *and* their guardians, which is the reason this
      // module addresses a `Person` rather than a `User` — the family that
      // just applied has no account yet, and this is the message they most
      // need.
      await notifyPlayer(
        application.playerId,
        {
          type: "TRYOUT",
          title: `پذیرش در ${tryout.title}`,
          body: `شما به ${team.name} دعوت شدید.`,
          link: "/dashboard/notifications",
          actorId: caller.id,
        },
        tx,
      );
    }

    if (input.decision === "REJECTED") {
      await recordJourneyEvent(
        {
          playerId: application.playerId,
          type: "TRYOUT_REJECTED",
          title: `عدم پذیرش در ${tryout.title}`,
          description: input.note ?? "پس از ارزیابی",
          seasonId: tryout.seasonId,
          actorId: caller.id,
        },
        tx,
      );

      // Told too. A family that hears nothing assumes the decision has not
      // been made and keeps asking, which is worse for them and for the
      // office than a plain answer.
      await notifyPlayer(
        application.playerId,
        {
          type: "TRYOUT",
          title: `نتیجه ${tryout.title}`,
          body: input.note ?? "پس از ارزیابی، پذیرش انجام نشد.",
          link: "/dashboard/notifications",
          actorId: caller.id,
        },
        tx,
      );
    }

    return updated;
  });

  logger.info("tryout decision recorded", {
    applicationId,
    decision: input.decision,
    teamId: team?.id,
    actorId: caller.id,
  });

  return decided;
}
