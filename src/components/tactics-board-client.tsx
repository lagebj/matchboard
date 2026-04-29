"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type FormationSlot = {
  slot: string;
  row: number;
  col: number;
};

type Formation = {
  id: string;
  label: string;
  gameFormat: string;
  slots: FormationSlot[];
  cols: number;
};

type PlayerPositionInfo = {
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
};

type SelectedPlayer = {
  id: string;
  firstName: string;
  lastName: string | null;
  role: string;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
};

type TacticsBoardClientProps = {
  matchId: string;
  match: {
    id: string;
    opponent: string;
    startsAt: string;
    homeAway: string;
    gameFormat: string;
    teamId: string;
    teamName: string;
    formation: string | null;
  };
  formations: Formation[];
  defaultFormationId: string;
  initialSelectedPlayers: SelectedPlayer[];
};

type PositionFit = "primary" | "secondary" | "tertiary" | "fallback";

const SLOT_POSITION_MAP: Record<string, string[]> = {
  GK: ["GK"],
  CB: ["CB"],
  CB1: ["CB"],
  CB2: ["CB"],
  CB3: ["CB"],
  RB: ["RB", "CB"],
  LB: ["LB", "CB"],
  CM: ["CM"],
  CM1: ["CM"],
  CM2: ["CM"],
  CM3: ["CM"],
  RM: ["RM", "W", "CM"],
  LM: ["LM", "W", "CM"],
  RW: ["RW", "W", "ST"],
  LW: ["LW", "W", "ST"],
  ST: ["ST"],
  ST1: ["ST"],
  ST2: ["ST"],
};

function getPositionFit(
  playerPositions: PlayerPositionInfo,
  slotLabel: string,
): PositionFit {
  const norm = (s: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slotPosNames = SLOT_POSITION_MAP[slotLabel] ?? [norm(slotLabel)];
  const pri = norm(playerPositions.primaryPosition);
  const sec = norm(playerPositions.secondaryPosition);
  const ter = norm(playerPositions.tertiaryPosition);

  for (const pos of slotPosNames) {
    if (pri && pri === pos) return "primary";
  }
  for (const pos of slotPosNames) {
    if (sec && sec === pos) return "secondary";
  }
  for (const pos of slotPosNames) {
    if (ter && ter === pos) return "tertiary";
  }
  return "fallback";
}

function fitTone(fit: string) {
  if (fit === "primary") return "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.14)]";
  if (fit === "secondary") return "border-[rgba(106,153,219,0.3)] bg-[rgba(106,153,219,0.14)]";
  if (fit === "tertiary") return "border-[rgba(208,176,127,0.3)] bg-[rgba(208,176,127,0.14)]";
  return "border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.1)]";
}

function fitTextClass(fit: string) {
  if (fit === "primary") return "text-[var(--accent-strong)]";
  if (fit === "secondary") return "text-[#8bb8f0]";
  if (fit === "tertiary") return "text-[var(--warning)]";
  return "text-[#f0cbc5]";
}

function fitLabel(fit: string) {
  if (fit === "primary") return "1st";
  if (fit === "secondary") return "2nd";
  if (fit === "tertiary") return "3rd";
  return "Fallback";
}

function formatGameFormat(gameFormat: string) {
  switch (gameFormat) {
    case "SEVEN_A_SIDE": return "7-a-side";
    case "NINE_A_SIDE": return "9-a-side";
    case "ELEVEN_A_SIDE": return "11-a-side";
    default: return gameFormat;
  }
}

function maxStarters(gameFormat: string) {
  switch (gameFormat) {
    case "SEVEN_A_SIDE": return 7;
    case "NINE_A_SIDE": return 9;
    case "ELEVEN_A_SIDE": return 11;
    default: return 11;
  }
}

function formatDateStr(d: string) {
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(d));
}

type PlacementMap = Record<string, string>;

