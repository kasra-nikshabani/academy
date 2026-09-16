import type { Metadata } from "next";
import { ApplicationStatusLookup } from "@/components/tryouts/application-status-lookup";

export const metadata: Metadata = { title: "پیگیری درخواست" };

export default function TryoutStatusPage() {
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">پیگیری درخواست</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          کد پیگیری و شماره موبایلی که هنگام ثبت‌نام وارد کردید را بنویسید.
        </p>
      </header>

      <ApplicationStatusLookup />
    </>
  );
}
