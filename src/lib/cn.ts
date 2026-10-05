import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Temporary touch to exercise ADR-0153 Phase D (observing the acceptance-deploy pipeline's full
// Neon/Vercel/Worker/Playwright path end-to-end) — reverted in a follow-up PR once observed.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}