import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names and de-duplicate conflicting Tailwind utilities.
 * Implemented locally rather than pulled from a micro-package (CLAUDE.md §2:
 * no dependency without a technical reason).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
