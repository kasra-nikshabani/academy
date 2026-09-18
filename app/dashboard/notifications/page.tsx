import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { NotificationList } from "@/components/notifications/notification-list";
import { requireUser } from "@/lib/auth";
import { listMyNotifications } from "@/lib/services/notification.service";
import { canSendAnnouncements } from "@/lib/services/announcement.service";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";

export const metadata: Metadata = { title: "اعلان‌ها" };
export const dynamic = "force-dynamic";

/**
 * The caller's own inbox.
 *
 * There is no id in the route and none in the service call: an inbox is
 * reached by being its owner, not by naming it, so this page has no scope
 * check to get wrong.
 */
export default async function NotificationsPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const caller = await requireUser();
  const { page } = await props.searchParams;

  const parsed = Number(page);
  const current = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;

  const { items, meta } = await listMyNotifications(caller, {
    page: current,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  return (
    <>
      <PageHeader
        title="اعلان‌ها"
        description="آنچه درباره شما و فرزندانتان اتفاق افتاده است"
        actions={
          canSendAnnouncements(caller) ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/announcements">اطلاعیه‌ها</Link>
            </Button>
          ) : null
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="اعلانی ندارید"
          description="وقتی اتفاقی مربوط به شما رخ دهد، همین‌جا نمایش داده می‌شود."
        />
      ) : (
        <NotificationList
          items={items.map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            body: item.body,
            link: item.link,
            readAt: item.readAt ? item.readAt.toISOString() : null,
            createdAt: item.createdAt.toISOString(),
          }))}
        />
      )}

      {meta.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {current > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/notifications?page=${current - 1}`}>
                جدیدتر
              </Link>
            </Button>
          ) : null}
          {current < meta.totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/notifications?page=${current + 1}`}>
                قدیمی‌تر
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
