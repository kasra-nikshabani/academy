"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatJalaliDateTime } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { NOTIFICATION_CLASS, NOTIFICATION_LABEL } from "./notification-meta";
import type { NotificationType } from "@/lib/generated/prisma/enums";

export interface AnnouncementRowProps {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  audience: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  recipients: number;
  /** False for a reader: the same row, without the send button. */
  canPublish: boolean;
}

/**
 * One announcement, and the button that sends it.
 *
 * Publishing asks first. It reaches every family in the audience at once and
 * cannot be taken back, which is exactly the shape of action that should not
 * happen on a single stray click.
 */
export function AnnouncementRow({
  id,
  title,
  body,
  type,
  audience,
  status,
  publishedAt,
  recipients,
  canPublish,
}: AnnouncementRowProps) {
  const router = useRouter();
  const [sending, setSending] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  async function publish(): Promise<void> {
    setSending(true);
    try {
      const response = await fetch(`/api/v1/announcements/${id}/publish`, {
        method: "POST",
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: { message?: unknown } }).error
            ?.message === "string"
            ? (payload as { error: { message: string } }).error.message
            : "انتشار اطلاعیه انجام نشد.";
        toast.error(message);
        return;
      }

      toast.success("اطلاعیه منتشر شد");
      setConfirming(false);
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="space-y-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge className={cn("text-[10px]", NOTIFICATION_CLASS[type])}>
            {NOTIFICATION_LABEL[type]}
          </Badge>
          <Badge variant={status === "PUBLISHED" ? "secondary" : "outline"}>
            {status === "PUBLISHED" ? "منتشر‌شده" : "پیش‌نویس"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {audience}
          {status === "PUBLISHED" && publishedAt ? (
            <>
              {" · "}
              {toPersianDigits(formatJalaliDateTime(new Date(publishedAt)))}
              {" · "}
              {toPersianDigits(recipients)} گیرنده
            </>
          ) : null}
        </p>

        {canPublish && status === "DRAFT" ? (
          confirming ? (
            <span className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={publish}
                disabled={sending}
              >
                {sending ? "در حال ارسال…" : "بله، ارسال کن"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={sending}
              >
                انصراف
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setConfirming(true)}
            >
              انتشار
            </Button>
          )
        ) : null}
      </div>
    </li>
  );
}
