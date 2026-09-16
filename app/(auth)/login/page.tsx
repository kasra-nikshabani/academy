import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "ورود",
  description: "ورود به سامانه آکادمی با شماره موبایل",
};

export default async function LoginPage() {
  // Already signed in — no reason to ask again.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">ورود به سامانه</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          شماره موبایل خود را وارد کنید. کد تأیید برای همین شماره پیامک می‌شود.
        </p>
      </div>

      <LoginForm />
    </div>
  );
}
