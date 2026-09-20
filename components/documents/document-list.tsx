"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import {
  DOCUMENT_TYPE_CLASS,
  DOCUMENT_TYPE_LABEL,
  formatBytes,
} from "./document-meta";
import type { DocumentType } from "@/lib/generated/prisma/enums";

export interface DocumentListItem {
  id: string;
  type: DocumentType;
  contentType: string;
  sizeBytes: number;
  originalName: string;
  title: string | null;
  createdAt: string;
}

export interface DocumentListProps {
  documents: readonly DocumentListItem[];
  /** False for a reader: the same list, without the archive button. */
  canArchive: boolean;
}

/**
 * The paperwork on a person.
 *
 * Each row links to `/api/v1/documents/:id`, which is the only path to the
 * bytes and checks scope before it returns any. There is no direct file
 * address to leak.
 *
 * Archiving asks first. It is reversible in the database — the row and the
 * file both stay — but it removes the document from every list, and a consent
 * form that silently vanished is worse than one that took two clicks.
 */
export function DocumentList({ documents, canArchive }: DocumentListProps) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function archive(id: string): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/documents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("بایگانی سند انجام نشد.");
        return;
      }

      toast.success("سند بایگانی شد");
      setConfirming(null);
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">سندی ثبت نشده است.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {documents.map((document) => {
        const isImage = document.contentType.startsWith("image/");
        const Icon = isImage ? ImageIcon : FileText;

        return (
          <li
            key={document.id}
            className="flex flex-wrap items-center gap-3 p-3 text-sm"
          >
            <Icon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />

            <div className="min-w-0 flex-1">
              <a
                href={`/api/v1/documents/${document.id}`}
                // A new tab: an image opens in place and a PDF downloads, and
                // neither should replace the record the reader was looking at.
                target="_blank"
                rel="noreferrer"
                className="font-medium hover:underline"
              >
                {document.title || document.originalName}
              </a>
              <p className="text-[11px] text-muted-foreground">
                {toPersianDigits(formatJalali(new Date(document.createdAt)))}
                {" · "}
                {formatBytes(document.sizeBytes)}
              </p>
            </div>

            <Badge
              className={cn(
                "shrink-0 text-[10px]",
                DOCUMENT_TYPE_CLASS[document.type],
              )}
            >
              {DOCUMENT_TYPE_LABEL[document.type]}
            </Badge>

            {canArchive ? (
              confirming === document.id ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => archive(document.id)}
                  >
                    بایگانی کن
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirming(null)}
                  >
                    انصراف
                  </Button>
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => setConfirming(document.id)}
                >
                  بایگانی
                </Button>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
