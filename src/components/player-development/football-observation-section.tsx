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
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
        Football observations
      </h3>
      <p className="text-xs text-gray-500">
        Record what you observed — not what you think it means. Matchboard interprets the
        meaning.
      </p>

      {isLocked ? (
        <p className="text-sm text-gray-500 italic">
          This report is locked. Observations cannot be added.
        </p>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player
            </label>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            <label className="block text-sm font-medium text-green-700 mb-1">
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
                      ? "bg-green-100 text-green-800 border border-green-300"
                      : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {getObservationLabel(code, "POSITIVE")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-700 mb-1">
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
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {getObservationLabel(code, "NEGATIVE")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Observable behavior only — no labels or judgment"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedPlayer}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save observations"}
          </button>

          {selectedPlayer && existingObservations.filter(o => o.playerId === selectedPlayer).length > 0 && (
            <div className="mt-3 space-y-1">
              <h4 className="text-xs font-semibold text-gray-500 uppercase">
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
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {o.polarity === "POSITIVE" ? "✓" : "!"}
                    </span>
                    <span>
                      {isValidCode
                        ? getObservationLabel(code, o.polarity as ObservationPolarity)
                        : o.observationCode}
                    </span>
                    {o.note && <span className="text-gray-500">— {o.note}</span>}
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