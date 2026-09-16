import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { getPlayer } from "@/lib/services/people.service";
import {
  listPlayerEnrollments,
  listPlayerMemberships,
} from "@/lib/services/enrollment.service";
import { getPlayerJourney } from "@/lib/services/journey.service";
import { getPlayerRegister } from "@/lib/services/attendance.service";
import { PlayerJourney } from "@/components/players/player-journey";
import { AttendanceSummary } from "@/components/training/attendance-summary";
import { hasPermission } from "@/lib/permissions";
import { formatJalali, toJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "پرونده بازیکن" };
export const dynamic = "force-dynamic";

const ENROLLMENT_STATUS: Record<string, string> = {
  PENDING: "در انتظار",
  ACTIVE: "فعال",
  TRANSFERRED: "منتقل‌شده",
  COMPLETED: "پایان‌یافته",
  CANCELLED: "لغو‌شده",
};

const MEMBERSHIP_STATUS: Record<string, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  RELEASED: "جدا‌شده",
};

const RELATION: Record<string, string> = {
  FATHER: "پدر",
  MOTHER: "مادر",
  GRANDPARENT: "پدربزرگ/مادربزرگ",
  SIBLING: "خواهر/برادر",
  LEGAL_GUARDIAN: "قیم قانونی",
  OTHER: "سایر",
};

/**
 * A player's record.
 *
 * `getPlayer` refuses an id outside the caller's scope before it looks the
 * record up, so swapping the id in the URL for another family's child returns
 * the same answer as an id that does not exist.
 */
export default async function PlayerPage(props: {
  params: Promise<{ id: string }>;
}) {
  const caller = await requireUser();
  const { id } = await props.params;
  const [player, enrollments, memberships, journey, attendance] =
    await Promise.all([
      getPlayer(caller, id),
      listPlayerEnrollments(caller, id),
      listPlayerMemberships(caller, id),
      getPlayerJourney(caller, id),
      hasPermission(caller, "attendance:read")
        ? getPlayerRegister(caller, id)
        : null,
    ]);

  return (
    <>
      <PageHeader
        title={`${player.person.firstName} ${player.person.lastName}`}
        description={`کد بازیکن ${player.playerCode}`}
        actions={<Badge variant="secondary">فعال</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">اطلاعات فردی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              {
                label: "تاریخ تولد",
                value: player.person.dateOfBirth
                  ? formatJalali(player.person.dateOfBirth)
                  : "—",
              },
              {
                label: "سال تولد",
                value: player.person.dateOfBirth
                  ? toPersianDigits(toJalali(player.person.dateOfBirth).jy)
                  : "—",
              },
              { label: "شهر", value: player.person.city ?? "—" },
              { label: "پست بازی", value: player.position ?? "—" },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">اولیا</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {player.guardians.length === 0 ? (
              <p className="text-muted-foreground">ولی‌ای ثبت نشده است.</p>
            ) : (
              player.guardians.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span>
                    {link.guardian.person.firstName}{" "}
                    {link.guardian.person.lastName}
                    <span className="text-muted-foreground">
                      {" "}
                      · {RELATION[link.relation] ?? "سایر"}
                    </span>
                  </span>
                  {link.isPrimary ? (
                    <Badge className="bg-brand text-brand-foreground">
                      تماس اصلی
                    </Badge>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">مدرسه ورزشی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {enrollments.length === 0 ? (
              <p className="text-muted-foreground">ثبت‌نامی وجود ندارد.</p>
            ) : (
              enrollments.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span>
                    {row.school.name}
                    <span className="text-muted-foreground">
                      {" "}
                      · {row.season.name}
                    </span>
                  </span>
                  <Badge
                    variant={row.status === "ACTIVE" ? "secondary" : "outline"}
                  >
                    {ENROLLMENT_STATUS[row.status] ?? row.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">عضویت تیمی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {memberships.length === 0 ? (
              <p className="text-muted-foreground">عضویتی وجود ندارد.</p>
            ) : (
              memberships.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span>
                    {row.team.name}
                    <span className="text-muted-foreground">
                      {" "}
                      · {row.season.name}
                    </span>
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    {row.isPrimary ? (
                      <Badge className="bg-brand text-brand-foreground">
                        تیم اصلی
                      </Badge>
                    ) : null}
                    <Badge
                      variant={
                        row.status === "ACTIVE" ? "secondary" : "outline"
                      }
                    >
                      {MEMBERSHIP_STATUS[row.status] ?? row.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {attendance ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">حضور و غیاب</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceSummary
              totals={attendance.totals}
              rate={attendance.rate}
              entries={attendance.entries}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">مسیر بازیکن</CardTitle>
        </CardHeader>
        <CardContent>
          <PlayerJourney entries={journey} />
        </CardContent>
      </Card>
    </>
  );
}
