import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  assertWithinScope,
  hasPermission,
  requirePermission,
  resolveTeamScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import {
  findActiveSeason,
  findTeamById,
  listTeamsByIds,
} from "@/lib/repositories/academy.repository";
import * as repo from "@/lib/repositories/report.repository";
import {
  APPLICATION_STATUS_LABEL,
  ATTENDANCE_STATUS_LABEL,
  HOME_AWAY_LABEL,
  MATCH_STATUS_LABEL,
  OUTCOME_LABEL,
  PLAYER_STATUS_LABEL,
  RECOMMENDATION_LABEL,
  SCREENING_STATUS_LABEL,
} from "@/lib/labels";
import { attendanceRate, tally } from "./attendance-summary";
import { matchOutcome } from "./match-result";
import type { ReportColumn, ReportResult } from "@/lib/reports/definitions";
import { formatJalaliNumeric, toJalali } from "@/lib/utils/date";
import type { ReportQuery } from "@/lib/validation/report";

/**
 * Reports: what happened over a period, in a form that can leave the system.
 *
 * ## How this differs from the dashboard
 *
 * The dashboard answers "how are things now" and is read on screen. A report
 * answers "what happened between these dates" and is read in a spreadsheet, by
 * someone who will sort it, total it and attach it to an email. That second
 * audience is why the numbers come out in Latin digits and why nothing here
 * carries a national code, a mobile number or a medical note: a file that
 * leaves the building takes whatever is in it with it (CLAUDE.md §27).
 *
 * ## Dates in an export
 *
 * Jalali, written `۱۴۰۵/۰۶/۲۴` on screen but `1405/06/24` in the file. That
 * form is both readable by the person who opens it and **sorts correctly as
 * text**, which an Excel user will do by clicking the column header. A
 * Gregorian ISO date would sort too and be unreadable to the reader; a spelled
 * month would be readable and sort alphabetically, which is worse than either.
 */

