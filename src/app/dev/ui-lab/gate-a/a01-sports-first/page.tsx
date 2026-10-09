"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, Users, CalendarDays } from "lucide-react";
import {
  AppearanceControl,
  OperationalMatchCard,
  TouchlineWidget,
  WidgetHeader,
  MetricStrip,
  QuickActionGrid,
  TouchlineBottomSheet,
} from "@/components/touchline";
import { heroMatchPresentation, squadMetrics, lineupPreview } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a01-sports-first` — A01 candidate (`20_UI_LAB_CANDIDATE_WAVES.md`): proves
 * a task/football-object-first visual hierarchy using only real Touchline primitives — one
 * dominant object (the live match, `variant="feature"`), two clearly secondary widgets below it.
 * Deliberately NOT a row of equal-weight metric tiles (XR-S02).
 *
 * PR #777 remediation (XR-I01, context-local interaction): the "Lineup" quick action previously
 * navigated to the A02 lifecycle demonstration — a different scenario standing in for a real
 * action, which violated the context-local rule entirely. It now opens a read-only lineup
 * preview in place (`TouchlineBottomSheet`, confirmed against the F6 directional study's
 * "Edit lineup" drawer pattern: stays on this page, dims the page behind it, closes back to
 * exactly where it was) — no navigation, no new route, no production mutation.
 */
export default function A01SportsFirstPage() {
  const [lineupOpen, setLineupOpen] = useState(false);

  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate A candidates
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A01 — Sports-first composition</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          The live match is the single dominant object on this page. Squad status and quick
          actions are secondary, smaller, and clearly subordinate — not a uniform grid of equal
          tiles.
        </p>
      </div>

      <AppearanceControl />

      <OperationalMatchCard presentation={heroMatchPresentation} variant="feature" contextLine="Saturday · Home · Slemmestad" />

      <TouchlineWidget tone="support" padding="normal">
        <WidgetHeader title="Squad status" />
        <div className="mt-3">
          <MetricStrip items={squadMetrics} />
        </div>
      </TouchlineWidget>

      <TouchlineWidget tone="utility" padding="compact">
        <QuickActionGrid
          actions={[
            { key: "lineup", label: "Lineup", icon: ClipboardList, onClick: () => setLineupOpen(true) },
            { key: "squad", label: "Players", icon: Users, href: "/dev/ui-lab/gate-a/a12-profile-editor" },
            { key: "fixtures", label: "Fixtures", icon: CalendarDays, href: "/dev/ui-lab/gate-a" },
          ]}
        />
      </TouchlineWidget>

      <p className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3 text-[11px] text-[var(--text-muted)]">
        Hierarchy check: the match card is visually ~2× the weight of either widget below it. No
        two elements on this page compete for the same attention level.
      </p>

      <TouchlineBottomSheet
        isOpen={lineupOpen}
        onClose={() => setLineupOpen(false)}
        title="Lineup"
        description="Rød vs Sætre Lions — context-local preview, stays on this page. Read-only; no production mutation."
        tone="context"
      >
        <ul className="flex flex-col gap-1.5" data-testid="lineup-preview-list">
          {lineupPreview.map((entry) => (
            <li
              key={`${entry.slot}-${entry.number}`}
              className="flex items-center justify-between rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[13px] text-[var(--foreground)]"
            >
              <span>
                <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {entry.slot}
                </span>
                {entry.name}
              </span>
              <span className="text-[12px] text-[var(--text-muted)]">#{entry.number}</span>
            </li>
          ))}
        </ul>
      </TouchlineBottomSheet>
    </div>
  );
}
