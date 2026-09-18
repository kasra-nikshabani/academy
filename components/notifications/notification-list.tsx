"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatJalaliDateTime } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { NOTIFICATION_CLASS, NOTIFICATION_LABEL } from "./notification-meta";
import type { NotificationType } from "@/lib/generated/prisma/enums";

export interface InboxItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListProps {
  items: readonly InboxItem[];
}

/**
 * The inbox.
 *
 * Read state is kept locally as well as on the server so pressing a
 * notification dims it at once; `router.refresh()` then brings the badge in
 * the shell back in step. Waiting for the round trip to redraw a row the
 * reader is already looking at feels broken even when it is fast.
 *
 * **Reading is not a navigation.** Marking one read does not follow its link —
 * a parent scanning what happened this week should be able to clear the badge
 * without being thrown into six different pages. The link is separate and
 * says where it goes.
 */
export function NotificationList({ items }: NotificationListProps) {
  const router = useRouter();
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  const isRead = (item: InboxItem): boolean =>
    item.readAt !== null || readIds.has(item.id);

  const unread = items.filter((item) => !isRead(item));

  async function markRead(id: string): Promise<void> {
    setReadIds((current) => new Set(current).add(id));

    const response = await fetch(`/api/v1/notifications/${id}`, {
      method: "PATCH",
    });

    if (!response.ok) {
      // Put it back: a row that looks read but is not would leave the badge
      // disagreeing with the list.
      setReadIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      toast.error("ثبت خوانده‌شدن انجام نشد.");
      return;
    }

    router.refresh();
  }

  async function markAll(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) {
        toast.error("ثبت خوانده‌شدن انجام نشد.");
        return;
      }
      setReadIds(new Set(items.map((item) => item.id)));
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {unread.length === 0
            ? "همه اعلان‌ها خوانده شده‌اند."
            : `${toPersianDigits(unread.length)} اعلان خوانده‌نشده`}
        </p>

        {unread.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={markAll}
            disabled={busy}
          >
            خواندن همه
          </Button>
        ) : null}
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((item) => {
          const read = isRead(item);

          return (
            <li
              key={item.id}
              className={cn(
                "flex flex-wrap items-start gap-3 p-3 transition-colors",
                read ? "bg-card" : "bg-accent/30",
              )}
            >
              {/* An unread dot as well as the tint: colour alone is not a
                  channel everyone can read. */}
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  read ? "bg-transparent" : "bg-brand-strong",
                )}
              />

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-sm",
                      read ? "font-normal" : "font-semibold",
                    )}
                  >
                    {item.title}
                  </p>
                  <Badge
                    className={cn("text-[10px]", NOTIFICATION_CLASS[item.type])}
                  >
                    {NOTIFICATION_LABEL[item.type]}
                  </Badge>
                </div>

                {item.body ? (
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                ) : null}

                <p className="text-[11px] text-muted-foreground">
                  {toPersianDigits(
                    formatJalaliDateTime(new Date(item.createdAt)),
                  )}
                  {read ? " · خوانده شد" : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {item.link ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={item.link}>مشاهده</Link>
                  </Button>
                ) : null}

                {read ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => markRead(item.id)}
                  >
                    خواندم
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
