"use client";

import { useState } from "react";
import {
  TouchlinePageHeader,
  TouchlineButton,
  WorkbenchToolbar,
  TouchlineInspector,
  BenchRail,
  PositionFitList,
  TouchlineBottomSheet,
  PlayerContextHeader,
} from "@/components/touchline";
import { TacticsBoard } from "@/components/formations/tactics-board";
import {
  lineupSlots,
  lineupAssignments,
  lineupPlayers,
  lineupBench,
  lineupSelectedPlayerFit,
} from "../fixtures";

/**
 * `/dev/ui-lab/tactics` — synthesised, not sourced from a separate golden
 * image (`10_REFERENCE_CONFORMANCE.md §5`): pitch/player-token language from
 * `lineup-mobile.png`, desktop workbench density from
 * `round-board-desktop-existing.png`, inspector/material language from this
 * bundle. Shares the canonical pitch renderer, player token, inspector, and
 * bottom sheet with Lineup — only the surrounding controls differ.
 */
export function TacticsContent() {
  const [selected, setSelected] = useState<string | null>(lineupPlayers[0]?.id ?? null);
  const selectedPlayer = lineupPlayers.find((p) => p.id === selected);
  const selectedBenchEntry = lineupBench.find((p) => p.id === selected);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <TouchlinePageHeader title="Tactics" context="Rød vs Graabein United · Sat 13:00" />

      <div className="mt-5">
        <WorkbenchToolbar
          context={<span className="text-[var(--text-muted)]">4-3-3 · on-field positions</span>}
          actions={<TouchlineButton variant="ghost">Suggest lineup</TouchlineButton>}
        />
      </div>

      <div className="mt-6 flex flex-col gap-6 large:flex-row">
        <div className="min-w-0 flex-1">
          <TacticsBoard
            mode="lineup-assignment"
            orientation="horizontal"
            size="wide"
            slots={lineupSlots}
            assignments={lineupAssignments}
            players={lineupPlayers}
            readOnly={false}
            onSlotClick={(_assignmentId, _slotId, playerId) => {
              if (playerId) {
                setSelected(playerId);
                setSheetOpen(true);
              }
            }}
          />
          <div className="mt-4 medium:hidden">
            <BenchRail
              players={lineupBench}
              onSelect={(id) => {
                setSelected(id);
                setSheetOpen(true);
              }}
            />
          </div>
        </div>

        <div className="hidden large:block">
          <TouchlineInspector
            title={selectedPlayer ? `${selectedPlayer.firstName} ${selectedPlayer.lastName ?? ""}`.trim() : "Select a player"}
            headline="Natural LM"
            number={selectedPlayer?.shirtNumber}
          >
            <PositionFitList entries={lineupSelectedPlayerFit} selectedTier="NATURAL" />
          </TouchlineInspector>
        </div>
      </div>

      <TouchlineBottomSheet
        isOpen={sheetOpen && selectedBenchEntry != null}
        onClose={() => setSheetOpen(false)}
        title="Positional fit"
        hero={
          selectedBenchEntry ? (
            <PlayerContextHeader
              name={selectedBenchEntry.name}
              role={selectedBenchEntry.role}
              number={selectedBenchEntry.number}
            />
          ) : null
        }
        ariaLabel="Selected player"
      >
        <PositionFitList entries={lineupSelectedPlayerFit} selectedTier="NATURAL" />
      </TouchlineBottomSheet>
    </>
  );
}
