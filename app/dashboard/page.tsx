import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { AlertList } from "@/components/dashboard/alert-list";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { AttendanceTrendChart } from "@/components/dashboard/attendance-trend-chart";
import { SportDistribution } from "@/components/dashboard/sport-distribution";
import { SchedulePreview } from "@/components/dashboard/schedule-preview";
import { TalentFunnel } from "@/components/talent/talent-funnel";
import { Can } from "@/components/auth/can";
import { getCurrentUser } from "@/lib/auth";
import {
  canSeeAcademy,
  canSeeSystem,
  getAcademyOverview,
  getFamilySummary,
  getSquadSummary,
  getSystemOverview,
  hasOwnPlayers,
  hasSquads,
} from "@/lib/services/dashboard.service";
import { findRoleDefinition } from "@/lib/permissions/roles";
import { metricDefinition } from "@/lib/services/performance-metrics";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "داشبورد" };
export const dynamic = "force-dynamic";

/** Weeks that actually have a rate — a null week is a gap, not a zero. */
function measuredWeeks(trend: readonly { rate: number | null }[]): number {
  return trend.filter((point) => point.rate !== null).length;
}

/**
 * The dashboard.
 *
 * **One page, assembled from the sections this caller has a right to** — not
 * one page per role. A user can hold several roles (the seed carries a coach
 * who is also a parent), and five routes cannot answer where that person
 * lands without inventing a precedence rule and then showing them half of who
 * they are. See the note in `lib/services/dashboard.service.ts`.
 *
 * Each section is fetched only when it applies, and each service still checks
 * for itself — what is rendered here is a consequence of authorization, never
 * the mechanism of it.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [showAcademy, showSquad, showFamily] = await Promise.all([
    Promise.resolve(canSeeAcademy(user)),
    hasSquads(user),
    hasOwnPlayers(user),
  ]);

  const [academy, squad, family, system] = await Promise.all([
    showAcademy ? getAcademyOverview(user) : null,
    showSquad ? getSquadSummary(user) : null,
    showFamily ? getFamilySummary(user) : null,
    canSeeSystem(user) ? getSystemOverview(user) : null,
  ]);

  const roleNames = user.roles.map((key) => findRoleDefinition(key).name);

  return (
    <>
      <PageHeader
        title="داشبورد"
        description={
          academy?.season
            ? `فصل ${academy.season.name}`
            : "نمای کلی آنچه به شما مربوط است"
        }
        actions={
          <div className="flex flex-wrap justify-end gap-1.5">
            {roleNames.map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        }
      />

      {/* --- the academy, for a manager or an administrator --- */}
      {academy ? (
        <>
          {/* Two columns even on a phone: eight tiles stacked singly pushed
              the charts four screens down, and a tile is narrow enough that
              two fit at 375px. */}
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="کل بازیکنان"
              value={academy.counts.players}
              hint={`${toPersianDigits(academy.counts.activePlayers)} فعال`}
              href="/dashboard/people/players"
            />
            <StatCard
              label="بازیکنان تیم‌ها"
              value={academy.counts.teamPlayers}
              hint={`${toPersianDigits(academy.counts.teams)} تیم فعال`}
              href="/dashboard/academy/teams"
            />
            <StatCard
              label="بازیکنان مدرسه"
              value={academy.counts.schoolPlayers}
              hint={`${toPersianDigits(academy.counts.schools)} مدرسه`}
              href="/dashboard/academy/schools"
            />
            <StatCard
              label="نرخ حضور"
              value={
                academy.attendance.overall === null
                  ? "—"
                  : `${toPersianDigits(academy.attendance.overall)}٪`
              }
              hint="هشت هفته گذشته"
            />
            <StatCard
              label="استعدادیابی فعال"
              value={academy.counts.openTryouts}
              hint={`${toPersianDigits(academy.pipeline.applied)} درخواست`}
              href="/dashboard/tryouts"
            />
            <StatCard
              label="در انتظار غربالگری"
              value={academy.pipeline.pendingScreening}
              href="/dashboard/talent"
            />
            <StatCard
              label="نرخ تبدیل"
              value={
                academy.conversion === null
                  ? "—"
                  : `${toPersianDigits(academy.conversion)}٪`
              }
              hint="از درخواست تا پذیرش"
              href="/dashboard/talent"
            />
            <StatCard
              label="کادر فنی"
              value={academy.counts.staff}
              hint={`${toPersianDigits(academy.counts.sports)} رشته`}
              href="/dashboard/people/staff"
            />
          </dl>

          {academy.alerts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">نیازمند رسیدگی</CardTitle>
              </CardHeader>
              <CardContent>
                <AlertList alerts={academy.alerts} />
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">رشد بازیکنان</CardTitle>
              </CardHeader>
              <CardContent>
                <GrowthChart points={academy.growth} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">روند حضور</CardTitle>
              </CardHeader>
              <CardContent>
                <AttendanceTrendChart points={academy.attendance.trend} />
                {/* Shown whenever the chart is not: one measured week is a
                    figure, not a trend, and an eight-week chart of it is an
                    empty box with a dot in the corner. */}
                {measuredWeeks(academy.attendance.trend) < 2 ? (
                  <p className="text-sm text-muted-foreground">
                    {academy.attendance.overall === null
                      ? "هنوز حضور و غیابی ثبت نشده است."
                      : `تنها یک هفته ثبت شده است — نرخ حضور ${toPersianDigits(academy.attendance.overall)}٪. روند از هفته دوم رسم می‌شود.`}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">توزیع رشته‌ها</CardTitle>
              </CardHeader>
              <CardContent>
                <SportDistribution items={academy.sports} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">قیف استعدادیابی</CardTitle>
              </CardHeader>
              <CardContent>
                <TalentFunnel stages={academy.funnel} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* --- the system, for an administrator ---

           `PRODUCT_SPEC.md` §9 asks an administrator for a system view beside
           the academy one, and this is it: accounts and access rather than
           players and training. An academy manager runs the academy and does
           not administer accounts, so they do not see it.

           Wrapped in `<Can>` as well as guarded on the server. The wrapper is
           presentation — it keeps the section out of an administrator-less
           page — and `getSystemOverview` checks the same permission again,
           which is where access is actually decided. */}
      <Can user={user} permission="user:read">
        {system ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">مدیریت کاربران</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="حساب‌های کاربری"
                  value={system.users}
                  hint={`${toPersianDigits(system.activeUsers)} فعال`}
                />
                <StatCard
                  label="ورود در هفته گذشته"
                  value={system.recentLogins}
                />
                <StatCard
                  label="حساب مسدود"
                  value={system.blockedUsers}
                  hint={system.blockedUsers === 0 ? "موردی نیست" : undefined}
                />
                <StatCard
                  label="نقش‌های تعریف‌شده"
                  value={system.roles}
                  hint={
                    system.unlinkedAccounts > 0
                      ? `${toPersianDigits(system.unlinkedAccounts)} حساب بدون فرد`
                      : undefined
                  }
                />
              </dl>
            </CardContent>
          </Card>
        ) : null}
      </Can>

      {/* --- the squads a coach is responsible for ---
           Shown whenever they have squads, not only when something is
           scheduled: a quiet week is exactly when «حضور و غیاب ثبت‌نشده»
           matters most, and hiding the section then hid it. */}
      {squad ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تیم‌های من</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="نرخ حضور"
                value={
                  squad.attendance.overall === null
                    ? "—"
                    : `${toPersianDigits(squad.attendance.overall)}٪`
                }
                hint="هشت هفته گذشته"
              />
              <StatCard
                label="حضور و غیاب ثبت‌نشده"
                value={squad.sessionsWithoutRegister}
                href="/dashboard/training"
              />
              <StatCard
                label="ارزیابی باز"
                value={squad.openEvaluations}
                href="/dashboard/evaluations"
              />
            </dl>

            <SchedulePreview
              sessions={squad.sessions}
              matches={squad.matches}
            />

            <AttendanceTrendChart points={squad.attendance.trend} />
          </CardContent>
        </Card>
      ) : null}

      {/* --- a player's or a parent's own people --- */}
      {family && family.players.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {family.ownRecord ? "پرونده من" : "فرزندان من"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y divide-border rounded-lg border border-border">
              {family.players.map((player) => {
                const latest = family.latestMeasurements.filter(
                  (record) => record.playerId === player.id,
                );

                return (
                  <li
                    key={player.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                  >
                    <Link
                      href={`/dashboard/people/players/${player.id}`}
                      className="font-medium hover:underline"
                    >
                      {player.firstName} {player.lastName}
                    </Link>

                    <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {latest.slice(0, 3).map((record) => {
                        const definition = metricDefinition(record.metric);
                        return (
                          <span key={record.id} className="tabular-nums">
                            {definition.label}{" "}
                            <span className="font-medium text-foreground">
                              {toPersianDigits(
                                record.value.toFixed(definition.decimals),
                              )}
                            </span>{" "}
                            {definition.unit}
                          </span>
                        );
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>

            <SchedulePreview
              sessions={family.sessions}
              matches={family.matches}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* --- nothing applied --- */}
      {!academy && !squad && !family && !system ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">خوش آمدید</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              هنوز تیمی یا بازیکنی به حساب شما متصل نشده است. وقتی مدیر آکادمی
              شما را به تیمی اضافه کند، برنامه و آمار همین‌جا نمایش داده می‌شود.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/notifications">اعلان‌های من</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
