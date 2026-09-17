import type * as React from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { Button } from "@/components/ui/button";

/**
 * The shell for pages a visitor sees without signing in.
 *
 * Deliberately thin: the public side of the academy is a handful of pages a
 * family reaches from a poster or a message, often on a phone, often once. It
 * carries the club's identity and a way back to the list, and nothing else.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="آکادمی سپاهان">
            <BrandLockup />
          </Link>

          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tryouts">استعدادیابی</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tryouts/status">پیگیری درخواست</Link>
            </Button>
            {/* Gold on the crest black: the club's own pairing, and the one
                thing on this bar a member is looking for. */}
            <Button
              size="sm"
              className="bg-brand text-brand-foreground hover:bg-brand-strong"
              asChild
            >
              <Link href="/login">ورود</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        باشگاه فرهنگی ورزشی فولاد مبارکه سپاهان
      </footer>
    </div>
  );
}
