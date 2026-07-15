"use client";

import { useState, useEffect, useTransition } from "react";
import type { PlannedVsActualMatch } from "@/lib/audit/audit-types";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { RoleBadge } from "@/components/ui/role-badge";

function formatReportStatus(status: string): { label: string; tone: "default" | "success" | "warning" | "danger" } {
  switch (status) {
    case "LOCKED":
      return { label: "Report complete", tone: "success" };
    case "REPORTED":
      return { label: "Report submitted", tone: "warning" };
    case "DRAFT":
      return { label: "Draft report", tone: "warning" };
    default:
      return { label: "No report", tone: "danger" };
  }
}

function formatResult(result: "won" | "drawn" | "lost" | null): string {
  switch (result) {
    case "won": return "Won";
    case "drawn": return "Drawn";
    case "lost": return "Lost";
    default: return "";
  }
}

function resultColor(result: "won" | "drawn" | "lost" | null): string {
  switch (result) {
    case "won": return "text-emerald-400";
    case "drawn": return "text-zinc-400";
    case "lost": return "text-red-400";
    default: return "";
  }
}

export function PlannedVsActualPanel({ matchId }: { matchId: string }) {
  const [data, setData] = useState<PlannedVsActualMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/audit/planned-vs-actual/match/${matchId}`);
        if (!res.ok) {
          setError("Could not load review data.");
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Could not load review data.");
      }
    });
  }, [matchId, startTransition]);

  if (error) {
    return (
      <Surface padding="md">
        <p className="text-sm text-red-400">{error}</p>
      </Surface>
    );
  }

  if (isPending || !data) {
    return (
      <Surface padding="md">
        <p className="text-sm text-zinc-500">Loading review data...</p>
      </Surface>
    );
  }

  const reportInfo = formatReportStatus(data.reportStatus);

  return (
    <div className="flex flex-col gap-4">
      <Surface padding="md">
        <SectionHeader
          title="Planned vs Actual"
          eyebrow={`Report status: ${reportInfo.label}`}
        />
        <p className="mt-2 text-sm text-zinc-300">{data.deltaSummary}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
          <span>{data.homeAway === "HOME" ? "Home" : "Away"} vs {data.opponent}</span>
          {data.result && (
            <span className={resultColor(data.result)}>
              {formatResult(data.result)}
              {data.homeGoals !== null && data.awayGoals !== null && (
                <> ({data.homeGoals}-{data.awayGoals})</>
              )}
            </span>
          )}
        </div>
      </Surface>

      {data.plannedPlayers.length > 0 && (
        <Surface padding="md">
          <SectionHeader
            title="Planned squad"
            eyebrow={`${data.plannedPlayers.length} players`}
          />
          <div className="mt-3 flex flex-col gap-1.5">
            {data.plannedPlayers.map((p) => (
              <div key={p.playerId} className="flex items-center gap-2 text-sm">
                <RoleBadge role={p.role} />
                <span className="text-zinc-200">{p.playerName}</span>
                <span className="text-[10px] text-zinc-500">
                  {p.coreTeamName && p.coreTeamName !== p.teamName ? `(${p.coreTeamName})` : ""}
                </span>
                {p.overrideReason && (
                  <span className="text-[10px] text-amber-500 ml-auto">Override</span>
                )}
                {p.matchdayResponsibility && (
                  <span className="text-[10px] text-blue-400">{p.matchdayResponsibility.replace(/_/g, " ")}</span>
                )}
              </div>
            ))}
          </div>
        </Surface>
      )}

      {data.actualParticipants.length > 0 && (
        <Surface padding="md">
          <SectionHeader
            title="Actual participants"
            eyebrow={`${data.actualParticipants.filter((a) => a.attendanceStatus === "PRESENT").length} present`}
          />
          <div className="mt-3 flex flex-col gap-1.5">
            {data.actualParticipants
              .filter((a) => a.attendanceStatus === "PRESENT")
              .map((a) => (
                <div key={a.playerId} className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-200">{a.playerName}</span>
                  {a.goals > 0 && (
                    <span className="text-[10px] text-emerald-400">{a.goals}G</span>
                  )}
                  {a.assists > 0 && (
                    <span className="text-[10px] text-blue-400">{a.assists}A</span>
                  )}
                  {a.source === "ADDED_POST_MATCH" && (
                    <span className="text-[10px] text-amber-400 ml-auto">Unplanned</span>
                  )}
                </div>
              ))}
          </div>
        </Surface>
      )}

      {data.plannedButAbsent.length > 0 && (
        <Surface padding="md">
          <SectionHeader
            title="Planned but absent"
            eyebrow={`${data.plannedButAbsent.length} player${data.plannedButAbsent.length === 1 ? "" : "s"}`}
          />
          <div className="mt-3 flex flex-col gap-1.5">
            {data.plannedButAbsent.map((p) => (
              <div key={p.playerId} className="flex items-center gap-2 text-sm">
                <RoleBadge role={p.plannedRole} />
                <span className="text-zinc-200">{p.playerName}</span>
                {p.absenceReason && (
                  <span className="text-[10px] text-red-400">{p.absenceReason.replace(/_/g, " ")}</span>
                )}
                {!p.absenceReason && (
                  <span className="text-[10px] text-zinc-500">No reason recorded</span>
                )}
              </div>
            ))}
          </div>
        </Surface>
      )}

      {data.unplannedParticipants.length > 0 && (
        <Surface padding="md">
          <SectionHeader
            title="Unplanned participants"
            eyebrow={`${data.unplannedParticipants.length} player${data.unplannedParticipants.length === 1 ? "" : "s"}`}
          />
          <div className="mt-3 flex flex-col gap-1.5">
            {data.unplannedParticipants.map((p) => (
              <div key={p.playerId} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-200">{p.playerName}</span>
                {p.unplannedAppearanceReason && (
                  <span className="text-[10px] text-amber-400">{p.unplannedAppearanceReason.replace(/_/g, " ")}</span>
                )}
                {p.goals > 0 && (
                  <span className="text-[10px] text-emerald-400">{p.goals}G</span>
                )}
                {p.assists > 0 && (
                  <span className="text-[10px] text-blue-400">{p.assists}A</span>
                )}
              </div>
            ))}
          </div>
        </Surface>
      )}
    </div>
  );
}