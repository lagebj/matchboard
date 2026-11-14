"use client";

import { useMemo, useState } from "react";
import { RoundBoard, type RoundBoardCommands } from "@/components/round/round-board";

/**
 * Narrow fixture command boundary for the Gate C W2 Round Board candidates (C04-C06).
 *
 * `round-board.tsx` imports five real server actions directly; the brief requires UI Lab never
 * call live database mutations, so this harness supplies deterministic in-memory stand-ins via
 * `RoundBoard`'s `commands` prop instead. Every cell toggle, drag/drop, and suggestion-card assign
 * routes through the exact same `commands.addPlayerToMatch`/`removePlayerFromMatch` the real board
 * uses — there is no second, matrix-only or sheet-only mutation path.
 *
 * State lives here, not in the page: `RoundBoard` derives its "Available" panel and the
 * allocation matrix purely from the `matches`/`availablePlayers` props it's given, so updating
 * `matches` after a fixture mutation is sufficient for every dependent view to reflect it
 * truthfully — no parallel view-model to keep in sync.
 */

type RoundBoardProps = React.ComponentProps<typeof RoundBoard>;
type FixtureMatch = RoundBoardProps["matches"][number];
type FixturePlayer = FixtureMatch["players"][number];

export type RoundBoardFixtureInitial = Omit<RoundBoardProps, "commands" | "coverage"> & {
  /**
   * Distinct players whose core team has a playable fixture this round — the denominator
   * `computeRoundPlanIntegrity()`'s `coverage` would report in production. Recomputed locally
   * after every fixture mutation so the status strip's coverage tile stays truthful.
   */
  eligiblePlayerIds: string[];
  /**
   * Deterministic denial for a specific (playerId, matchId) pair (C06: "show pending, rejection
   * and conflict outcomes truthfully"). When the real board attempts this exact assignment, the
   * fixture command returns a failure and makes NO state change — proving the UI never shows a
   * successful result before a real accepted one, not just that happy-path assignment works.
   */
  deniedAssignments?: Array<{ playerId: string; matchId: string; reason: string }>;
};

export function RoundBoardFixtureHarness({ initial }: { initial: RoundBoardFixtureInitial }) {
  const { eligiblePlayerIds, deniedAssignments = [], ...initialBoardProps } = initial;
  const [matches, setMatches] = useState<FixtureMatch[]>(initial.matches);

  const rosterById = useMemo(() => {
    const map = new Map<string, FixturePlayer>();
    for (const p of initial.availablePlayers) map.set(p.id, p);
    for (const m of initial.matches) for (const p of m.players) if (!map.has(p.id)) map.set(p.id, p);
    return map;
  }, [initial.availablePlayers, initial.matches]);

  const assignedPlayerIds = useMemo(
    () => new Set(matches.flatMap((m) => m.players.map((p) => p.id))),
    [matches],
  );

  const coverage = useMemo(() => {
    const assignedCount = eligiblePlayerIds.filter((id) => assignedPlayerIds.has(id)).length;
    return {
      eligibleAvailablePlayerCount: eligiblePlayerIds.length,
      assignedEligibleAvailablePlayerCount: assignedCount,
      unassignedEligibleAvailablePlayerIds: eligiblePlayerIds.filter((id) => !assignedPlayerIds.has(id)),
    };
  }, [eligiblePlayerIds, assignedPlayerIds]);

  const commands: RoundBoardCommands = {
    // Stands in for `addPlayerToMatchAction` (src/app/(app)/rounds/[matchRoundId]/draft-selection-actions.ts).
    // Synchronous in-memory state update, never a network/persistence call.
    addPlayerToMatch: async (formData) => {
      const matchId = String(formData.get("matchId") ?? "");
      const playerId = String(formData.get("playerId") ?? "");
      const role = String(formData.get("role") ?? "CORE") as FixturePlayer["role"];
      const base = rosterById.get(playerId);
      if (!matchId || !playerId || !base) {
        return { success: false, errors: ["Fixture: unknown player or match."], warnings: [] };
      }
      const denial = deniedAssignments.find((d) => d.playerId === playerId && d.matchId === matchId);
      if (denial) {
        return { success: false, errors: [denial.reason], warnings: [] };
      }
      setMatches((prev) =>
        prev.map((m) =>
          m.matchId === matchId
            ? { ...m, players: [...m.players.filter((p) => p.id !== playerId), { ...base, role }] }
            : m,
        ),
      );
      return { success: true, errors: [], warnings: [] };
    },
    // Stands in for `removePlayerFromMatchAction`.
    removePlayerFromMatch: async (formData) => {
      const matchId = String(formData.get("matchId") ?? "");
      const playerId = String(formData.get("playerId") ?? "");
      setMatches((prev) =>
        prev.map((m) => (m.matchId === matchId ? { ...m, players: m.players.filter((p) => p.id !== playerId) } : m)),
      );
      return { success: true, errors: [], warnings: [] };
    },
    // Stands in for `generateEmergencyRepairOptionsAction`. Emergency repair is not this wave's
    // acceptance question (C04-C06) — a deterministic empty-options response is the honest,
    // safe default rather than fabricating repair candidates.
    generateEmergencyRepairOptions: async () => ({
      success: true,
      vacatedPlayerId: "",
      vacatedPlayerName: "",
      vacatedRole: "CORE",
      options: [],
    }),
    // Stands in for `clearRoundDraftAction`. Fixture-only no-op — Clear/Regenerate are rendered
    // whenever planning is open (as production does) but are not this wave's acceptance
    // question, so they intentionally do nothing rather than mutate fixture state.
    clearRoundDraft: async () => {},
    // Stands in for `regenerateRoundAction`. Its return value is ignored by the real caller too.
    regenerateRound: async () => ({ error: "" }),
  };

  return <RoundBoard {...initialBoardProps} matches={matches} coverage={coverage} commands={commands} />;
}
