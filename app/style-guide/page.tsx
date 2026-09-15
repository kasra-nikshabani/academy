import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { StyleGuideView } from "./style-guide-view";

export const metadata: Metadata = {
  title: "راهنمای طراحی",
  description: "مرجع داخلی Design System — توکن‌ها، تایپوگرافی و کامپوننت‌ها",
};

/**
 * Internal reference for the design system: every base component rendered in
 * one place, in RTL, so regressions are visible at a glance. Holds no data.
 */
export default function StyleGuidePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <PageHeader
        title="راهنمای طراحی"
        description="مرجع داخلی Design System آکادمی سپاهان. همه کامپوننت‌های پایه، توکن‌های رنگ و قالب‌های نمایش تاریخ و عدد در این صفحه دیده می‌شوند."
      />
      <StyleGuideView />
    </main>
  );
}
