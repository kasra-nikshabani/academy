"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export interface TryoutRegistrationProps {
  slug: string;
  /** Used to work out, from the date of birth, whether a guardian is needed. */
  seasonStartYear: number;
  /** The birth years this trial admits, for the message when one is wrong. */
  birthYears: { from: number; to: number };
}

type Step = "mobile" | "code" | "details" | "done";

/** Under this age on the trial's season, a guardian's details are required. */
const GUARDIAN_REQUIRED_UNDER = 18;

interface Details {
  firstName: string;
  lastName: string;
  nationalCode: string;
  gender: string;
  city: string;
  position: string;
  dominantFoot: string;
  heightCm: string;
  weightKg: string;
  previousClub: string;
  notes: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianMobile: string;
  guardianRelation: string;
}

const EMPTY: Details = {
  firstName: "",
  lastName: "",
  nationalCode: "",
  gender: "MALE",
  city: "",
  position: "",
  dominantFoot: "",
  heightCm: "",
  weightKg: "",
  previousClub: "",
  notes: "",
  guardianFirstName: "",
  guardianLastName: "",
  guardianMobile: "",
  guardianRelation: "FATHER",
};

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; data?: unknown; message: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof (payload as { error?: { message?: unknown } }).error?.message ===
          "string"
          ? (payload as { error: { message: string } }).error.message
          : "درخواست انجام نشد.";
      return { ok: false, message };
    }

    return {
      ok: true,
      data: (payload as { data?: unknown }).data,
      message: "",
    };
  } catch {
    return { ok: false, message: "ارتباط با سرور برقرار نشد." };
  }
}

/**
 * Public registration, in the order the spec lays it out: number → code →
 * details → submit → tracking code (CLAUDE.md §13).
 *
 * The steps are kept in one component and one page rather than spread over
 * four routes. A family filling this in on a phone should not be able to lose
 * their place by pressing back, and nothing here is worth a URL of its own —
 * the only durable thing the flow produces is the tracking code at the end.
 *
 * The verified number is never held here. It goes into an httpOnly cookie on
 * the server and comes back out there when the application is submitted, so
 * this component cannot leak it and cannot lie about it.
 */
