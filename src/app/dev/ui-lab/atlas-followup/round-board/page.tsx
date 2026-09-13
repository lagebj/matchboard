"use client";

import Link from "next/link";
import { useState } from "react";
import { AppearanceControl, TouchlineButton } from "@/components/touchline";
import { RoundStatusStrip } from "@/components/touchline/round-board/round-status-strip";
import { RoundAttentionList } from "@/components/touchline/round-board/round-attention-list";
import { RoundMatchLane } from "@/components/touchline/round-board/round-match-lane";
import { PlayerAssignmentInspector } from "@/components/touchline/round-board/player-assignment-inspector";
import { PlayerAssignmentSheet } from "@/components/touchline/round-board/player-assignment-sheet";
import { AllocationMatrix } from "@/components/touchline/round-board/allocation-matrix";
import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import type { RoundBoardAssignmentSuggestion } from "@/lib/touchline/presentation/round-board-view-model";
import { roundBoardViewModel, assignmentContextByPlayerId, allocationColumns, allocationRows } from "./fixtures";

type DesktopView = "board" | "allocation";
type MobileMode = "overview" | "matches" | "match";

export default function RoundBoardFixturePage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>("p2");
  const [desktopView, setDesktopView] = useState<DesktopView>("board");
  const [mobileMode, setMobileMode] = useState<MobileMode>("overview");
  const [mobileMatchId, setMobileMatchId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const assignmentContext = selectedPlayerId ? (assignmentContextByPlayerId[selectedPlayerId] ?? null) : null;

  function handleAssign(_suggestion: RoundBoardAssignmentSuggestion) {
    // Fixture-only: a production caller would call the same addPlayerToMatchAction /
    // movePlayerWithinRoundAction the board's drag/drop already uses (contract §3/§6).
    setSheetOpen(false);
  }

  const mobileMatch = mobileMatchId ? roundBoardViewModel.matches.find((m) => m.matchId === mobileMatchId) : null;

  return (
    <div className="touchline mx-auto flex max-w-[440px] flex-col gap-5 px-4 py-6 medium:max-w-[1400px]">
      <Link href="/dev/ui-lab/atlas-followup" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Atlas Follow-up
      </Link>
      <AppearanceControl />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-[650] text-[var(--foreground)]">Round Board</h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            Plan squads for all matches in this round. Let Matchboard suggest. You decide.
          </p>
        </div>
        <div className="hidden items-center gap-2 medium:flex">
          <span className="text-[12px] text-[var(--text-muted)]">
            {roundBoardViewModel.roundLabel} · {roundBoardViewModel.dateRangeLabel}
          </span>
          <TouchlineButton variant="secondary" size="sm">
            Auto populate
          </TouchlineButton>
          <TouchlineButton variant="primary" size="sm">
            Save round
          </TouchlineButton>
        </div>
      </div>

      {/* Desktop board/allocation toggle */}
      <div className="hidden items-center gap-1 medium:flex">
        <button
          type="button"
          onClick={() => setDesktopView("board")}
          className={`rounded-full px-3 py-1 text-[12px] font-medium ${desktopView === "board" ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]" : "text-[var(--text-muted)]"}`}
        >
          Board
        </button>
        <button
          type="button"
          onClick={() => setDesktopView("allocation")}
          className={`rounded-full px-3 py-1 text-[12px] font-medium ${desktopView === "allocation" ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]" : "text-[var(--text-muted)]"}`}
        >
          Allocation
        </button>
      </div>

      <RoundStatusStrip summary={roundBoardViewModel.summary} className="hidden medium:grid" />

      {/* --- Desktop --- */}
      {desktopView === "board" ? (
        <div className="hidden medium:grid medium:grid-cols-[1fr_1fr_1fr_1.1fr] medium:gap-4">
          {roundBoardViewModel.matches.map((lane) => (
            <RoundMatchLane key={lane.matchId} lane={lane} selectedPlayerId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId} />
          ))}
          <div className="flex flex-col gap-3">
            <RoundAttentionList items={roundBoardViewModel.attention} />
            <PlayerAssignmentInspector context={assignmentContext} onAssign={handleAssign} onClose={() => setSelectedPlayerId(null)} />
          </div>
        </div>
      ) : (
        <AllocationMatrix columns={allocationColumns} rows={allocationRows} className="hidden medium:block" />
      )}

      {/* --- Mobile --- */}
      <div className="flex flex-col gap-4 medium:hidden">
        <div className="flex gap-1 border-b border-[var(--border-soft)]">
          {(["overview", "matches"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMobileMode(m);
                setMobileMatchId(null);
              }}
              className={`px-3 py-2 text-[13px] font-medium capitalize border-b-2 -mb-px ${
                mobileMode === m || (mobileMode === "match" && m === "matches")
                  ? "border-[var(--accent-strong)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--text-muted)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {mobileMode === "overview" ? (
          <>
            <RoundStatusStrip summary={roundBoardViewModel.summary} />
            <RoundAttentionList
              items={roundBoardViewModel.attention}
              onResolve={(item) => {
                if (item.playerId) {
                  setSelectedPlayerId(item.playerId);
                  setSheetOpen(true);
                }
              }}
            />
          </>
        ) : null}

        {mobileMode === "matches" && !mobileMatch ? (
          <ul className="flex flex-col gap-2">
            {roundBoardViewModel.matches.map((lane) => (
              <li key={lane.matchId}>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMatchId(lane.matchId);
                    setMobileMode("match");
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-soft)] p-3 text-left"
                >
                  <TeamKitMark color={lane.teamKitColor} size="sm" ariaLabel={`${lane.teamName} shirt`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-[700] text-[var(--foreground)]">{lane.teamName}</p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      vs {lane.opponent} · {lane.kickoffLabel}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      lane.laneState === "COMPLETE" ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]" : "bg-[var(--warning-subtle)] text-[var(--warning)]"
                    }`}
                  >
                    {lane.laneStateDetail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {mobileMode === "match" && mobileMatch ? (
          <div>
            <button type="button" onClick={() => setMobileMatchId(null)} className="mb-2 text-[12px] text-[var(--text-muted)] hover:underline">
              &larr; All matches
            </button>
            <RoundMatchLane
              lane={mobileMatch}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={(id) => {
                setSelectedPlayerId(id);
                setSheetOpen(true);
              }}
            />
          </div>
        ) : null}
      </div>

      <PlayerAssignmentSheet isOpen={sheetOpen} context={assignmentContext} onAssign={handleAssign} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
