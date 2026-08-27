"use client";

import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { formatGameFormat } from "@/lib/formatters/game-format";

type HandoverSelection = {
  id: string;
  playerId: string;
  role: string;
  status: string;
  overrideReason: string | null;
  matchdayResponsibility: string | null;
  explanation: unknown;
  playerFirstName: string;
  playerLastName: string;
  playerPosition: string;
  coreTeamName: string | null;
};

type HandoverHelper = {
  id: string;
  playerId: string;
  plannedRole: string | null;
  playerFirstName: string;
  playerLastName: string;
  playerPosition: string;
  coreTeamName: string | null;
};

type HandoverWarning = {
  id: string;
  code: string;
  severity: string;
  message: string;
};

type HandoverRotationChange = {
  id: string;
  sequence: number;
  outPlayerId: string | null;
  inPlayerId: string | null;
  outPosition: string | null;
  inPosition: string | null;
  positionOnly: boolean;
  approximateMatchSeconds: number | null;
  status: string;
  outPlayerName: string;
  inPlayerName: string;
};

type HandoverMatch = {
  id: string;
  opponent: string;
  startsAt: Date;
  matchDate: string;
  matchTime: string;
  homeAway: string;
  matchType: string;
  gameFormat: string;
  status: string;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  matchFit: string | null;
  notes: string | null;
  teamName: string;
  roundName: string;
  leagueSeasonName: string | null;
  opponentTeamName: string | null;
  selections: HandoverSelection[];
  helpers: HandoverHelper[];
  coachingIntent: { id: string; category: string; note: string | null } | null;
  warnings: HandoverWarning[];
  plannedRotation: { id: string; status: string; changes: HandoverRotationChange[] } | null;
};

type CoachHandoverViewProps = {
  match: HandoverMatch;
};

const ROLE_ORDER: Record<string, number> = {
  CORE: 0,
  SUPPORT: 1,
  DEVELOPMENT: 2,
  BACKFILL: 3,
  HELPER: 4,
};

const ROLE_LABELS: Record<string, string> = {
  CORE: "Core",
  SUPPORT: "Support",
  DEVELOPMENT: "Development",
  BACKFILL: "Squad repair",
  HELPER: "Helper",
};

function formatMatchType(type: string): string {
  const map: Record<string, string> = { LEAGUE: "League", FRIENDLY: "Friendly", CUP: "Cup", DEVELOPMENT: "Development" };
  return map[type] ?? type;
}

function roleVariant(role: string): "success" | "warning" | "neutral" | "info" {
  if (role === "CORE") return "success";
  if (role === "SUPPORT") return "warning";
  if (role === "DEVELOPMENT") return "info";
  return "neutral";
}