export function TacticsBoardClient({
  matchId,
  match,
  formations,
  defaultFormationId,
  initialSelectedPlayers,
}: TacticsBoardClientProps) {
  const [formationId, setFormationId] = useState(() => {
    if (!match.formation) return defaultFormationId;
    try {
      const saved = JSON.parse(match.formation) as { formationId?: string };
      return saved.formationId ?? defaultFormationId;
    } catch {
      return defaultFormationId;
    }
  });
  const [placements, setPlacements] = useState<PlacementMap>(() => {
    if (!match.formation) return {};
    try {
      const saved = JSON.parse(match.formation) as { placements?: PlacementMap };
      return saved.placements ?? {};
    } catch {
      return {};
    }
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const formation = formations.find((f) => f.id === formationId) ?? formations[0];
  const pitchSlots = formation?.slots ?? [];
  const rows = [...new Set(pitchSlots.map((s) => s.row))].sort((a, b) => a - b);
  const maxStart = maxStarters(match.gameFormat);

  const placedPlayerIds = new Set(Object.values(placements));
  const bench = initialSelectedPlayers.filter((p) => !placedPlayerIds.has(p.id));
  const placedCount = Object.keys(placements).length;
  const filledSlotCount = pitchSlots.filter((s) => placements[s.slot]).length;

  const saveFormation = useCallback(async (fId: string, p: PlacementMap) => {
    setSaving(true);
    try {
      await fetch(`/api/matches/${matchId}/formation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formationId: fId, placements: p }),
      });
    } catch {
      // silent fail
    }
    setSaving(false);
  }, [matchId]);

  const handleFormationChange = (newId: string) => {
    setFormationId(newId);
    setPlacements({});
    setSelectedPlayerId(null);
    saveFormation(newId, {});
  };

  const handleSlotClick = (slotKey: string) => {
    const currentOccupant = placements[slotKey];

    if (currentOccupant) {
      if (selectedPlayerId === currentOccupant) {
        // deselect the player altogether
        const newPlacements = { ...placements };
        delete newPlacements[slotKey];
        setPlacements(newPlacements);
        setSelectedPlayerId(null);
        saveFormation(formationId, newPlacements);
      } else {
        // click on an occupied slot: select that placed player for move, or if we have a selected player, swap
        if (selectedPlayerId && selectedPlayerId !== currentOccupant) {
          // find if selectedPlayerId is already placed somewhere — swap them
          const newPlacements = { ...placements };
          const existingSlot = Object.entries(newPlacements).find(([, pid]) => pid === selectedPlayerId);
          if (existingSlot) {
            newPlacements[existingSlot[0]] = currentOccupant;
          }
          newPlacements[slotKey] = selectedPlayerId;
          setPlacements(newPlacements);
          setSelectedPlayerId(null);
          saveFormation(formationId, newPlacements);
        } else {
          setSelectedPlayerId(currentOccupant);
        }
      }
      return;
    }

    // slot is empty — place the selected player if one is selected
    if (selectedPlayerId) {
      if (filledSlotCount >= maxStart) {
        return; // prevent placing more than max starters
      }
      const player = initialSelectedPlayers.find((p) => p.id === selectedPlayerId);
      if (!player) return;

      const newPlacements = { ...placements, [slotKey]: selectedPlayerId };
      setPlacements(newPlacements);
      setSelectedPlayerId(null);
      saveFormation(formationId, newPlacements);
    }
  };

  const handleBenchClick = (playerId: string) => {
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      return;
    }

    // If a placed player is selected and you click a bench player, deselect placed player and select bench player
    // If a bench player is selected, they become the active selection for placing
    setSelectedPlayerId(playerId);
  };

  const handleRemoveFromPitch = (slotKey: string) => {
    const newPlacements = { ...placements };
    delete newPlacements[slotKey];
    setPlacements(newPlacements);
    setSelectedPlayerId(null);
    saveFormation(formationId, newPlacements);
  };

  const getPlayer = (playerId: string) => initialSelectedPlayers.find((p) => p.id === playerId);

  // Check for defensive coverage warning
  const defensiveSlots = pitchSlots.filter((s) => {
    const pos = SLOT_POSITION_MAP[s.slot] ?? [];
    return pos.some((p) => p === "CB" || p === "GK" || p === "LB" || p === "RB");
  });
  const hasDefensiveCoverage = defensiveSlots.some((s) => placements[s.slot]);

  // Find compatible matches for copy
  const [compatibleMatches, setCompatibleMatches] = useState<{ id: string; label: string; formation: string | null }[]>([]);

  useEffect(() => {
    fetch(`/api/matches?gameFormat=${match.gameFormat}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCompatibleMatches(data.filter((m: { id: string }) => m.id !== matchId));
        }
      })
      .catch(() => {});
  }, [match.gameFormat, matchId]);

  const [copyTarget, setCopyTarget] = useState<string | null>(null);

  const handleCopyFormation = async () => {
    if (!copyTarget) return;
    const sourceMatch = compatibleMatches.find((m) => m.id === copyTarget);
    if (!sourceMatch?.formation) return;

    try {
      const saved = JSON.parse(sourceMatch.formation) as { formationId?: string; placements?: PlacementMap };
      // Only copy placements where players overlap
      const overlappingPlacements: PlacementMap = {};
      if (saved.placements) {
        for (const [slot, playerId] of Object.entries(saved.placements)) {
          if (initialSelectedPlayers.some((p) => p.id === playerId)) {
            overlappingPlacements[slot] = playerId;
          }
        }
      }
      if (saved.formationId) {
        setFormationId(saved.formationId);
      }
      setPlacements(overlappingPlacements);
      saveFormation(saved.formationId ?? formationId, overlappingPlacements);
    } catch {
      // ignore parse errors
    }
    setCopyTarget(null);
  };

  const warnings: string[] = [];
  if (filledSlotCount < maxStart) {
    warnings.push(`${maxStart - filledSlotCount} starting slot${maxStart - filledSlotCount > 1 ? "s" : ""} unfilled`);
  }
  if (!hasDefensiveCoverage && defensiveSlots.length > 0) {
    warnings.push("No selected player covers a defensive slot");
  }
  const fallbackPlacements = pitchSlots.filter((s) => {
    const pid = placements[s.slot];
    if (!pid) return false;
    const player = getPlayer(pid);
    if (!player) return false;
    return getPositionFit({ primaryPosition: player.primaryPosition, secondaryPosition: player.secondaryPosition, tertiaryPosition: player.tertiaryPosition }, s.slot) === "fallback";
  });
  if (fallbackPlacements.length > 0) {
    warnings.push(`${fallbackPlacements.length} player${fallbackPlacements.length > 1 ? "s" : ""} in fallback position`);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Tactics Board
            </span>
            {saving && (
              <span className="text-xs app-copy-muted">Saving...</span>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">
                {match.teamName} vs. {match.opponent}
              </h1>
              <p className="mt-2 text-sm app-copy-soft">
                {formatDateStr(match.startsAt)} · {formatGameFormat(match.gameFormat)} · {placedCount}/{maxStart} starters
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                href="/tactics"
              >
                Back to Tactics Board
              </Link>
              <Link
                className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                href={`/selection/${matchId}`}
              >
                Open in Round Board
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Copy Formation */}
      {compatibleMatches.length > 0 && (
        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Copy Formation</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Copy from another {formatGameFormat(match.gameFormat)} match</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-4 text-sm app-copy-soft focus:outline-none"
              value={copyTarget ?? ""}
              onChange={(e) => setCopyTarget(e.target.value || null)}
            >
              <option value="">Select a match...</option>
              {compatibleMatches.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <button
              onClick={handleCopyFormation}
              disabled={!copyTarget}
              className="inline-flex h-10 items-center rounded-full border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-5 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[rgba(140,167,146,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Copy Formation
            </button>
          </div>
        </section>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <section className="grid gap-2">
          {warnings.map((w) => (
            <div key={w} className="rounded-[1.2rem] border border-[rgba(208,176,127,0.3)] bg-[rgba(208,176,127,0.08)] px-4 py-3">
              <p className="text-sm font-medium text-[var(--warning)]">{w}</p>
            </div>
          ))}
        </section>
      )}

      {/* Pitch */}
      <section className="app-panel rounded-[1.75rem] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Pitch View</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">{initialSelectedPlayers.length} selected · {formatGameFormat(match.gameFormat)}</h2>
          </div>
          {selectedPlayerId && (
            <div className="rounded-full border border-[rgba(106,153,219,0.3)] bg-[rgba(106,153,219,0.12)] px-4 py-2 text-sm font-medium text-[#8bb8f0]">
              {(() => {
                const sp = getPlayer(selectedPlayerId);
                return sp ? `Click a pitch slot to place ${sp.firstName}${sp.lastName ? ` ${sp.lastName}` : ""}` : "Select a player";
              })()}
            </div>
          )}
        </div>

        {formations.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {formations.map((f) => (
              <button
                key={f.id}
                onClick={() => handleFormationChange(f.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${f.id === formationId ? "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.14)] text-[var(--accent-strong)]" : "border app-hairline app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-[2rem] border border-[rgba(140,167,146,0.18)] bg-[linear-gradient(180deg,rgba(34,80,34,0.16),rgba(24,60,24,0.24))] p-6">
          <div className="mx-auto max-w-[36rem]">
            {rows.map((row) => (
              <div key={row} className="grid gap-4 mb-4" style={{ gridTemplateColumns: `repeat(${formation?.cols ?? 3}, 1fr)` }}>
                {pitchSlots.filter((p) => p.row === row).map((pos) => {
                  const pid = placements[pos.slot];
                  const player = pid ? getPlayer(pid) : null;
                  const fit = player
                    ? getPositionFit({ primaryPosition: player.primaryPosition, secondaryPosition: player.secondaryPosition, tertiaryPosition: player.tertiaryPosition }, pos.slot)
                    : null;

                  return (
                    <button
                      key={pos.slot}
                      onClick={() => handleSlotClick(pos.slot)}
                      className={`relative rounded-[1.2rem] border p-3 text-center transition-colors ${
                        player
                          ? fitTone(fit ?? "fallback")
                          : selectedPlayerId
                            ? "border-[rgba(106,153,219,0.3)] bg-[rgba(106,153,219,0.06)] hover:bg-[rgba(106,153,219,0.12)]"
                            : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] app-copy-muted">{pos.slot}</p>
                      {player ? (
                        <>
                          <Link
                            href={`/players/${player.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`mt-1 block text-sm font-semibold text-zinc-100 hover:${fitTextClass(fit ?? "fallback")}`}
                          >
                            {player.firstName} {player.lastName}
                          </Link>
                          <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase ${fitTone(fit ?? "fallback")} ${fitTextClass(fit ?? "fallback")}`}>
                            {fitLabel(fit ?? "fallback")}
                          </span>
                          {pid === selectedPlayerId && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[rgba(106,153,219,0.9)] text-[8px] font-bold text-white">✓</span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveFromPitch(pos.slot); }}
                            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(185,128,119,0.6)] text-[10px] font-bold text-white hover:bg-[rgba(185,128,119,0.9)]"
                            title="Remove from pitch"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <p className="mt-1 text-xs app-copy-muted">
                          {selectedPlayerId ? "Place here" : "Empty"}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bench */}
      <section className="app-panel rounded-[1.75rem] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Bench
        </p>
        <h2 className="mt-2 text-xl font-semibold text-zinc-50">
          {bench.length} unplaced player{bench.length === 1 ? "" : "s"}
          {placedCount >= maxStart && ` · ${maxStart} starter limit reached`}
        </h2>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {initialSelectedPlayers.map((player) => {
            const isOnPitch = placedPlayerIds.has(player.id);
            const isSelected = selectedPlayerId === player.id;

            return (
              <button
                key={player.id}
                onClick={() => {
                  if (isOnPitch) {
                    // find the slot this player is in and select them for move
                    setSelectedPlayerId(player.id);
                  } else {
                    handleBenchClick(player.id);
                  }
                }}
                className={`rounded-[1.2rem] border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-[rgba(106,153,219,0.5)] bg-[rgba(106,153,219,0.15)]"
                    : isOnPitch
                      ? "border-[rgba(140,167,146,0.2)] bg-[rgba(140,167,146,0.08)]"
                      : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/players/${player.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-semibold text-zinc-100 hover:text-[var(--accent-strong)]"
                  >
                    {player.firstName} {player.lastName}
                  </Link>
                  {isOnPitch && (
                    <span className="rounded-full border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-2 py-0.5 text-[9px] font-medium text-[var(--accent-strong)]">
                      On pitch
                    </span>
                  )}
                  {isSelected && (
                    <span className="rounded-full border border-[rgba(106,153,219,0.3)] bg-[rgba(106,153,219,0.12)] px-2 py-0.5 text-[9px] font-medium text-[#8bb8f0]">
                      Selected
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs app-copy-soft">
                  {player.primaryPosition ?? "No pos"} / {player.secondaryPosition ?? "—"} / {player.tertiaryPosition ?? "—"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Position Fit Legend */}
      <section className="app-panel rounded-[1.75rem] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Position Fit Legend
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(["primary", "secondary", "tertiary", "fallback"] as const).map((fit) => (
            <div key={fit} className={`rounded-2xl border px-4 py-3 ${fitTone(fit)}`}>
              <p className={`text-sm font-semibold capitalize ${fitTextClass(fit)}`}>{fit}</p>
              <p className="mt-1 text-xs opacity-80">
                {fit === "primary" && "Player's primary position"}
                {fit === "secondary" && "Player's secondary position"}
                {fit === "tertiary" && "Player's tertiary position"}
                {fit === "fallback" && "Not a natural position for this player"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}