export function TryoutRegistration({
  slug,
  seasonStartYear,
  birthYears,
}: TryoutRegistrationProps) {
  const [step, setStep] = React.useState<Step>("mobile");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [mobile, setMobile] = React.useState("");
  const [code, setCode] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState<Date | undefined>();
  const [details, setDetails] = React.useState<Details>(EMPTY);
  const [trackingCode, setTrackingCode] = React.useState("");

  const set = (patch: Partial<Details>): void =>
    setDetails((current) => ({ ...current, ...patch }));

  const birthYear = dateOfBirth ? toJalali(dateOfBirth).jy : null;
  const ageInSeason = birthYear === null ? null : seasonStartYear - birthYear;
  const guardianRequired =
    ageInSeason !== null && ageInSeason < GUARDIAN_REQUIRED_UNDER;
  const birthYearWrong =
    birthYear !== null &&
    (birthYear < birthYears.from || birthYear > birthYears.to);

  async function sendCode(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await postJson(`/api/v1/tryouts/public/${slug}/otp`, {
      mobile,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStep("code");
  }

  async function verifyCode(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await postJson(`/api/v1/tryouts/public/${slug}/otp/verify`, {
      mobile,
      code,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStep("details");
  }

  async function submit(): Promise<void> {
    if (!dateOfBirth) {
      setError("تاریخ تولد را انتخاب کنید.");
      return;
    }

    setBusy(true);
    setError(null);

    const result = await postJson(
      `/api/v1/tryouts/public/${slug}/applications`,
      {
        firstName: details.firstName,
        lastName: details.lastName,
        nationalCode: details.nationalCode,
        dateOfBirth: dateOfBirth.toISOString(),
        gender: details.gender,
        ...(details.city ? { city: details.city } : {}),
        ...(details.position ? { position: details.position } : {}),
        ...(details.dominantFoot ? { dominantFoot: details.dominantFoot } : {}),
        ...(details.heightCm ? { heightCm: Number(details.heightCm) } : {}),
        ...(details.weightKg ? { weightKg: Number(details.weightKg) } : {}),
        ...(details.previousClub ? { previousClub: details.previousClub } : {}),
        ...(details.notes ? { notes: details.notes } : {}),
        ...(guardianRequired
          ? {
              guardian: {
                firstName: details.guardianFirstName,
                lastName: details.guardianLastName,
                mobile: details.guardianMobile || mobile,
                relation: details.guardianRelation,
              },
            }
          : {}),
      },
    );
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const payload = result.data as { trackingCode?: string } | undefined;
    setTrackingCode(payload?.trackingCode ?? "");
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="space-y-4 rounded-xl border border-success/40 bg-success/5 p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          <h3 className="font-medium">درخواست شما ثبت شد</h3>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">کد پیگیری</p>
          <p className="mt-1 flex items-center gap-2">
            <bdi dir="ltr" className="font-mono text-lg font-bold">
              {trackingCode}
            </bdi>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="کپی کد پیگیری"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(trackingCode)
                  .then(() => toast.success("کد پیگیری کپی شد"))
                  .catch(() => toast.error("کپی انجام نشد"));
              }}
            >
              <Copy className="size-4" />
            </Button>
          </p>
        </div>

        <p className="text-sm leading-7">
          این کد را همراه با شماره موبایلی که وارد کردید نگه دارید؛ وضعیت
          درخواست از صفحه{" "}
          <Link
            href="/tryouts/status"
            className="font-medium underline underline-offset-4"
          >
            پیگیری درخواست
          </Link>{" "}
          قابل مشاهده است.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h3 className="font-medium">ثبت‌نام در این استعدادیابی</h3>

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {step === "mobile" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tryout-mobile">شماره موبایل</Label>
            <Input
              id="tryout-mobile"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              کد تأیید به همین شماره پیامک می‌شود. برای بازیکن زیر ۱۸ سال، شماره
              ولی را وارد کنید.
            </p>
          </div>

          <Button type="button" onClick={sendCode} disabled={busy || !mobile}>
            {busy ? "در حال ارسال…" : "دریافت کد تأیید"}
          </Button>
        </div>
      ) : null}

      {step === "code" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tryout-code">کد تأیید</Label>
            <Input
              id="tryout-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="------"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={verifyCode} disabled={busy || !code}>
              {busy ? "در حال بررسی…" : "تأیید شماره"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("mobile");
                setCode("");
                setError(null);
              }}
            >
              تغییر شماره
            </Button>
          </div>
        </div>
      ) : null}

      {step === "details" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">اطلاعات بازیکن</legend>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">نام</Label>
                <Input
                  id="firstName"
                  required
                  value={details.firstName}
                  onChange={(event) => set({ firstName: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">نام خانوادگی</Label>
                <Input
                  id="lastName"
                  required
                  value={details.lastName}
                  onChange={(event) => set({ lastName: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nationalCode">کد ملی</Label>
                <Input
                  id="nationalCode"
                  required
                  inputMode="numeric"
                  value={details.nationalCode}
                  onChange={(event) =>
                    set({ nationalCode: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth">تاریخ تولد</Label>
                <DatePicker
                  id="dateOfBirth"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  aria-invalid={birthYearWrong}
                />
                {birthYearWrong ? (
                  <p className="text-xs text-destructive">
                    این دوره برای متولدین {toPersianDigits(birthYears.from)} تا{" "}
                    {toPersianDigits(birthYears.to)} است.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">شهر</Label>
                <Input
                  id="city"
                  value={details.city}
                  onChange={(event) => set({ city: event.target.value })}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">اطلاعات ورزشی</legend>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="position">پست بازی</Label>
                <Input
                  id="position"
                  placeholder="مهاجم، هافبک، …"
                  value={details.position}
                  onChange={(event) => set({ position: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dominantFoot">پای غالب</Label>
                <Select
                  value={details.dominantFoot}
                  onValueChange={(value) => set({ dominantFoot: value })}
                >
                  <SelectTrigger id="dominantFoot">
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RIGHT">راست</SelectItem>
                    <SelectItem value="LEFT">چپ</SelectItem>
                    <SelectItem value="BOTH">هر دو</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="heightCm">قد (سانتی‌متر)</Label>
                <Input
                  id="heightCm"
                  type="number"
                  inputMode="numeric"
                  value={details.heightCm}
                  onChange={(event) => set({ heightCm: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weightKg">وزن (کیلوگرم)</Label>
                <Input
                  id="weightKg"
                  type="number"
                  inputMode="numeric"
                  value={details.weightKg}
                  onChange={(event) => set({ weightKg: event.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="previousClub">باشگاه قبلی</Label>
                <Input
                  id="previousClub"
                  value={details.previousClub}
                  onChange={(event) =>
                    set({ previousClub: event.target.value })
                  }
                />
              </div>
            </div>
          </fieldset>

          {/*
            Shown by the date of birth, not by a checkbox. A form that asks
            "is the player under 18?" invites the answer that makes the form
            shorter.
          */}
          {guardianRequired ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">
                اطلاعات ولی (برای بازیکن زیر ۱۸ سال الزامی است)
              </legend>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="guardianFirstName">نام ولی</Label>
                  <Input
                    id="guardianFirstName"
                    required
                    value={details.guardianFirstName}
                    onChange={(event) =>
                      set({ guardianFirstName: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guardianLastName">نام خانوادگی ولی</Label>
                  <Input
                    id="guardianLastName"
                    required
                    value={details.guardianLastName}
                    onChange={(event) =>
                      set({ guardianLastName: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guardianMobile">شماره موبایل ولی</Label>
                  <Input
                    id="guardianMobile"
                    inputMode="numeric"
                    placeholder={mobile}
                    value={details.guardianMobile}
                    onChange={(event) =>
                      set({ guardianMobile: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guardianRelation">نسبت</Label>
                  <Select
                    value={details.guardianRelation}
                    onValueChange={(value) => set({ guardianRelation: value })}
                  >
                    <SelectTrigger id="guardianRelation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FATHER">پدر</SelectItem>
                      <SelectItem value="MOTHER">مادر</SelectItem>
                      <SelectItem value="GRANDPARENT">
                        پدربزرگ/مادربزرگ
                      </SelectItem>
                      <SelectItem value="LEGAL_GUARDIAN">قیم قانونی</SelectItem>
                      <SelectItem value="OTHER">سایر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="notes">توضیحات</Label>
            <Textarea
              id="notes"
              rows={3}
              value={details.notes}
              onChange={(event) => set({ notes: event.target.value })}
            />
          </div>

          <Button type="submit" disabled={busy || birthYearWrong}>
            {busy ? "در حال ثبت…" : "ثبت درخواست"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
