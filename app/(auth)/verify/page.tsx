import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPendingLoginMobile } from "@/lib/auth/pending-login";
import { maskPhone } from "@/lib/logger/redact";
import { toPersianDigits } from "@/lib/utils/number";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = {
  title: "تأیید کد",
  description: "ورود به سامانه آکادمی با کد تأیید",
};

export default async function VerifyPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  // The number lives in an httpOnly cookie, never in the URL.
  const mobile = await getPendingLoginMobile();
  if (!mobile) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">کد تأیید</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          کد ۶ رقمی ارسال‌شده به شماره{" "}
          <bdi dir="ltr" className="font-medium">
            {toPersianDigits(maskPhone(mobile))}
          </bdi>{" "}
          را وارد کنید.
        </p>
      </div>

      <VerifyForm mobile={mobile} />
    </div>
  );
}
