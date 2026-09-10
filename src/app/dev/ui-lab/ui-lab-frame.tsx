"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/**
 * UiLabFrame — applies the `?theme=` override (for deterministic light/dark
 * screenshots) to the `.touchline` scope and, optionally, constrains the
 * preview to a phone-width column when opened in a desktop browser with
 * `?frame=phone`. The screenshot harness sets the real browser viewport size,
 * so responsive breakpoints are driven by the actual viewport — `frame` is a
 * convenience for eyeballing compact screens on a big monitor only.
 */
export function UiLabFrame({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const theme = params.get("theme");
  const viewport = params.get("viewport");
  const frame = params.get("frame");

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".touchline");
    if (!root) return;
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
    return () => root.removeAttribute("data-theme");
  }, [theme]);

  const phone = frame === "phone" || viewport === "compact" || viewport === "mobile";

  if (phone && frame === "phone") {
    return (
      <div className="mx-auto min-h-screen w-full max-w-[390px] border-x border-[var(--border-soft)]">
        {children}
      </div>
    );
  }
  return <>{children}</>;
}
