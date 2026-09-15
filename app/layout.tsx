import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "آکادمی سپاهان",
    template: "%s | آکادمی سپاهان",
  },
  description:
    "سامانه مدیریت آکادمی باشگاه فولاد مبارکه سپاهان — مدارس ورزشی، تیم‌ها، استعدادیابی، تمرین و عملکرد",
  applicationName: "SEPahan Academy OS",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2b705",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
