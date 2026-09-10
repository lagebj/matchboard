import type { ReactNode } from "react";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isProduction } from "@/lib/env";
import { UiLabFrame } from "./ui-lab-frame";
import "@/app/touchline.css";

/**
 * `/dev/ui-lab` — the visual-reset proving ground and human-approval gate
 * (ADR-0134 §10, bundle `13_UI_LAB_AND_GOLDEN_GATE.md`).
 *
 * Development/test only. 404 in production, no auth, no organisation context, no
 * database — it renders the seven golden reference screens from the in-memory
 * fixtures in `./fixtures.ts`. Everything below renders inside the `.touchline`
 * activation scope so the new token system is fully live here while production
 * routes are untouched.
 */
export const metadata = {
  title: "Matchboard — UI Lab",
  robots: { index: false, follow: false },
};

export default function UiLabLayout({ children }: { children: ReactNode }) {
  if (isProduction()) {
    notFound();
  }

  return (
    <div className="touchline touchline-canvas min-h-screen">
      <Suspense fallback={null}>
        <UiLabFrame>{children}</UiLabFrame>
      </Suspense>
    </div>
  );
}
