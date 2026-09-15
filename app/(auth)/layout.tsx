import { BrandLockup } from "@/components/brand/brand-lockup";

/**
 * Sign-in shell. Mobile-first: most people signing in are parents and players
 * on a phone (docs/UI_UX.md §6).
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-sidebar px-6 py-5 text-sidebar-foreground">
        <div className="mx-auto max-w-md">
          <BrandLockup size="md" className="[&_p:last-child]:text-white/70" />
        </div>
      </div>

      <main className="flex flex-1 items-start justify-center px-6 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
        باشگاه فرهنگی ورزشی فولاد مبارکه سپاهان
      </footer>
    </div>
  );
}
