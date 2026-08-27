"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { Play, SkipForward, ChevronRight, Clock, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

type PlannedChange = {
  id: string;
  sequence: number;
  outPlayerId: string | null;
  inPlayerId: string | null;
  outPosition: string | null;
  inPosition: string | null;
  positionOnly: boolean;
  approximateMatchSeconds: number | null;
  status: string;
  notes: string | null;
  outPlayerFirstName: string | null;
  outPlayerLastName: string | null;
  inPlayerFirstName: string | null;
  inPlayerLastName: string | null;
};

type PlannedRotation = {
  id: string;
  matchId: string;
  teamId: string;
  status: string;
  notes: string | null;
  changes: PlannedChange[];
};

type ApplyOverrides = { outPlayerId?: string; inPlayerId?: string; outPosition?: string | null; inPosition?: string | null; changedNote?: string };

type NextChangeActions = {
  applyChange: (rotationId: string, changeId: string, overrides?: ApplyOverrides) => Promise<{ success: boolean; error?: string }>;
  skipChange: (rotationId: string, changeId: string) => Promise<{ success: boolean; error?: string }>;
  delayChange: (rotationId: string, changeId: string) => Promise<{ success: boolean; error?: string }>;
  modifyChange: (rotationId: string, changeId: string, modification: Record<string, unknown>) => Promise<{ success: boolean; change?: PlannedChange; error?: string }>;
  getNextChange: (matchId: string, teamId: string) => Promise<{ success: boolean; change?: PlannedChange | null; error?: string }>;
};

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}'`;
}

function playerName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "—";
}

export function PlannedRotationPrompt({
  matchId,
  teamId,
  rotation,
  actions,
  onApplied,
}: {
  matchId: string;
  teamId: string;
  rotation: PlannedRotation | null;
  actions: NextChangeActions;
  onApplied?: (changeId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentChange, setCurrentChange] = useState<PlannedChange | null>(null);

  const pendingChanges = rotation?.changes.filter((c) => c.status === "PENDING") ?? [];
  const nextChange = currentChange ?? pendingChanges[0] ?? null;

  const refreshNextChange = useCallback(() => {
    startTransition(async () => {
      const result = await actions.getNextChange(matchId, teamId);
      if (result.success && result.change) {
        setCurrentChange(result.change);
      } else {
        setCurrentChange(null);
      }
    });
  }, [matchId, teamId, actions]);

  useEffect(() => {
    if (!nextChange && rotation?.status !== "SUPERSEDED") {
      refreshNextChange();
    }
  }, [rotation?.id, rotation?.changes?.length]);

  if (!rotation || rotation.status === "SUPERSEDED" || !nextChange) {
    return null;
  }

  const isPositionSwap = nextChange.positionOnly;

  function handleApply(overrides?: ApplyOverrides) {
    setError(null);
    startTransition(async () => {
      const result = await actions.applyChange(rotation!.id, nextChange!.id, overrides);
      if (!result.success) {
        setError(result.error ?? "Failed to apply change");
        return;
      }
      setCurrentChange(null);
      onApplied?.(nextChange!.id);
    });
  }

  function handleSkip() {
    setError(null);
    startTransition(async () => {
      const result = await actions.skipChange(rotation!.id, nextChange!.id);
      if (!result.success) {
        setError(result.error ?? "Failed to skip change");
        return;
      }
      setCurrentChange(null);
    });
  }

  function handleDelay() {
    setError(null);
    startTransition(async () => {
      const result = await actions.delayChange(rotation!.id, nextChange!.id);
      if (!result.success) {
        setError(result.error ?? "Failed to delay change");
        return;
      }
      setCurrentChange(null);
    });
  }

  // Bounded "Change" interaction: reverse which named player goes out and which comes in, then
  // apply that instead of the plan as authored. The original planned change record is never
  // rewritten — see applyPlannedChangeAction's overrides contract.
  function handleChangeDirection() {
    if (!nextChange.outPlayerId || !nextChange.inPlayerId) return;
    handleApply({
      outPlayerId: nextChange.inPlayerId,
      inPlayerId: nextChange.outPlayerId,
      outPosition: nextChange.inPosition,
      inPosition: nextChange.outPosition,
      changedNote: `Changed live: reversed direction from plan (${outPlayerName} ${isPositionSwap ? "↔" : "→"} ${inPlayerName})`,
    });
  }

  const outPlayerName = playerName(nextChange.outPlayerFirstName, nextChange.outPlayerLastName);
  const inPlayerName = playerName(nextChange.inPlayerFirstName, nextChange.inPlayerLastName);

  return (
    <Surface padding="sm">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
          <ChevronRight className="h-3.5 w-3.5 text-[var(--accent)]" />
          Next planned change
        </div>
        {nextChange.approximateMatchSeconds !== null && (
          <span className="text-xs text-[var(--text-muted)]">
            ~{formatSeconds(nextChange.approximateMatchSeconds)}
          </span>
        )}
        {nextChange.status === "DELAYED" && (
          <span className="text-xs text-[var(--text-warning,#b45309)]">Delayed</span>
        )}
      </div>

      <div className="text-sm text-[var(--text-primary)] mb-2">
        {isPositionSwap ? (
          <span>
            <span className="font-medium">{outPlayerName}</span>
            {" ↔ "}
            <span className="font-medium">{inPlayerName}</span>
            {" "}
            <span className="text-[var(--text-muted)]">(position swap)</span>
          </span>
        ) : (
          <span>
            <span className="font-medium">{outPlayerName}</span>
            {" out"}
            {nextChange.outPosition && <span className="text-[var(--text-muted)] ml-1">({nextChange.outPosition})</span>}
            {" → "}
            <span className="font-medium">{inPlayerName}</span>
            {" in"}
            {nextChange.inPosition && <span className="text-[var(--text-muted)] ml-1">({nextChange.inPosition})</span>}
          </span>
        )}
      </div>

      {nextChange.notes && (
        <div className="text-xs text-[var(--text-muted)] mb-2 italic">{nextChange.notes}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => handleApply()}
          disabled={isPending}
        >
          <Play className="h-3.5 w-3.5 mr-1" />
          Apply
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelay}
          disabled={isPending}
          title="Keep this change pending and revisit it shortly"
        >
          <Clock className="h-3.5 w-3.5 mr-1" />
          Delay
        </Button>
        {nextChange.outPlayerId && nextChange.inPlayerId && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleChangeDirection}
            disabled={isPending}
            title={`Apply the reverse instead: ${inPlayerName} ${isPositionSwap ? "↔" : "→"} ${outPlayerName}`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
            Change
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSkip}
          disabled={isPending}
        >
          <SkipForward className="h-3.5 w-3.5 mr-1" />
          Skip
        </Button>
      </div>

      {error && <p className="mt-1.5 text-xs text-[var(--text-error)]">{error}</p>}

      <div className="mt-1.5 text-xs text-[var(--text-muted)]">
        {pendingChanges.length} planned change{pendingChanges.length !== 1 ? "s" : ""} remaining
      </div>
    </Surface>
  );
}