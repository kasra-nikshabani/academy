"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toPersianDigits } from "@/lib/utils/number";
import { NOTIFICATION_LABEL } from "./notification-meta";
import { AUTHORABLE_TYPES } from "@/lib/validation/announcement";

export interface ComposerTeam {
  id: string;
  name: string;
}

export interface AnnouncementComposerProps {
  teams: readonly ComposerTeam[];
  /** False for a coach: they may write to their squads, not to the academy. */
  canAddressAcademy: boolean;
}

const ACADEMY = "__academy__";

/**
 * Writing an announcement.
 *
 * It saves as a **draft**. Sending is a second, separate press on the row that
 * appears below — a message to every family in a squad deserves the chance to
 * be read once more before it goes, and a single button that writes and
 * delivers never gives anyone that chance.
 *
 * The audience selector only lists what this author may address. A coach sees
 * their own squads; "کل آکادمی" appears for a manager. The server checks the
 * same thing — this just avoids offering a choice that would be refused.
 */
export function AnnouncementComposer({
  teams,
  canAddressAcademy,
}: AnnouncementComposerProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [type, setType] = React.useState<string>("INFO");
  const [audience, setAudience] = React.useState<string>(() =>
    canAddressAcademy ? ACADEMY : (teams[0]?.id ?? ACADEMY),
  );

  async function save(): Promise<void> {
    if (title.trim().length < 3 || body.trim().length < 5) {
      toast.error("عنوان و متن اطلاعیه را کامل کنید.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/announcements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          type,
          ...(audience === ACADEMY ? {} : { teamId: audience }),
        }),
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
            : "ثبت اطلاعیه انجام نشد.";
        toast.error(message);
        return;
      }

      toast.success("پیش‌نویس اطلاعیه ثبت شد");
      setTitle("");
      setBody("");
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="announcement-audience" className="text-xs">
            مخاطب
          </Label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger id="announcement-audience">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {canAddressAcademy ? (
                <SelectItem value={ACADEMY}>کل آکادمی</SelectItem>
              ) : null}
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="announcement-type" className="text-xs">
            نوع
          </Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="announcement-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTHORABLE_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {NOTIFICATION_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="announcement-title" className="text-xs">
          عنوان
        </Label>
        <Input
          id="announcement-title"
          value={title}
          disabled={saving}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="مثلاً: جابه‌جایی تمرین پنجشنبه"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="announcement-body" className="text-xs">
          متن
        </Label>
        <Textarea
          id="announcement-body"
          rows={4}
          value={body}
          disabled={saving}
          onChange={(event) => setBody(event.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          {toPersianDigits(body.trim().length)} نویسه
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "در حال ثبت…" : "ثبت پیش‌نویس"}
        </Button>
        <p className="text-xs text-muted-foreground">
          ثبت، ارسال نیست — پس از ثبت، از فهرست پایین منتشرش کنید.
        </p>
      </div>
    </div>
  );
}
