"use client";

import { useState } from "react";
import {
  ALL_OBSERVATION_CODES,
  getObservationLabel,
  type FootballObservationCode,
  type ObservationPolarity,
} from "@/lib/evidence/observation-vocabulary";

type ObservationEntry = {
  id: string;
  playerId: string;
  observationCode: string;
  polarity: string;
  note: string | null;
  observedAt: string;
};

type PlayerOption = {
  id: string;
  name: string;
};

type Props = {
  /** Exactly one of matchId/eventMatchId identifies the report this section is for. */
  matchId?: string;
  eventMatchId?: string;
  players: PlayerOption[];
  existingObservations: ObservationEntry[];
  isLocked: boolean;
};

export function FootballObservationSection({
  matchId,
  eventMatchId,
  players,
  existingObservations,
  isLocked,
}: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [positiveCodes, setPositiveCodes] = useState<FootballObservationCode[]>([]);
  const [negativeCodes, setNegativeCodes] = useState<FootballObservationCode[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCode(
    code: FootballObservationCode,
    polarity: ObservationPolarity,
  ) {
    if (polarity === "POSITIVE") {
      setPositiveCodes((prev) =>
        prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
      );
    } else {
      setNegativeCodes((prev) =>
        prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
      );
    }
  }

  async function handleSave() {
    if (!selectedPlayer) {
      setError("Select a player");
      return;
    }

    if (positiveCodes.length === 0 && negativeCodes.length === 0) {
      setError("Select at least one observation");
      return;
    }

    setSaving(true);
    setError(null);

    const inputs = [
      ...positiveCodes.map(
        (code) =>
          ({
            playerId: selectedPlayer,
            observationCode: code,
            polarity: "POSITIVE" as ObservationPolarity,
            note: note.trim() || undefined,
          }) as const,
      ),
      ...negativeCodes.map(
        (code) =>
          ({
            playerId: selectedPlayer,
            observationCode: code,
            polarity: "NEGATIVE" as ObservationPolarity,
            note: note.trim() || undefined,
          }) as const,
      ),
    ];

    try {
      const result = eventMatchId
        ? await (
            await import("@/app/(app)/events/event-football-observation-actions")
          ).saveEventFootballObservationsAction(eventMatchId, inputs)
        : await (
            await import("@/app/(app)/matches/[matchId]/post-match/football-observation-actions")
          ).saveFootballObservationsAction(matchId!, inputs);

      if (!result.success) {
        setError(result.error ?? "Failed to save observations");
      } else {
        setSelectedPlayer("");
        setPositiveCodes([]);
        setNegativeCodes([]);
        setNote("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save observations");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Football observations
      </h3>
      <p className="text-xs text-[var(--text-muted)]">
        Record what you observed — not what you think it means. Matchboard interprets the
        meaning.
      </p>

      {isLocked ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-muted)] italic">
            This report is locked. Observations cannot be added.
          </p>
          {existingObservations.length > 0 && (
            <div className="space-y-2">
              {players
                .filter((p) => existingObservations.some((o) => o.playerId === p.id))
                .map((p) => (
                  <div key={p.id} className="space-y-1">
                    <p className="text-xs font-semibold text-[var(--text-muted)]">{p.name}</p>
                    {existingObservations
                      .filter((o) => o.playerId === p.id)
                      .map((o) => {
                        const code = o.observationCode as FootballObservationCode;
                        const isValidCode = ALL_OBSERVATION_CODES.includes(code);
                        return (
                          <div key={o.id} className="flex items-center gap-2 text-xs">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 font-medium ${
                                o.polarity === "POSITIVE"
                                  ? "bg-[var(--success-subtle)] text-[var(--success)]"
                                  : "bg-[var(--warning-subtle)] text-[var(--warning)]"
                              }`}
                            >
                              {o.polarity === "POSITIVE" ? "✓" : "!"}
                            </span>
                            <span>
                              {isValidCode
                                ? getObservationLabel(code, o.polarity as ObservationPolarity)
                                : o.observationCode}
                            </span>
                            {o.note && <span className="text-[var(--text-muted)]">— {o.note}</span>}
                          </div>
                        );
                      })}
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-[var(--text-soft)] mb-1">
              Player
            </label>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 py-2 text-sm text-[var(--foreground)]"
            >
              <option value="">Select a player</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--success)] mb-1">
              Worked well
            </label>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {ALL_OBSERVATION_CODES.map((code) => (
                <button
                  key={`pos-${code}`}
                  type="button"
                  onClick={() => toggleCode(code, "POSITIVE")}
                  className={`rounded px-2 py-1 text-xs text-left transition-colors ${
                    positiveCodes.includes(code)
                      ? "bg-[var(--success-subtle)] text-[var(--success)] border border-[color-mix(in_srgb,var(--success)_35%,transparent)]"
                      : "bg-[var(--tl-c-surface)] text-[var(--text-muted)] border border-[var(--border-soft)] hover:bg-[var(--tl-c-surface-hover)]"
                  }`}
                >
                  {getObservationLabel(code, "POSITIVE")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--warning)] mb-1">
              Needs attention
            </label>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {ALL_OBSERVATION_CODES.map((code) => (
                <button
                  key={`neg-${code}`}
                  type="button"
                  onClick={() => toggleCode(code, "NEGATIVE")}
                  className={`rounded px-2 py-1 text-xs text-left transition-colors ${
                    negativeCodes.includes(code)
                      ? "bg-[var(--warning-subtle)] text-[var(--warning)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)]"
                      : "bg-[var(--tl-c-surface)] text-[var(--text-muted)] border border-[var(--border-soft)] hover:bg-[var(--tl-c-surface-hover)]"
                  }`}
                >
                  {getObservationLabel(code, "NEGATIVE")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-soft)] mb-1">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Observable behavior only — no labels or judgment"
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 py-2 text-sm text-[var(--foreground)]"
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedPlayer}
            className="rounded-md bg-[var(--tl-c-accent)] px-4 py-2 text-sm font-medium text-[var(--tl-c-accent-on-fill)] hover:brightness-105 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save observations"}
          </button>

          {selectedPlayer && existingObservations.filter(o => o.playerId === selectedPlayer).length > 0 && (
            <div className="mt-3 space-y-1">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase">
                Recorded for this player
              </h4>
              {existingObservations.filter(o => o.playerId === selectedPlayer).map((o) => {
                const code = o.observationCode as FootballObservationCode;
                const isValidCode = ALL_OBSERVATION_CODES.includes(code);
                return (
                  <div key={o.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 font-medium ${
                        o.polarity === "POSITIVE"
                          ? "bg-[var(--success-subtle)] text-[var(--success)]"
                          : "bg-[var(--warning-subtle)] text-[var(--warning)]"
                      }`}
                    >
                      {o.polarity === "POSITIVE" ? "✓" : "!"}
                    </span>
                    <span>
                      {isValidCode
                        ? getObservationLabel(code, o.polarity as ObservationPolarity)
                        : o.observationCode}
                    </span>
                    {o.note && <span className="text-[var(--text-muted)]">— {o.note}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}