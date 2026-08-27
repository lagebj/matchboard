"use client";

import { useState, useCallback } from "react";
import { LeagueLiveMatchClient } from "@/components/live-match/league-live-match-client";
import { PlannedRotationPrompt } from "@/components/live-match/planned-rotation-prompt";
import type { PlannedRotationWithChanges } from "@/lib/planned-rotation/planned-rotation";
import {
  applyPlannedChangeAction,
  skipPlannedChangeAction,
  delayPlannedChangeAction,
  modifyPlannedChangeAction,
  getNextPlannedChangeAction,
} from "@/app/(app)/matches/planned-rotation-live-actions";

import type { MatchType } from "@/generated/prisma/client";

const plannedChangeActions = {
  applyChange: async (rotationId: string, changeId: string, overrides?: { outPlayerId?: string; inPlayerId?: string; outPosition?: string | null; inPosition?: string | null; changedNote?: string }) => {
    const result = await applyPlannedChangeAction(rotationId, changeId, overrides);
    if (result.success) return { success: true as const, data: { outEventId: result.outEventId, inEventId: result.inEventId } };
    return { success: false as const, error: result.success === false ? result.error : "Unknown error" };
  },
  skipChange: async (rotationId: string, changeId: string) => {
    const result = await skipPlannedChangeAction(rotationId, changeId);
    return result;
  },
  delayChange: async (rotationId: string, changeId: string) => {
    const result = await delayPlannedChangeAction(rotationId, changeId);
    return result;
  },
  modifyChange: async (rotationId: string, changeId: string, modification: Record<string, unknown>) => {
    const result = await modifyPlannedChangeAction(rotationId, changeId, modification);
    return result;
  },
  getNextChange: async (matchId: string, teamId: string) => {
    const result = await getNextPlannedChangeAction(matchId, teamId);
    return result;
  },
};

interface LeagueLiveMatchWithRotationProps {
  matchId: string;
  matchInfo: {
    id: string;
    opponent: string;
    homeAway: string;
    gameFormat: string;
    startsAt: string;
    status: string;
    teamName: string;
    teamId: string;
    roundName: string | null;
    matchType: MatchType;
  };
  plannedRotation: PlannedRotationWithChanges | null;
}

export function LeagueLiveMatchWithRotation({ matchId, matchInfo, plannedRotation }: LeagueLiveMatchWithRotationProps) {
  const [rotation, setRotation] = useState<PlannedRotationWithChanges | null>(plannedRotation);

  const handleApplied = useCallback((changeId: string) => {
    setRotation((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        changes: prev.changes.map((c) =>
          c.id === changeId ? { ...c, status: "APPLIED" as const } : c
        ),
      };
    });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {rotation && (rotation.status === "DRAFT" || rotation.status === "APPLIED") && (
        <PlannedRotationPrompt
          matchId={matchId}
          teamId={matchInfo.teamId}
          rotation={rotation}
          actions={plannedChangeActions}
          onApplied={handleApplied}
        />
      )}
      <LeagueLiveMatchClient
        matchId={matchId}
        matchInfo={matchInfo}
      />
    </div>
  );
}