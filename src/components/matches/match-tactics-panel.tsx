"use client";

import { useState, useTransition, useCallback } from "react";
import { cn } from "@/lib/cn";
import { PitchLineupView } from "@/components/formations/pitch-formation";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";
import { DecisionBanner } from "@/components/ui/decision-banner";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { GAME_FORMAT_PLAYERS, ROLE_TYPE_LABELS, formatGameFormatShort } from "@/lib/formations/types";

type FormationSuggestion = {
  formationId: string;
  formationName: string;
  gameFormat: string;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  warnings: string[];
  slotMatchCount: number;
  slotTotalCount: number;
  goalkeeperAvailable: boolean;
};

type LineupSuggestion = {
  assignments: {
    slotId: string;
    playerId: string;
    source: "suggested";
    locked: boolean;
    reasons: string[];
    confidence: "high" | "medium" | "low";
  }[];
  benchPlayerIds: string[];
  warnings: string[];
  unfilledSlotIds: string[];
};

type FormationOption = {
  id: string;
  name: string;
  gameFormat: string;
  source: string;
  teamId: string | null;
  slots: {
    id: string;
    gridX: number;
    gridY: number;
    label: string;
    shortLabel: string;
    roleType: string;
    acceptedPositionIds: string[];
    sortOrder: number;
  }[];
};

type LineupData = {
  id: string;
  status: string;
  formationId: string | null;
  benchPlayerIds: string[];
  notes: string | null;
  formation: {
    id: string;
    name: string;
    gameFormat: string;
    slots: {
      id: string;
      gridX: number;
      gridY: number;
      label: string;
      shortLabel: string;
      roleType: string;
      acceptedPositionIds: unknown;
      sortOrder: number;
    }[];
  } | null;
  assignments: {
    id: string;
    slotId: string;
    playerId: string | null;
    locked: boolean;
    source: string;
  }[];
};

type MatchTacticsPanelProps = {
  matchId: string;
  teamId: string;
  teamName: string;
  gameFormat: string;
  selections: {
    playerId: string;
    playerName: string;
    role: string;
    coreTeamName: string;
  }[];
};

const LINEUP_STATUS_PILL: Record<string, { label: string; variant: StatusPillVariant }> = {
  DRAFT: { label: "Draft lineup", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "finalized" },
  ARCHIVED: { label: "Archived", variant: "neutral" },
};

