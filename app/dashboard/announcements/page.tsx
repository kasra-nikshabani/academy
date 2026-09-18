import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { AnnouncementComposer } from "@/components/notifications/announcement-composer";
import { AnnouncementRow } from "@/components/notifications/announcement-row";
import { requireUser } from "@/lib/auth";
import {
  canPublish,
  canSendAnnouncements,
  listAnnouncements,
} from "@/lib/services/announcement.service";
import { listScheduleTeams } from "@/lib/services/training.service";
import {
  AUDIENCE_LABEL,
  audienceKind,
} from "@/lib/services/announcement-audience";
import { isUnscoped } from "@/lib/permissions/scope";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";

export const metadata: Metadata = { title: "اطلاعیه‌ها" };
export const dynamic = "force-dynamic";

/**
 * Announcements: what the club has told people, and the form for telling them
 * something new.
 *
 * A reader without `notification:send` sees the published list and no form —
 * the service returns only published rows for them regardless, so the page is
 * not what is protecting anything.
 */
export default async function AnnouncementsPage() {
  const caller = await requireUser();
  const canSend = canSendAnnouncements(caller);

  const [{ items }, teams] = await Promise.all([
    listAnnouncements(caller, { page: 1, pageSize: DEFAULT_PAGE_SIZE }),
    canSend ? listScheduleTeams(caller) : Promise.resolve([]),
  ]);

  // Per row, not once for the page: a coach may send to their own squad and
  // not to the academy, so the button belongs on some rows and not others.
  const publishable = new Set(
    (
      await Promise.all(
        items.map(async (item) =>
          (await canPublish(caller, item)) ? item.id : null,
        ),
      )
    ).filter((id): id is string => id !== null),
  );

  return (
    <>
      <PageHeader
        title="اطلاعیه‌ها"
        description="پیام‌هایی که به خانواده‌ها و کادر فنی فرستاده می‌شود"
      />

      {canSend ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">اطلاعیه تازه</CardTitle>
          </CardHeader>
          <CardContent>
            <AnnouncementComposer
              teams={teams.map((team) => ({ id: team.id, name: team.name }))}
              canAddressAcademy={isUnscoped(caller)}
            />
          </CardContent>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="اطلاعیه‌ای نیست"
          description={
            canSend
              ? "اولین اطلاعیه را از فرم بالا بنویسید."
              : "هنوز اطلاعیه‌ای منتشر نشده است."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const kind = audienceKind(item);
                const audience =
                  kind === "TEAM"
                    ? (item.team?.name ?? AUDIENCE_LABEL.TEAM)
                    : kind === "SCHOOL"
                      ? (item.school?.name ?? AUDIENCE_LABEL.SCHOOL)
                      : AUDIENCE_LABEL.ACADEMY;

                return (
                  <AnnouncementRow
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    body={item.body}
                    type={item.type}
                    audience={audience}
                    status={item.status}
                    publishedAt={
                      item.publishedAt ? item.publishedAt.toISOString() : null
                    }
                    recipients={item.recipients}
                    canPublish={publishable.has(item.id)}
                  />
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
