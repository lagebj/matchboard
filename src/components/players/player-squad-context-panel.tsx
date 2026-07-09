import Link from "next/link";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";

type RotationPathInfo = {
  id: string;
  fromTeamName: string;
  toTeamName: string;
  role: string;
  active: boolean;
};

type MovementCandidateInfo = {
  id: string;
  rotationPathId: string;
  fromTeamName: string;
  toTeamName: string;
  role: string;
  status: string;
  rationaleCategory: string;
  rationaleNote: string | null;
};

type PlayerSquadContextPanelProps = {
  rotationPaths: RotationPathInfo[];
  movementCandidates: MovementCandidateInfo[];
  coreTeamId: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  SUPPORT: "Support",
  DEVELOPMENT: "Development",
  BACKFILL: "Squad repair",
  CONFIDENCE_REBUILD: "Confidence rebuild",
  CORE_MATCH_DROP: "Core match drop",
  DOUBLE_LOAD: "Double load",
};

const CANDIDATE_STATUS_VARIANT: Record<string, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  PAUSED: "warning",
};

const RATIONALE_LABEL: Record<string, string> = {
  CHALLENGE_EXPOSURE: "Challenge exposure",
  CONFIDENCE_AND_INVOLVEMENT: "Confidence & involvement",
  STABILISE_TEAM_FUNCTION: "Stabilise team function",
  SUPPORT_TEAMMATES: "Support teammates",
  POSITIONAL_LEARNING: "Positional learning",
  RESET_AND_RESPONSIBILITY: "Reset & responsibility",
  COACH_JUDGEMENT: "Coach judgement",
};

function formatRole(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

function formatRationale(category: string): string {
  return RATIONALE_LABEL[category] ?? category;
}

export function PlayerSquadContextPanel({ rotationPaths, movementCandidates, coreTeamId }: PlayerSquadContextPanelProps) {
  if (rotationPaths.length === 0 && movementCandidates.length === 0) {
    return (
      <TacticalSurface variant="default" padding="sm">
        <SectionHeader title="Squad context" />
        <p className="mt-1.5 text-[11px] text-[var(--text-soft)]">No rotation paths or movement candidates.</p>
      </TacticalSurface>
    );
  }

  return (
    <TacticalSurface variant="default" padding="sm">
      <SectionHeader title="Squad context" />

      {rotationPaths.length > 0 && (
        <div className="mt-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-0.5">
            Rotation paths
          </p>
          <div className="flex flex-col gap-0.5">
            {rotationPaths.map((path) => (
              <div key={path.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-zinc-300">
                  {path.fromTeamName} → {path.toTeamName}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]">{formatRole(path.role)}</span>
                  {!path.active && (
                    <span className="text-[9px] text-zinc-500">Inactive</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {movementCandidates.length > 0 && (
        <div className={rotationPaths.length > 0 ? "mt-2" : "mt-1.5"}>
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-0.5">
            Movement candidates
          </p>
          <div className="flex flex-col gap-0.5">
            {movementCandidates.map((cand) => (
              <div key={cand.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-zinc-300">
                  {cand.fromTeamName} → {cand.toTeamName}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]">{formatRole(cand.role)}</span>
                  <StatusPill variant={CANDIDATE_STATUS_VARIANT[cand.status] ?? "neutral"} size="sm">
                    {cand.status === "ACTIVE" ? "Active" : "Paused"}
                  </StatusPill>
                </div>
              </div>
            ))}
            {movementCandidates.some((c) => c.rationaleCategory && c.rationaleCategory !== "COACH_JUDGEMENT") && (
              <div className="mt-0.5 space-y-px">
                {movementCandidates
                  .filter((c) => c.rationaleCategory && c.rationaleCategory !== "COACH_JUDGEMENT")
                  .map((c) => (
                    <p key={c.id} className="text-[9px] text-[var(--text-muted)]">
                      {c.fromTeamName} → {c.toTeamName}: {formatRationale(c.rationaleCategory)}
                      {c.rationaleNote && <span className="text-[var(--text-soft)]"> — {c.rationaleNote}</span>}
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {coreTeamId && (
        <div className="mt-2">
          <Link
            href={`/teams/${coreTeamId}`}
            className="text-[10px] text-[var(--accent)] hover:underline"
          >
            View team detail →
          </Link>
        </div>
      )}
    </TacticalSurface>
  );
}