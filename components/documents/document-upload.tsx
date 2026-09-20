"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_TYPE_LABEL, formatBytes } from "./document-meta";
import { DOCUMENT_TYPES } from "@/lib/validation/document";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/limits";

export interface DocumentUploadProps {
  personId: string;
}

/** What the file picker offers. The server checks the bytes regardless. */
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/**
 * Attaching a document.
 *
 * The `accept` attribute and the size check here are **conveniences**: they
 * save a parent the round trip of uploading a twenty-megabyte scan before
 * being told no. Neither is a control — the server reads the file's leading
 * bytes and decides what it is, because both the declared type and the
 * filename are things the uploader chose (lib/storage/signature.ts).
 *
 * `FormData`, not JSON: this is the one request in the system that carries a
 * file, and base64 in a JSON body would inflate it by a third for nothing.
 */
export function DocumentUpload({ personId }: DocumentUploadProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [type, setType] = React.useState<string>("ID_DOCUMENT");
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");

  async function upload(): Promise<void> {
    if (!file) {
      toast.error("فایلی انتخاب نشده است.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`حجم فایل بیش از ${formatBytes(MAX_UPLOAD_BYTES)} است.`);
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("personId", personId);
      form.set("type", type);
      if (title.trim()) form.set("title", title.trim());

      const response = await fetch("/api/v1/documents", {
        method: "POST",
        body: form,
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
            : "بارگذاری سند انجام نشد.";
        toast.error(message);
        return;
      }

      toast.success("سند بارگذاری شد");
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="document-type" className="text-xs">
            نوع سند
          </Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="document-type" disabled={uploading}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {DOCUMENT_TYPE_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="document-title" className="text-xs">
            عنوان (اختیاری)
          </Label>
          <Input
            id="document-title"
            value={title}
            disabled={uploading}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثلاً: شناسنامه صفحه اول"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="document-file" className="text-xs">
          فایل
        </Label>

        {/* The native control is hidden rather than styled.
            A browser writes its own «Choose File / No file chosen» into the
            input and no CSS can translate it — an English control in the
            middle of a Persian form. The input still does the work and still
            carries the label; what a person sees and clicks is this. */}
        <input
          id="document-file"
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          disabled={uploading}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="sr-only"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            انتخاب فایل
          </Button>

          <span className="min-w-0 truncate text-sm text-muted-foreground">
            {file
              ? `${file.name} — ${formatBytes(file.size)}`
              : "فایلی انتخاب نشده است"}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground">
          JPEG، PNG، WebP یا PDF — حداکثر {formatBytes(MAX_UPLOAD_BYTES)}
        </p>
      </div>

      <Button type="button" onClick={upload} disabled={uploading || !file}>
        {uploading ? "در حال بارگذاری…" : "بارگذاری سند"}
      </Button>
    </div>
  );
}
