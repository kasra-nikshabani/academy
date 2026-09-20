import Link from "next/link";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/utils/number";

export interface StatCardProps {
  label: string;
  value: number | string;
  /** A second line: a share, a comparison, a unit. */
  hint?: string | undefined;
  /** Makes the whole tile a link when there is somewhere to go. */
  href?: string | undefined;
  className?: string | undefined;
}

/**
 * One number, named.
 *
 * The component `CLAUDE.md` §24 calls `StatCard`. A tile rather than a
 * one-bar chart: a single current value is a number, and drawing an axis
 * around it adds ink without adding information.
 *
 * Numbers are Persian and tabular, so a row of tiles lines up and a figure
 * that changes does not shuffle the ones beside it.
 */
export function StatCard({
  label,
  value,
  hint,
  href,
  className,
}: StatCardProps) {
  const body = (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">
        {typeof value === "number" ? toPersianDigits(value) : value}
      </dd>
      {hint ? (
        <dd className="mt-0.5 text-[11px] text-muted-foreground">{hint}</dd>
      ) : null}
    </>
  );

  const shell = cn(
    "rounded-lg border border-border bg-card p-3",
    href && "transition-colors hover:border-brand-strong hover:bg-accent/30",
    className,
  );

  return href ? (
    <Link href={href} className={cn(shell, "block")}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
