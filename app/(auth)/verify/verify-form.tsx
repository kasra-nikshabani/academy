"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toEnglishDigits, toPersianDigits } from "@/lib/utils/number";

export interface VerifyFormProps {
  mobile: string;
}

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyForm({ mobile }: VerifyFormProps) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN_SECONDS);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    try {
      const response = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code }),
      });
      const body = await response.json();

      if (!body.success) {
        setError(body.error?.message ?? "کد تأیید نادرست است.");
        setCode("");
        return;
      }

      // Server Components must re-read the new session cookie.
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.");
    } finally {
      setPending(false);
    }
  }

  async function handleResend(): Promise<void> {
    setError(null);
    setNotice(null);

    const response = await fetch("/api/v1/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const body = await response.json();

    if (body.success) {
      setNotice("کد جدید ارسال شد.");
      setCooldown(body.data?.cooldownSeconds ?? RESEND_COOLDOWN_SECONDS);
    } else {
      setError(body.error?.message ?? "ارسال مجدد انجام نشد.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="code">کد تأیید</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          dir="ltr"
          className="text-center text-lg tracking-[0.5em]"
          placeholder="------"
          value={code}
          aria-invalid={error !== null}
          aria-describedby={error ? "code-error" : undefined}
          onChange={(event) =>
            setCode(toEnglishDigits(event.target.value).replace(/\D/g, ""))
          }
        />
      </div>

      {error ? (
        <Alert variant="destructive" id="code-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={pending || code.length !== 6}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        ورود
      </Button>

      <div className="flex items-center justify-between text-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={cooldown > 0}
          onClick={handleResend}
        >
          {cooldown > 0
            ? `ارسال مجدد تا ${toPersianDigits(cooldown)} ثانیه`
            : "ارسال مجدد کد"}
        </Button>

        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => router.push("/login")}
        >
          تغییر شماره
        </Button>
      </div>
    </form>
  );
}
