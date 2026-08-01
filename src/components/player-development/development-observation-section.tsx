"use client";

import { useState } from "react";
import { RATING_ATTRIBUTE_KEYS } from "@/lib/player-development/constants";

type Props = {
  matchId: string;
  players: Array<{ id: string; name: string }>;
  existingObservations: Array<{
    id: string;
    playerId: string;
    playerName: string;
    kind: string;
    attributeKey: string | null;
    positionId: string | null;
    direction: string;
    observableNote: string | null;
    observedAt: string;
  }>;
  isLocked: boolean;
};

const DIRECTION_LABELS: Record<string, string> = {
  POSITIVE: "Positive — growing strength",
  NEGATIVE: "Needs attention — observable concern",
};

export function DevelopmentObservationSection({
  matchId,
  players,
  existingObservations,
  isLocked,
}: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [kind, setKind] = useState<"ATTRIBUTE" | "POSITION">("ATTRIBUTE");
  const [attributeKey, setAttributeKey] = useState("");
  const [direction, setDirection] = useState<"POSITIVE" | "NEGATIVE">("POSITIVE");
  const [observableNote, setObservableNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observations, setObservations] = useState(existingObservations);

  async function handleAdd() {
    if (!selectedPlayer) {
      setError("Select a player");
      return;
    }
    if (kind === "ATTRIBUTE" && !attributeKey) {
      setError("Select an attribute");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/players/development-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayer,
          matchId,
          kind,
          attributeKey: kind === "ATTRIBUTE" ? attributeKey : null,
          positionId: null,
          direction,
          observableNote: observableNote || null,
          sourceType: "LEAGUE_MATCH",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add observation");
        return;
      }

      const player = players.find((p) => p.id === selectedPlayer);
      setObservations((prev) => [
        ...prev,
        {
          id: data.id,
          playerId: selectedPlayer,
          playerName: player?.name ?? "Unknown",
          kind,
          attributeKey: kind === "ATTRIBUTE" ? attributeKey : null,
          positionId: null,
          direction,
          observableNote: observableNote || null,
          observedAt: new Date().toISOString(),
        },
      ]);

      setAttributeKey("");
      setObservableNote("");
    } catch {
      setError("Failed to add observation");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(observationId: string) {
    try {
      const res = await fetch(`/api/players/development-observations?observationId=${observationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setObservations((prev) => prev.filter((o) => o.id !== observationId));
      }
    } catch {
      // Silent failure for delete
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-zinc-50">Development observations</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Record observable behavior for actual participants. Describe what you see, not character judgements.
        </p>
      </div>

      {observations.length > 0 && (
        <div className="space-y-2">
          {observations.map((obs) => (
            <div key={obs.id} className="flex items-center justify-between text-sm border-b border-[var(--border-soft)] pb-2 last:border-b-0">
              <div className="flex items-center gap-3">
                <span className="text-zinc-200">{obs.playerName}</span>
                <span className="text-xs text-zinc-500">
                  {obs.kind === "ATTRIBUTE" ? obs.attributeKey : "Position"}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  obs.direction === "POSITIVE"
                    ? "bg-emerald-900/30 text-emerald-400"
                    : "bg-amber-900/30 text-amber-400"
                }`}>
                  {obs.direction === "POSITIVE" ? "Growing" : "Needs attention"}
                </span>
                {obs.observableNote && (
                  <span className="text-zinc-400 text-xs truncate max-w-[200px]" title={obs.observableNote}>
                    {obs.observableNote.slice(0, 50)}{obs.observableNote.length > 50 ? "\u2026" : ""}
                  </span>
                )}
              </div>
              {!isLocked && (
                <button
                  onClick={() => handleDelete(obs.id)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLocked && (
        <div className="space-y-3">
          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="bg-[var(--surface-raised)] border border-[var(--border-soft)] rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="">Select player</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={kind}
              onChange={(e) => { setKind(e.target.value as "ATTRIBUTE" | "POSITION"); setAttributeKey(""); }}
              className="bg-[var(--surface-raised)] border border-[var(--border-soft)] rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="ATTRIBUTE">Attribute</option>
              <option value="POSITION">Position</option>
            </select>

            {kind === "ATTRIBUTE" && (
              <select
                value={attributeKey}
                onChange={(e) => setAttributeKey(e.target.value)}
                className="bg-[var(--surface-raised)] border border-[var(--border-soft)] rounded-lg px-3 py-2 text-sm text-zinc-200"
              >
                <option value="">Select attribute</option>
                {RATING_ATTRIBUTE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  </option>
                ))}
              </select>
            )}

            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "POSITIVE" | "NEGATIVE")}
              className="bg-[var(--surface-raised)] border border-[var(--border-soft)] rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              {Object.entries(DIRECTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <textarea
            value={observableNote}
            onChange={(e) => setObservableNote(e.target.value)}
            placeholder="Observable behavior description (max 500 chars, optional)"
            maxLength={500}
            rows={2}
            className="w-full bg-[var(--surface-raised)] border border-[var(--border-soft)] rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 resize-none"
          />

          <button
            onClick={handleAdd}
            disabled={saving || !selectedPlayer || (kind === "ATTRIBUTE" && !attributeKey)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-strong)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Adding\u2026" : "Add observation"}
          </button>
        </div>
      )}
    </div>
  );
}