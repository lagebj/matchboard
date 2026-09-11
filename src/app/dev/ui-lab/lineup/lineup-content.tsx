"use client";

import { useState } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import {
  TouchlineButton,
  TouchlineBottomSheet,
  TouchlineInspector,
  BenchRail,
  PositionFitList,
  PlayerContextHeader,
} from "@/components/touchline";
import { TacticsBoard } from "@/components/formations/tactics-board";
import { useIsLargeViewport } from "../use-is-large-viewport";
import {
  lineupSlots,
  lineupAssignments,
  lineupPlayers,
  lineupBench,
  lineupSelectedPlayerFit,
} from "../fixtures";

/**
 * Golden: lineup-mobile (390×844). Touchline Finish & Visual Convergence
 * follow-up (`06_TACTICS_LINEUP_AND_PITCH.md §6 §7`). Compact order:
 * title/context → formation/match selectors → pitch → Bench/Candidates tabs →
 * bench rail → selected-player bottom sheet. Desktop (≥1200px) instead shows
 * a `TouchlineInspector` beside the pitch — the same "sheet on compact,
 * inspector on desktop" split Tactics uses — never both at once. The
 * reference's "17 matches · 4 goals · 3 assists" sheet detail line is
 * illustrative — omitted here rather than queried/fabricated (no such
 * per-player stat is already loaded on this surface).
 */
export function LineupContent() {
  const [tab, setTab] = useState<"bench" | "candidates">("bench");
  const [selected, setSelected] = useState<string | null>(lineupBench[0]?.id ?? null);
  const selectedPlayer = lineupBench.find((p) => p.id === selected);
  const isLarge = useIsLargeViewport();

  return (
    <>
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="text-[24px] font-[650] leading-tight text-[var(--foreground)]">Lineup</h1>
          <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">Rød vs Graabein United</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TouchlineButton variant="primary" size="sm">Save</TouchlineButton>
          <TouchlineButton variant="ghost" size="sm" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </TouchlineButton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="flex h-9 items-center justify-between gap-2 rounded-[var(--tl-c-radius-control)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] px-3 text-left"
        >
          <span>
            <span className="block text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Formation</span>
            <span className="block text-[14px] font-[650] text-[var(--foreground)]">4-3-3</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        </button>
        <button
          type="button"
          className="flex h-9 items-center justify-between gap-2 rounded-[var(--tl-c-radius-control)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] px-3 text-left"
        >
          <span>
            <span className="block text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Match</span>
            <span className="block text-[14px] font-[650] text-[var(--foreground)]">Sat 13:00</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-6 large:flex-row">
        <div className="min-w-0 flex-1">
          <TacticsBoard
            mode="lineup-assignment"
            orientation="vertical"
            size="standard"
            slots={lineupSlots}
            assignments={lineupAssignments}
            players={lineupPlayers}
            readOnly={false}
          />

          <div className="mt-5">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)]">
              <div className="flex gap-4">
                {(["bench", "candidates"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={
                      "relative pb-2.5 text-[15px] font-[600] capitalize " +
                      (tab === t ? "text-[var(--foreground)]" : "text-[var(--text-muted)]")
                    }
                  >
                    {t}
                    {tab === t ? (
                      <span aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] w-full bg-[var(--accent)]" />
                    ) : null}
                  </button>
                ))}
              </div>
              <span className="pb-2.5 text-[13px] text-[var(--text-muted)]">{lineupBench.length} players</span>
            </div>
            <div className="mt-3">
              <BenchRail players={lineupBench} selectedId={selected} onSelect={(id) => setSelected(id)} />
            </div>
          </div>
        </div>

        <div className="hidden large:block">
          <TouchlineInspector
            title={selectedPlayer?.name ?? "Select a player"}
            headline={selectedPlayer?.role}
            number={selectedPlayer?.number}
          >
            <PositionFitList entries={lineupSelectedPlayerFit} selectedTier="NATURAL" />
          </TouchlineInspector>
        </div>
      </div>

      <TouchlineBottomSheet
        isOpen={selectedPlayer != null && !isLarge}
        onClose={() => setSelected(null)}
        title="Positional fit"
        hero={
          selectedPlayer ? (
            <PlayerContextHeader name={selectedPlayer.name} role={selectedPlayer.role} number={selectedPlayer.number} />
          ) : null
        }
        ariaLabel="Selected player"
        footer={<TouchlineButton variant="primary" fullWidth>Assign to slot</TouchlineButton>}
      >
        <PositionFitList entries={lineupSelectedPlayerFit} selectedTier="NATURAL" />
      </TouchlineBottomSheet>
    </>
  );
}
