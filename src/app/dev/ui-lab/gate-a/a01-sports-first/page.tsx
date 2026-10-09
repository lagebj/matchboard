"use client";

import Link from "next/link";
import { ClipboardList, Users, CalendarDays } from "lucide-react";
import {
  AppearanceControl,
  OperationalMatchCard,
  TouchlineWidget,
  WidgetHeader,
  MetricStrip,
  QuickActionGrid,
} from "@/components/touchline";
import { heroMatchPresentation, squadMetrics } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a01-sports-first` — A01 candidate (`20_UI_LAB_CANDIDATE_WAVES.md`): proves
 * a task/football-object-first visual hierarchy using only real Touchline primitives — one
 * dominant object (the live match, `variant="feature"`), two clearly secondary widgets below it.
 * Deliberately NOT a row of equal-weight metric tiles (XR-S02).
 */
export default function A01SportsFirstPage() {
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
            { key: "lineup", label: "Edit lineup", icon: ClipboardList, href: "/dev/ui-lab/gate-a/a02-match-lifecycle" },
            { key: "squad", label: "Players", icon: Users, href: "/dev/ui-lab/gate-a/a12-profile-editor" },
            { key: "fixtures", label: "Fixtures", icon: CalendarDays, href: "/dev/ui-lab/gate-a" },
          ]}
        />
      </TouchlineWidget>

      <p className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3 text-[11px] text-[var(--text-muted)]">
        Hierarchy check: the match card is visually ~2× the weight of either widget below it. No
        two elements on this page compete for the same attention level.
      </p>
    </div>
  );
}
