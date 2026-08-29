"use client";

import { useEffect, useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import {
  registerGuestPlayerForRoundAction,
  unregisterGuestPlayerFromRoundAction,
  getRoundGuestParticipantsAction,
  getAvailableGuestPlayersForRoundAction,
} from "@/app/(app)/rounds/league-round-guest-actions";

// ADR-0106: registers a GuestPlayer as a participant of this League Round -- the prerequisite for
// assigning them to any Match within it (done per-match via LeagueMatchGuestsPanel on the match
// detail page). Deliberately rendered as a standalone panel beside RoundBoard rather than
// integrated into its drag-and-drop column model, which is Player/Selection-specific.

type Participant = {
  guestPlayerId: string;
  name: string;
  sourceLabel: string | null;
};

export function RoundGuestPlayersPanel({ matchRoundId }: { matchRoundId: string }) {
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [available, setAvailable] = useState<Participant[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getRoundGuestParticipantsAction(matchRoundId).then(setParticipants);
  }, [matchRoundId]);

  function openAdd() {
    setShowAdd(true);
    setError(null);
    startTransition(async () => {
      const result = await getAvailableGuestPlayersForRoundAction(matchRoundId);
      setAvailable(result);
    });
  }

  function handleRegister(guestPlayerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await registerGuestPlayerForRoundAction(matchRoundId, guestPlayerId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const refreshed = await getRoundGuestParticipantsAction(matchRoundId);
      setParticipants(refreshed);
      setAvailable((prev) => prev.filter((g) => g.guestPlayerId !== guestPlayerId));
    });
  }

  function handleUnregister(guestPlayerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await unregisterGuestPlayerFromRoundAction(matchRoundId, guestPlayerId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setParticipants((prev) => (prev ? prev.filter((g) => g.guestPlayerId !== guestPlayerId) : prev));
    });
  }

  return (
    <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
      <SectionHeader
        title="Guest players"
        description="Register a guest player as a participant of this Round before assigning them to a match."
        actions={
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => (showAdd ? setShowAdd(false) : openAdd())}
          >
            {showAdd ? "Cancel" : "Register guest player"}
          </Button>
        }
      />

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}

      {participants === null ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Loading…</p>
      ) : participants.length === 0 && !showAdd ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">No guest players registered for this round.</p>
      ) : (
        participants.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {participants.map((p) => (
              <li
                key={p.guestPlayerId}
                className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-soft)] px-2.5 py-1.5 text-xs"
              >
                <span>
                  {p.name}
                  {p.sourceLabel && <span className="ml-1.5 text-[var(--text-muted)]">· {p.sourceLabel}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => handleUnregister(p.guestPlayerId)}
                  disabled={isPending}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50"
                  aria-label={`Remove ${p.name} from round`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {showAdd && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-[var(--border-soft)]">
          {available.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
              No available guest players in this Round's Group.
            </p>
          ) : (
            available.map((g) => (
              <button
                key={g.guestPlayerId}
                type="button"
                disabled={isPending}
                onClick={() => handleRegister(g.guestPlayerId)}
                className="flex w-full items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--surface-muted)]/50 disabled:opacity-50"
              >
                <span>{g.name}</span>
                {g.sourceLabel && <span className="text-[10px] text-[var(--text-muted)]">{g.sourceLabel}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