export function MatchTacticsPanel({
  matchId,
  teamId,
  teamName,
  gameFormat,
  selections,
}: MatchTacticsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [lineup, setLineup] = useState<LineupData | null>(null);
  const [formations, setFormations] = useState<FormationOption[]>([]);
  const [suggestion, setSuggestion] = useState<FormationSuggestion | null>(null);
  const [lineupSuggestion, setLineupSuggestion] = useState<LineupSuggestion | null>(null);
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refreshLineup = useCallback(async () => {
    const { getMatchLineup } = await import("@/app/(app)/matches/lineup-actions");
    const updated = await getMatchLineup(matchId, teamId);
    if (updated) setLineup(updated as unknown as LineupData);
  }, [matchId, teamId]);

  const handleLoad = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null);
        const { getSuggestFormationData } = await import("@/app/(app)/matches/suggest-actions");
        const { getMatchLineup } = await import("@/app/(app)/matches/lineup-actions");
        const data = await getSuggestFormationData(matchId);
        setFormations(
          data.formations.map((f) => ({
            ...f,
            slots: f.slots.map((s) => ({ ...s, id: s.id ?? `${s.gridX}-${s.gridY}` })),
          })),
        );
        setSuggestion(data.suggestion);
        const lineupData = await getMatchLineup(matchId, teamId);
        if (lineupData) {
          setLineup(lineupData as unknown as LineupData);
          setSelectedFormationId(lineupData.formationId);
        }
        setLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load formation data");
      }
    });
  }, [matchId, teamId]);

  const handleCreateLineup = useCallback(() => {
    if (!selectedFormationId) return;
    startTransition(async () => {
      try {
        setError(null);
        const { createMatchLineup } = await import("@/app/(app)/matches/lineup-actions");
        const result = await createMatchLineup({ matchId, teamId, formationId: selectedFormationId });
        setLineup(result as unknown as LineupData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create lineup");
      }
    });
  }, [matchId, teamId, selectedFormationId]);

  const handleSuggestLineup = useCallback(async () => {
    const formationId = lineup?.formationId;
    if (!formationId) return;
    try {
      setError(null);
      const { suggestLineupForMatch } = await import("@/app/(app)/matches/suggest-actions");
      const result = await suggestLineupForMatch(matchId, formationId);
      setLineupSuggestion(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to suggest lineup");
    }
  }, [matchId, lineup]);

  const handleApplySuggestion = useCallback(async () => {
    const formationId = lineup?.formationId;
    if (!formationId || !lineupSuggestion) return;
      try {
        setError(null);
        const { applySuggestedLineup } = await import("@/app/(app)/matches/suggest-actions");
        const assignments = lineupSuggestion.assignments.map((a) => ({
        slotId: a.slotId,
        playerId: a.playerId,
        source: a.source === "suggested" ? ("SUGGESTED" as const) : ("MANUAL" as const),
      }));
      await applySuggestedLineup(matchId, formationId, assignments, lineupSuggestion.benchPlayerIds);
      setLineupSuggestion(null);
      await refreshLineup();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply suggestion");
    }
  }, [matchId, lineup, lineupSuggestion, refreshLineup]);

  const handleConfirm = useCallback(() => {
    if (!lineup) return;
    startTransition(async () => {
      try {
        setError(null);
        const { confirmLineup } = await import("@/app/(app)/matches/lineup-actions");
        await confirmLineup(lineup.id);
        await refreshLineup();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to confirm lineup");
      }
    });
  }, [lineup, refreshLineup]);

  const handleRevertToDraft = useCallback(() => {
    if (!lineup) return;
    startTransition(async () => {
      try {
        setError(null);
        const { revertLineupToDraft } = await import("@/app/(app)/matches/lineup-actions");
        await revertLineupToDraft(lineup.id);
        await refreshLineup();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to revert lineup");
      }
    });
  }, [lineup, refreshLineup]);

  const handleClearSuggestions = useCallback(() => {
    if (!lineup) return;
    startTransition(async () => {
      try {
        setError(null);
        const { clearSuggestedAssignments } = await import("@/app/(app)/matches/suggest-actions");
        await clearSuggestedAssignments(lineup.id);
        await refreshLineup();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to clear suggestions");
      }
    });
  }, [lineup, refreshLineup]);

  const handleFillEmpty = useCallback(() => {
    if (!lineup) return;
    startTransition(async () => {
      try {
        setError(null);
        const { fillEmptySlots } = await import("@/app/(app)/matches/suggest-actions");
        await fillEmptySlots(lineup.id);
        await refreshLineup();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fill slots");
      }
    });
  }, [lineup, refreshLineup]);

  const handleSlotClick = useCallback((_assignmentId: string, _slotId: string) => {
    if (!lineup || lineup.status === "CONFIRMED") return;
    const assignment = lineup.assignments.find((a) => a.id === _assignmentId);
    if (assignment?.playerId) {
      startTransition(async () => {
        try {
          const { removePlayerFromSlot } = await import("@/app/(app)/matches/lineup-actions");
          await removePlayerFromSlot(_assignmentId);
          await refreshLineup();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to remove player");
        }
      });
    }
  }, [lineup, refreshLineup]);

  const handleAssignPlayer = useCallback((assignmentId: string, playerId: string) => {
    if (playerId === "") return;
    if (!lineup || lineup.status === "CONFIRMED") return;
    startTransition(async () => {
      try {
        const { assignPlayerToSlot } = await import("@/app/(app)/matches/lineup-actions");
        await assignPlayerToSlot(assignmentId, playerId);
        await refreshLineup();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to assign player");
      }
    });
  }, [lineup, refreshLineup]);

  // Future: enable lock toggle from slot context menu

  if (!loaded) {
    return (
      <Surface padding="lg">
        <SectionHeader title="Tactics" description={`Formation and lineup planning for ${teamName}.`} />
        <div className="mt-4">
          <Button variant="primary" size="sm" disabled={isPending} onClick={handleLoad}>
            {isPending ? "Loading…" : "Get started"}
          </Button>
        </div>
      </Surface>
    );
  }

  if (error) {
    return (
      <Surface padding="md">
        <DecisionBanner variant="blocked" title="Error" description={error} />
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={handleLoad}>Retry</Button>
        </div>
      </Surface>
    );
  }

  if (!lineup) {
    return (
      <Surface padding="lg">
        <SectionHeader title="Tactics" description={`Choose a formation for ${teamName}.`} />
        {suggestion && (
          <Surface padding="sm" className="mt-3 border-[var(--accent)]/30 bg-[var(--accent-subtle)]">
            <p className="text-xs text-[var(--text-soft)]">
              Suggested formation: <strong className="text-zinc-100">{suggestion.formationName}</strong>
              <span className="ml-2 text-[var(--text-muted)]">
                ({suggestion.confidence} confidence · {suggestion.slotMatchCount}/{suggestion.slotTotalCount} slots matched)
              </span>
            </p>
            {suggestion.reasons.length > 0 && (
              <ul className="mt-1 text-[10px] text-[var(--text-muted)] list-disc ml-3">
                {suggestion.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </Surface>
        )}
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            {formatGameFormatShort(gameFormat)} · {GAME_FORMAT_PLAYERS[gameFormat as keyof typeof GAME_FORMAT_PLAYERS] ?? "?"} players per side
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {formations.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFormationId(f.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  selectedFormationId === f.id
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border-soft)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
                )}
              >
                <span className="text-sm font-medium text-zinc-100">{f.name}</span>
                <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                  {f.source === "CUSTOM" ? "Custom" : "System"} · {f.slots.length} slots
                </span>
              </button>
            ))}
          </div>
        </div>
        {selectedFormationId && (
          <div className="mt-4">
            <Button variant="primary" fullWidth disabled={isPending} onClick={handleCreateLineup}>
              {isPending ? "Creating…" : "Create lineup"}
            </Button>
          </div>
        )}
      </Surface>
    );
  }

  const isConfirmed = lineup.status === "CONFIRMED";
  const slots = (lineup.formation?.slots ?? []).map((s) => ({
    id: s.id,
    gridX: s.gridX,
    gridY: s.gridY,
    label: s.label,
    shortLabel: s.shortLabel,
    roleType: s.roleType as FormationSlotRoleType,
    acceptedPositionIds: (s.acceptedPositionIds ?? []) as BroadPosition[],
    sortOrder: s.sortOrder,
  }));

  const assignedPlayerIds = new Set(
    lineup.assignments.filter((a) => a.playerId).map((a) => a.playerId!)
  );

  const unassignedCount = lineup.assignments.filter((a) => !a.playerId).length;
  const totalSlots = lineup.assignments.length;
  const lineupStatus = LINEUP_STATUS_PILL[lineup.status];

  const playerPool = selections.map((s) => ({
    id: s.playerId,
    firstName: s.playerName.split(" ")[0],
    lastName: s.playerName.split(" ").slice(1).join(" ") || null,
    primaryPosition: "",
  }));

  return (
    <div className="flex flex-col gap-4">
      <Surface padding="md">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Lineup"
            eyebrow={lineup.formation?.name ?? "No formation"}
            description={`${totalSlots - unassignedCount}/${totalSlots} slots filled`}
          />
          {lineupStatus && <StatusPill variant={lineupStatus.variant}>{lineupStatus.label}</StatusPill>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isConfirmed && (
            <>
              <Button variant="secondary" size="sm" disabled={isPending} onClick={handleSuggestLineup}>
                Suggest lineup
              </Button>
              <Button variant="ghost" size="sm" disabled={isPending} onClick={handleFillEmpty}>
                Fill empty slots
              </Button>
              <Button variant="ghost" size="sm" disabled={isPending} onClick={handleClearSuggestions}>
                Clear suggestions
              </Button>
            </>
          )}
          {unassignedCount === 0 && !isConfirmed && (
            <Button variant="primary" size="sm" disabled={isPending} onClick={handleConfirm}>
              Confirm lineup
            </Button>
          )}
          {isConfirmed && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={handleRevertToDraft}>
              Revert to draft
            </Button>
          )}
        </div>
        {lineupSuggestion && (
          <Surface padding="sm" className="mt-3 border-[var(--accent)]/30 bg-[var(--accent-subtle)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-100">Suggested lineup</p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {lineupSuggestion.assignments.filter((a) => a.playerId).length} players assigned · {lineupSuggestion.benchPlayerIds.length} on bench
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" disabled={isPending} onClick={handleApplySuggestion}>
                  Apply
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLineupSuggestion(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
            {lineupSuggestion.warnings.length > 0 && (
              <ul className="mt-2 text-[10px] text-[var(--warning)] list-disc ml-3">
                {lineupSuggestion.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </Surface>
        )}
      </Surface>

      {slots.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Surface padding="md">
            <SectionHeader title="Pitch" eyebrow={lineup.formation?.name ?? "Formation"} />
            <div className="mt-3">
              <PitchLineupView
                gameFormat={gameFormat}
                slots={slots}
                assignments={lineup.assignments.map((a) => ({
                  id: a.id,
                  slotId: a.slotId,
                  playerId: a.playerId,
                  locked: a.locked,
                  source: a.source,
                }))}
                players={playerPool}
                onSlotClick={handleSlotClick}
                readOnly={isConfirmed}
              />
            </div>
            {!isConfirmed && (
              <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                Tap an assigned player to remove. Tap an empty slot to assign.
              </p>
            )}
          </Surface>

          <aside className="flex flex-col gap-3">
            <Surface padding="md">
              <SectionHeader title="Squad" eyebrow={`${selections.length} available`} />
              <div className="mt-2 flex flex-col gap-1">
                {selections.map((s) => {
                  const isAssigned = assignedPlayerIds.has(s.playerId);
                  return (
                    <div
                      key={s.playerId}
                      className={cn(
                        "flex items-center justify-between rounded-md px-2 py-1 text-xs",
                        isAssigned
                          ? "bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                          : "text-[var(--text-soft)] hover:bg-[var(--surface-muted)]"
                      )}
                    >
                      <span className="truncate font-medium">{s.playerName}</span>
                      <span className="text-[10px] text-[var(--text-muted)] ml-1">{s.role}</span>
                    </div>
                  );
                })}
              </div>
            </Surface>

            {!isConfirmed && unassignedCount > 0 && (
              <Surface padding="md">
                <SectionHeader title="Empty slots" description={`${unassignedCount} unassigned`} />
                <div className="mt-2 flex flex-col gap-1">
                  {lineup.assignments
                    .filter((a) => !a.playerId)
                    .map((a) => {
                      const slot = slots.find((s) => s.id === a.slotId);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className="flex items-center justify-between rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors"
                          onClick={() => handleAssignPlayer(a.id, "")}
                        >
                          <span>{slot?.shortLabel ?? "Slot"}</span>
                          <span>{slot ? ROLE_TYPE_LABELS[slot.roleType] : "Unknown"}</span>
                        </button>
                      );
                    })}
                </div>
              </Surface>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}