export function CoachHandoverView({ match }: CoachHandoverViewProps) {
  const grouped = match.selections.reduce<Record<string, HandoverSelection[]>>((acc, s) => {
    const key = s.role || "CORE";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sortedRoles = Object.keys(grouped).sort((a, b) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99));
  const blockedWarnings = match.warnings.filter((w) => w.severity === "HARD_BLOCK");
  const decisionWarnings = match.warnings.filter((w) => w.severity === "REQUIRES_OVERRIDE");
  const noteWarnings = match.warnings.filter((w) => w.severity === "WARNING" || w.severity === "SCORING_PREFERENCE");

  const isCancelled = match.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-lg space-y-3 px-3 pb-6 pt-2">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">
          {match.teamName} vs {match.opponentTeamName ?? match.opponent}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          {match.matchDate} · {match.matchTime} · {match.homeAway === "HOME" ? "Home" : "Away"}
        </p>
        <div className="flex flex-wrap gap-1">
          <StatusPill variant="neutral" size="sm">{formatMatchType(match.matchType)}</StatusPill>
          <StatusPill variant="neutral" size="sm">{formatGameFormat(match.gameFormat)}</StatusPill>
          {isCancelled && <StatusPill variant="danger" size="sm">Cancelled</StatusPill>}
        </div>
        {match.leagueSeasonName && (
          <p className="text-xs text-[var(--text-muted)]">{match.leagueSeasonName} · {match.roundName}</p>
        )}
      </div>

      {match.coachingIntent && (
        <TacticalSurface variant="default" padding="sm">
          <SectionHeader title="Coaching intent" />
          <div className="mt-1">
            <StatusPill variant="info" size="sm">{match.coachingIntent.category.replace(/_/g, " ").toLowerCase()}</StatusPill>
            {match.coachingIntent.note && <p className="mt-1 text-sm">{match.coachingIntent.note}</p>}
          </div>
        </TacticalSurface>
      )}

      {match.notes && (
        <TacticalSurface variant="default" padding="sm">
          <SectionHeader title="Match notes" />
          <p className="text-sm">{match.notes}</p>
        </TacticalSurface>
      )}

      {blockedWarnings.length > 0 && (
        <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2">
          <p className="text-sm font-medium text-red-200">Blocked</p>
          {blockedWarnings.map((w) => (
            <p key={w.id} className="text-xs text-red-300">{w.message}</p>
          ))}
        </div>
      )}

      {decisionWarnings.length > 0 && (
        <div className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2">
          <p className="text-sm font-medium text-amber-200">Decision required</p>
          {decisionWarnings.map((w) => (
            <p key={w.id} className="text-xs text-amber-300">{w.message}</p>
          ))}
        </div>
      )}

      <TacticalSurface variant="default" padding="sm">
        <SectionHeader title="Squad" description={`${match.selections.length} selected`} />
        <div className="mt-1.5 space-y-3">
          {sortedRoles.map((role) => (
            <div key={role}>
              <div className="mb-1 flex items-center gap-1.5">
                <StatusPill variant={roleVariant(role)} size="sm">{ROLE_LABELS[role] ?? role}</StatusPill>
                <span className="text-xs text-[var(--text-muted)]">{grouped[role].length}</span>
              </div>
              <div className="space-y-0.5">
                {grouped[role].map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded px-2 py-1 text-sm">
                    <span className="font-medium">{s.playerFirstName} {s.playerLastName}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {s.playerPosition}
                      {s.coreTeamName && s.coreTeamName !== match.teamName ? ` · ${s.coreTeamName}` : ""}
                    </span>
                    {s.matchdayResponsibility && (
                      <StatusPill variant="info" size="sm">{s.matchdayResponsibility.replace(/_/g, " ").toLowerCase()}</StatusPill>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {match.helpers.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <StatusPill variant="neutral" size="sm">Helpers</StatusPill>
                <span className="text-xs text-[var(--text-muted)]">{match.helpers.length}</span>
              </div>
              {match.helpers.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded px-2 py-1 text-sm">
                  <span className="font-medium">{h.playerFirstName} {h.playerLastName}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {h.playerPosition}
                    {h.coreTeamName ? ` · ${h.coreTeamName}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TacticalSurface>

      {match.plannedRotation && match.plannedRotation.changes.length > 0 && (
        <TacticalSurface variant="default" padding="sm">
          <SectionHeader title="Planned rotations" description={`${match.plannedRotation.changes.length} change${match.plannedRotation.changes.length !== 1 ? "s" : ""}`} />
          <div className="mt-1.5 space-y-1.5">
            {match.plannedRotation.changes.map((c) => (
              <div key={c.id} className="rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {c.outPlayerName} → {c.inPlayerName}
                  </span>
                  {c.approximateMatchSeconds != null && (
                    <span className="text-xs text-[var(--text-muted)]">
                      ~{Math.floor(c.approximateMatchSeconds / 60)}&apos;
                    </span>
                  )}
                </div>
                {(c.outPosition || c.inPosition) && (
                  <p className="text-xs text-[var(--text-muted)]">
                    {c.outPosition ?? "?"} → {c.inPosition ?? "?"}
                    {c.positionOnly ? " (position only)" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </TacticalSurface>
      )}

      {match.matchFit && match.matchFit !== "UNKNOWN" && (
        <TacticalSurface variant="default" padding="sm">
          <SectionHeader title="Sporting match fit" />
          <p className="text-sm">{match.matchFit.replace(/_/g, " ").toLowerCase()}</p>
        </TacticalSurface>
      )}

      {noteWarnings.length > 0 && (
        <TacticalSurface variant="subtle" padding="sm">
          <SectionHeader title="Planning notes" />
          <ul className="mt-1 space-y-0.5">
            {noteWarnings.map((w) => (
              <li key={w.id} className="text-xs text-[var(--text-muted)]">· {w.message}</li>
            ))}
          </ul>
        </TacticalSurface>
      )}
    </div>
  );
}