/** Latin-digit Jalali: readable, and sorts correctly as text. */
function exportDate(date: Date | null | undefined): string {
  if (!date) return "";
  const { jy, jm, jd } = toJalali(date);
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

/** The same instant for a person, in Persian digits. */
function screenDate(date: Date | null | undefined): string {
  return date ? formatJalaliNumeric(date) : "—";
}

export const REPORT_SLUGS = [
  "attendance",
  "matches",
  "roster",
  "applications",
] as const;

export type ReportSlug = (typeof REPORT_SLUGS)[number];

/** What each report needs, so the page can say why one is unavailable. */
export const REPORT_PERMISSION: Record<ReportSlug, string> = {
  attendance: "attendance:read",
  matches: "match:read",
  roster: "enrollment:read",
  applications: "tryout:read",
};

// --- attendance --------------------------------------------------------------

interface AttendanceReportRow {
  playerCode: string;
  name: string;
  team: string;
  sessions: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number | null;
}

const ATTENDANCE_COLUMNS: readonly ReportColumn<AttendanceReportRow>[] = [
  { header: "کد بازیکن", value: (row) => row.playerCode },
  { header: "نام", value: (row) => row.name },
  { header: "تیم", value: (row) => row.team },
  { header: "جلسه", value: (row) => row.sessions, numeric: true },
  {
    header: ATTENDANCE_STATUS_LABEL.PRESENT,
    value: (row) => row.present,
    numeric: true,
  },
  {
    header: ATTENDANCE_STATUS_LABEL.LATE,
    value: (row) => row.late,
    numeric: true,
  },
  {
    header: ATTENDANCE_STATUS_LABEL.ABSENT,
    value: (row) => row.absent,
    numeric: true,
  },
  {
    header: ATTENDANCE_STATUS_LABEL.EXCUSED,
    value: (row) => row.excused,
    numeric: true,
  },
  {
    header: "نرخ حضور (٪)",
    // Null, not zero, and not "—": a player with only excused absences has no
    // rate, and writing 0 into a spreadsheet column that gets averaged is how
    // a report lies (docs/BUSINESS_RULES.md §14).
    value: (row) => row.rate,
    display: (row) => (row.rate === null ? "—" : `${row.rate}٪`),
    numeric: true,
  },
];

/**
 * One row per player, not one per attendance record.
 *
 * A register export that listed every row would be the raw table; what a
 * manager asks for is "how did each of them do over the term", which is this.
 */
async function buildAttendance(
  range: repo.ReportRange,
): Promise<AttendanceReportRow[]> {
  const rows = await repo.listAttendanceRows(range);

  const byPlayer = new Map<
    string,
    { row: AttendanceReportRow; statuses: string[] }
  >();

  for (const record of rows) {
    const key = record.player.id;
    const existing = byPlayer.get(key);

    if (existing) {
      existing.statuses.push(record.status);
      existing.row.sessions += 1;
      continue;
    }

    byPlayer.set(key, {
      statuses: [record.status],
      row: {
        playerCode: record.player.playerCode,
        name: `${record.player.person.firstName} ${record.player.person.lastName}`,
        team: record.trainingSession.team.name,
        sessions: 1,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        rate: null,
      },
    });
  }

  return [...byPlayer.values()]
    .map(({ row, statuses }) => {
      const totals = tally(statuses as never);
      return {
        ...row,
        present: totals.present,
        late: totals.late,
        absent: totals.absent,
        excused: totals.excused,
        rate: attendanceRate(totals),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

// --- matches -----------------------------------------------------------------

type MatchRow = Awaited<ReturnType<typeof repo.listMatchRows>>[number];

const MATCH_COLUMNS: readonly ReportColumn<MatchRow>[] = [
  {
    header: "تاریخ",
    value: (row) => exportDate(row.kickoffAt),
    display: (row) => screenDate(row.kickoffAt),
  },
  { header: "تیم", value: (row) => row.team.name },
  { header: "حریف", value: (row) => row.opponent },
  { header: "رقابت", value: (row) => row.competition ?? "" },
  { header: "میزبانی", value: (row) => HOME_AWAY_LABEL[row.homeAway] },
  {
    header: "وضعیت",
    value: (row) => MATCH_STATUS_LABEL[row.status] ?? row.status,
  },
  { header: "گل زده", value: (row) => row.goalsFor, numeric: true },
  { header: "گل خورده", value: (row) => row.goalsAgainst, numeric: true },
  {
    header: "نتیجه",
    value: (row) => {
      const outcome = matchOutcome(row);
      return outcome ? OUTCOME_LABEL[outcome] : "";
    },
    display: (row) => {
      const outcome = matchOutcome(row);
      return outcome ? OUTCOME_LABEL[outcome] : "—";
    },
  },
  { header: "نفرات ترکیب", value: (row) => row._count.lineup, numeric: true },
];

// --- roster ------------------------------------------------------------------

type RosterRow = Awaited<ReturnType<typeof repo.listRosterRows>>[number];

const ROSTER_COLUMNS: readonly ReportColumn<RosterRow>[] = [
  { header: "تیم", value: (row) => row.team.name },
  { header: "شماره", value: (row) => row.jerseyNumber, numeric: true },
  { header: "کد بازیکن", value: (row) => row.player.playerCode },
  {
    header: "نام",
    value: (row) =>
      `${row.player.person.firstName} ${row.player.person.lastName}`,
  },
  {
    header: "سال تولد",
    // The birth *year*, not the date: an age band is decided by the year
    // (docs/BUSINESS_RULES.md §4), and a full date of birth is more than a
    // team sheet needs to leave the building with.
    value: (row) =>
      row.player.person.dateOfBirth
        ? toJalali(row.player.person.dateOfBirth).jy
        : "",
    numeric: true,
  },
  { header: "پست", value: (row) => row.player.position ?? "" },
  {
    header: "وضعیت",
    value: (row) => PLAYER_STATUS_LABEL[row.player.status],
  },
  { header: "فصل", value: (row) => row.season.name },
  {
    header: "تاریخ پیوستن",
    value: (row) => exportDate(row.joinedAt),
    display: (row) => screenDate(row.joinedAt),
  },
];

// --- applications ------------------------------------------------------------

type ApplicationRow = Awaited<
  ReturnType<typeof repo.listApplicationRows>
>[number];

const APPLICATION_COLUMNS: readonly ReportColumn<ApplicationRow>[] = [
  { header: "کد پیگیری", value: (row) => row.trackingCode },
  {
    header: "تاریخ ثبت",
    value: (row) => exportDate(row.submittedAt),
    display: (row) => screenDate(row.submittedAt),
  },
  { header: "دوره", value: (row) => row.tryout.title },
  { header: "رده سنی", value: (row) => row.tryout.ageGroup.code },
  {
    header: "نام",
    value: (row) =>
      `${row.player.person.firstName} ${row.player.person.lastName}`,
  },
  { header: "کد بازیکن", value: (row) => row.player.playerCode },
  {
    header: "غربالگری",
    value: (row) =>
      row.screening ? SCREENING_STATUS_LABEL[row.screening.status] : "",
  },
  {
    header: "نمره ارزیابی",
    value: (row) => row.evaluations[0]?.overallScore ?? null,
    numeric: true,
  },
  {
    header: "توصیه ارزیاب",
    value: (row) => {
      const recommendation = row.evaluations[0]?.recommendation;
      return recommendation ? RECOMMENDATION_LABEL[recommendation] : "";
    },
  },
  { header: "وضعیت", value: (row) => APPLICATION_STATUS_LABEL[row.status] },
  {
    header: "تاریخ تصمیم",
    value: (row) => exportDate(row.decidedAt),
    display: (row) => screenDate(row.decidedAt),
  },
];

// --- running one -------------------------------------------------------------

const DEFINITIONS = {
  attendance: {
    title: "گزارش حضور و غیاب",
    description: "خلاصه حضور هر بازیکن در بازه انتخاب‌شده",
    columns: ATTENDANCE_COLUMNS,
  },
  matches: {
    title: "گزارش مسابقات",
    description: "فهرست مسابقات و نتایج در بازه انتخاب‌شده",
    columns: MATCH_COLUMNS,
  },
  roster: {
    title: "فهرست بازیکنان تیم",
    description: "اعضای فعال تیم در فصل انتخاب‌شده",
    columns: ROSTER_COLUMNS,
  },
  applications: {
    title: "گزارش استعدادیابی",
    description: "درخواست‌ها، غربالگری، ارزیابی و تصمیم",
    columns: APPLICATION_COLUMNS,
  },
} as const;

/** Every report a caller may run, for the picker. */
export function availableReports(caller: AuthorizedUser) {
  return REPORT_SLUGS.filter((slug) =>
    hasPermission(caller, REPORT_PERMISSION[slug] as never),
  ).map((slug) => ({
    slug,
    title: DEFINITIONS[slug].title,
    description: DEFINITIONS[slug].description,
  }));
}

/**
 * Resolves the window and the teams, and refuses a team out of reach.
 *
 * Team scope, not schedule scope: a report is a management document, and the
 * wider reach that lets a parent see their child's calendar is not a licence
 * to export that squad's register.
 */
async function resolveRange(
  caller: AuthorizedUser,
  query: ReportQuery,
): Promise<{ range: repo.ReportRange; scopeLabel: string }> {
  const teamIds = await resolveTeamScope(caller);
  if (query.teamId) assertWithinScope(teamIds, query.teamId);

  if (query.from && query.to && query.from >= query.to) {
    throw new ValidationError(
      "بازه گزارش نادرست است؛ «از» باید پیش از «تا» باشد.",
    );
  }

  const season = query.seasonId ? null : await findActiveSeason();
  const seasonId = query.seasonId ?? season?.id;

  const team = query.teamId ? await findTeamById(query.teamId) : null;
  if (query.teamId && !team) {
    throw new ValidationError("تیم انتخاب‌شده وجود ندارد.");
  }

  const parts = [
    team ? team.name : "همه تیم‌های در دسترس",
    query.from || query.to
      ? `${query.from ? screenDate(query.from) : "…"} تا ${query.to ? screenDate(query.to) : "…"}`
      : season
        ? `فصل ${season.name}`
        : "همه بازه‌ها",
  ];

  return {
    range: {
      teamIds,
      ...(seasonId ? { seasonId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    },
    scopeLabel: parts.join(" · "),
  };
}

/** Runs a report and returns its columns and rows. */
export async function runReport(
  caller: AuthorizedUser,
  slug: ReportSlug,
  query: ReportQuery,
): Promise<ReportResult<never>> {
  requirePermission(caller, REPORT_PERMISSION[slug] as never);

  const { range, scopeLabel } = await resolveRange(caller, query);
  const definition = DEFINITIONS[slug];

  const rows =
    slug === "attendance"
      ? await buildAttendance(range)
      : slug === "matches"
        ? await repo.listMatchRows(range)
        : slug === "roster"
          ? await repo.listRosterRows(range)
          : await repo.listApplicationRows(range);

  // The shape of the report, never its contents: a report is made of the
  // records this system exists to protect (CLAUDE.md §27).
  logger.info("report run", {
    slug,
    rows: rows.length,
    teamId: query.teamId,
    actorId: caller.id,
  });

  return {
    slug,
    title: definition.title,
    description: definition.description,
    columns: definition.columns as never,
    rows: rows as never,
    scopeLabel,
  };
}

/** The teams a caller may run a report over — the filter's options. */
export async function listReportTeams(caller: AuthorizedUser) {
  return listTeamsByIds(await resolveTeamScope(caller));
}
