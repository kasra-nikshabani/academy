"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toEnglishDigits } from "@/lib/utils/number";

export function LoginForm() {
  const router = useRouter();
  const [mobile, setMobile] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const body = await response.json();

      if (!body.success) {
        setError(body.error?.message ?? "ارسال کد انجام نشد.");
        return;
      }

      router.push("/verify");
    } catch {
      setError("ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="mobile">شماره موبایل</Label>
        <Input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          autoFocus
          dir="ltr"
          className="text-center tracking-widest"
          placeholder="09123456789"
          value={mobile}
          aria-invalid={error !== null}
          aria-describedby={error ? "mobile-error" : undefined}
          // Persian and Arabic-Indic keyboards are normalised as the user types
          // so the field never looks "wrong" to someone using their own layout.
          onChange={(event) => setMobile(toEnglishDigits(event.target.value))}
        />
      </div>

      {error ? (
        <Alert variant="destructive" id="mobile-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        دریافت کد تأیید
      </Button>
    </form>
  );
}
