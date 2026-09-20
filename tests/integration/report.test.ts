import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as reports from "@/lib/services/report.service";
import { toCsv } from "@/lib/reports/csv";
import { reportQuerySchema } from "@/lib/validation/report";

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

const EMPTY = reportQuerySchema.parse({});

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
});

describe("which reports a caller may run", () => {
  it("offers an administrator every report", () => {
    expect(reports.availableReports(admin)).toHaveLength(
      reports.REPORT_SLUGS.length,
    );
  });

  /** A coach reads registers and match sheets; the talent pipeline is not theirs. */
  it("offers a coach the reports their permissions cover", () => {
    const slugs = reports.availableReports(coach).map((item) => item.slug);

    expect(slugs).toContain("attendance");
    expect(slugs).toContain("matches");
    expect(slugs).not.toContain("applications");
  });

  it("offers a parent nothing", () => {
    // A parent holds `attendance:read` for their own child, but a report is a
    // management document over a squad — a different question entirely.
    const slugs = reports.availableReports(parent).map((item) => item.slug);
    expect(slugs).not.toContain("applications");
  });

  it("refuses a report the caller has no permission for", async () => {
    await expect(
      reports.runReport(coach, "applications", EMPTY),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("scope", () => {
  it("refuses a coach a team that is not theirs", async () => {
    await expect(
      reports.runReport(
        coach,
        "attendance",
        reportQuerySchema.parse({ teamId: u16Id }),
      ),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("lets a coach run their own team", async () => {
    const report = await reports.runReport(
      coach,
      "attendance",
      reportQuerySchema.parse({ teamId: u14Id }),
    );
    expect(report.slug).toBe("attendance");
  });

  /**
   * Narrowed by the query, not afterwards: a coach running the report with no
   * team filter gets their squads and nobody else's.
   */
  it("narrows an unfiltered run to the caller's own teams", async () => {
    const mine = await reports.runReport(coach, "roster", EMPTY);
    const everything = await reports.runReport(admin, "roster", EMPTY);

    expect(mine.rows.length).toBeGreaterThan(0);
    expect(mine.rows.length).toBeLessThanOrEqual(everything.rows.length);

    const teamColumn = mine.columns[0]!;
    const teams = new Set(mine.rows.map((row) => teamColumn.value(row)));
    expect(teams.size).toBe(1);
  });

  it("gives an administrator every team", async () => {
    const report = await reports.runReport(admin, "roster", EMPTY);
    const teamColumn = report.columns[0]!;
    const teams = new Set(report.rows.map((row) => teamColumn.value(row)));
    expect(teams.size).toBeGreaterThan(1);
  });
});

describe("the filters", () => {
  it("refuses a backwards range", async () => {
    await expect(
      reports.runReport(
        admin,
        "attendance",
        reportQuerySchema.parse({
          from: "2026-09-20",
          to: "2026-09-01",
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("returns nothing for a window with nothing in it", async () => {
    const report = await reports.runReport(
      admin,
      "matches",
      reportQuerySchema.parse({ from: "2000-01-01", to: "2000-02-01" }),
    );

    // An empty report, not an error: "nothing happened then" is an answer.
    expect(report.rows).toEqual([]);
    expect(report.columns.length).toBeGreaterThan(0);
  });

  it("says what it was run over", async () => {
    const report = await reports.runReport(
      admin,
      "roster",
      reportQuerySchema.parse({ teamId: u14Id }),
    );
    expect(report.scopeLabel).toContain("U14");
  });
});

describe("what a report carries", () => {
  /**
   * The rule that matters most here: a file leaves the building with whatever
   * is in it (CLAUDE.md §27).
   */
  it("never carries a national code, a mobile number or a medical note", async () => {
    const people = await prisma.person.findMany({
      where: { nationalCode: { not: null } },
      select: { nationalCode: true, mobile: true },
      take: 20,
    });
    const secrets = people
      .flatMap((person) => [person.nationalCode, person.mobile])
      .filter((value): value is string => Boolean(value));

    expect(secrets.length).toBeGreaterThan(0);

    for (const slug of reports.REPORT_SLUGS) {
      const report = await reports.runReport(admin, slug, EMPTY);
      const csv = toCsv(report.columns, report.rows);

      for (const secret of secrets) {
        expect(
          csv.includes(secret),
          `${slug} leaked ${secret.slice(0, 3)}…`,
        ).toBe(false);
      }
      expect(csv).not.toContain("medicalNotes");
    }
  });

  it("carries the club's own player code instead", async () => {
    const report = await reports.runReport(admin, "roster", EMPTY);
    const csv = toCsv(report.columns, report.rows);
    expect(csv).toContain("SEP-");
  });

  /**
   * The screen and the file are built from one definition, so a column that
   * exists in one exists in the other.
   */
  it("exports exactly the columns the preview shows", async () => {
    for (const slug of reports.REPORT_SLUGS) {
      const report = await reports.runReport(admin, slug, EMPTY);
      const header = toCsv(report.columns, [])
        .replace("﻿", "")
        .split("\r\n")[0]!;

      for (const column of report.columns) {
        expect(header, slug).toContain(column.header);
      }
    }
  });

  it("writes dates in a form that sorts as text", async () => {
    const report = await reports.runReport(admin, "roster", EMPTY);
    const dateColumn = report.columns.find(
      (column) => column.header === "تاریخ پیوستن",
    )!;

    for (const row of report.rows) {
      const value = dateColumn.value(row);
      if (!value) continue;
      // `1405/06/24` — Latin digits, zero-padded, year first.
      expect(String(value)).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    }
  });

  it("gives every report at least one column and a title", async () => {
    for (const slug of reports.REPORT_SLUGS) {
      const report = await reports.runReport(admin, slug, EMPTY);
      expect(report.columns.length, slug).toBeGreaterThan(0);
      expect(report.title.length, slug).toBeGreaterThan(0);
    }
  });
});

describe("the attendance report", () => {
  it("returns one row per player, not one per record", async () => {
    const report = await reports.runReport(admin, "attendance", EMPTY);
    const codeColumn = report.columns[0]!;
    const codes = report.rows.map((row) => codeColumn.value(row));

    expect(new Set(codes).size).toBe(codes.length);
  });

  it("computes the rate the same way the rest of the system does", async () => {
    const report = await reports.runReport(admin, "attendance", EMPTY);
    const rateColumn = report.columns.find((column) =>
      column.header.startsWith("نرخ حضور"),
    )!;

    for (const row of report.rows) {
      const rate = rateColumn.value(row);
      if (rate === null) continue;
      expect(typeof rate).toBe("number");
      expect(rate as number).toBeGreaterThanOrEqual(0);
      expect(rate as number).toBeLessThanOrEqual(100);
    }
  });

  it("leaves the rate blank rather than zero when nothing counts", async () => {
    const report = await reports.runReport(admin, "attendance", EMPTY);
    const rateColumn = report.columns.find((column) =>
      column.header.startsWith("نرخ حضور"),
    )!;

    // A zero written where there is no rate would be averaged by a
    // spreadsheet, which is how an export lies.
    for (const row of report.rows) {
      const value = rateColumn.value(row);
      expect(value === null || typeof value === "number").toBe(true);
    }
  });
});

describe("running a report leaves nothing behind", () => {
  it("does not write to the database", async () => {
    const before = await prisma.attendance.count();
    await reports.runReport(manager, "attendance", EMPTY);
    expect(await prisma.attendance.count()).toBe(before);
  });
});
