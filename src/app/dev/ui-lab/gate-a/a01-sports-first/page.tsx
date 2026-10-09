"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { heroMatchPresentation, squadMetrics, lineupPreview } from "./fixtures";
import { LineupList } from "./lineup-list";
import { LineupContextualInspector } from "./lineup-contextual-inspector";

/**
 * `/dev/ui-lab/gate-a/a01-sports-first` — A01 candidate (`20_UI_LAB_CANDIDATE_WAVES.md`): proves
 * a task/football-object-first visual hierarchy using only real Touchline primitives — one
 * dominant object (the live match, `variant="feature"`), two clearly secondary widgets below it.
 * Deliberately NOT a row of equal-weight metric tiles (XR-S02).
 *
 * PR #777 remediation (XR-I01, context-local interaction): the "Lineup" quick action previously
 * navigated to the A02 lifecycle demonstration — a violation of the context-local rule — then
 * (first correction) opened a full-width `TouchlineBottomSheet` at every viewport.
 *
 * PR #777 final A01 correction: the approved responsive interaction grammar is desktop =
 * contextual inspector beside the football object, smartphone = focused bottom sheet (confirmed
 * against the F6 directional study's "context-preserving desktop inspector / mobile sheet"
 * pattern). `useMediaQuery` picks exactly one presentation to render — never both — sharing one
 * `lineupOpen` state, one trigger, and one `LineupList`/fixture, so desktop and mobile can never
 * drift into separate sources of truth. The mobile sheet now uses `tone="utility"` (a solid
 * surface) instead of the glass tone, fixing a readability regression where underlying page text
 * showed through the sheet's background. `TouchlineBottomSheet` itself is untouched — this is a
 * call-site prop choice, within UI Lab scope.
 */
export default function A01SportsFirstPage() {
  const [lineupOpen, setLineupOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  // Focus restoration: capture whatever was focused right before opening (works for either
  // presentation, since both call the same closeLineup), and return focus to it on close.
  const lineupTriggerRef = useRef<HTMLElement | null>(null);

  const openLineup = () => {
    lineupTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLineupOpen(true);
  };

  const closeLineup = () => {
    setLineupOpen(false);
    lineupTriggerRef.current?.focus();
  };

  const matchReference = `${heroMatchPresentation.homeTeam} vs ${heroMatchPresentation.awayTeam}`;
  const showInspector = lineupOpen && isDesktop;
  const showSheet = lineupOpen && !isDesktop;

  return (
    <div
      className={cn(
        "touchline mx-auto flex flex-col gap-6 px-4 py-8",
        showInspector ? "max-w-[920px] medium:flex-row medium:items-start" : "max-w-[480px]",
      )}
    >
      <div className={cn("flex min-w-0 flex-col gap-6", showInspector && "medium:w-[480px] medium:shrink-0")}>
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
              { key: "lineup", label: "Lineup", icon: ClipboardList, onClick: openLineup },
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

      {showInspector ? (
        <LineupContextualInspector
          matchReference={matchReference}
          entries={lineupPreview}
          onClose={closeLineup}
          className="medium:flex-1"
        />
      ) : null}

      <TouchlineBottomSheet
        isOpen={showSheet}
        onClose={closeLineup}
        title="Lineup"
        description={`${matchReference} — context-local preview, stays on this page. Read-only; no production mutation.`}
        tone="utility"
      >
        <LineupList entries={lineupPreview} />
      </TouchlineBottomSheet>
    </div>
  );
}
