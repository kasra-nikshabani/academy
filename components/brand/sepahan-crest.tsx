import Image from "next/image";
import { cn } from "@/lib/utils";
import crest from "@/public/brand/sepahan-crest.png";

export interface SepahanCrestProps {
  /** Rendered size in pixels; the crest is square. */
  size?: number;
  className?: string;
  /**
   * Decorative by default. When the crest is the only thing identifying the
   * club on a page (a bare login screen, say), pass a label instead.
   */
  label?: string;
  priority?: boolean;
}

export function SepahanCrest({
  size = 48,
  className,
  label,
  priority = false,
}: SepahanCrestProps) {
  return (
    <Image
      src={crest}
      width={size}
      height={size}
      priority={priority}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 select-none", className)}
    />
  );
}
