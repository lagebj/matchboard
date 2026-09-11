"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import type { TeamReadiness, SelectionExplanation, Recommendation } from "@/domain/assistant-manager/types";
import { fetchTeamReadiness, fetchSelectionExplanation } from "@/domain/assistant-manager/actions";
import { TeamReadinessCard } from "./team-readiness-card";
import { RuleImpactPanel } from "./rule-impact-panel";
import { CrossTeamImpactPanel } from "./cross-team-impact-panel";
import { RecommendationPanel } from "./recommendation-panel";
import { useOrgUrl } from "@/components/shell/org-slug-context";

export function TeamReviewPage({ teamId }: { teamId: string }) {
  const orgUrl = useOrgUrl();
  const [readiness, setReadiness] = useState<TeamReadiness | null>(null);
  const [_explanation, setExplanation] = useState<SelectionExplanation | null>(null);
  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [r, e] = await Promise.all([
        fetchTeamReadiness(teamId),
        fetchSelectionExplanation("TEAM", teamId),
      ]);
      setReadiness(r);
      setExplanation(e);
    });
  }, [teamId, startTransition]);

  if (!readiness) {
    return <div className="touchline p-4 text-sm text-[var(--text-muted)]">Loading team review...</div>;
  }

  const recommendation: Recommendation | undefined = readiness.recommendation;

  return (
    // Touchline island (theme-aware — Phase 10 preparatory pass, ADR-0134).
    <div className="touchline flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Team Review</p>
        <Link href={orgUrl("/teams")} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]">Back to teams</Link>
      </div>

      <TeamReadinessCard readiness={readiness} />

      {readiness.supportNeeded > 0 && (
        <div className="rounded-md border border-[var(--warning)]/40 bg-[var(--warning-subtle)] p-3">
          <p className="text-xs font-semibold text-[var(--warning)]">Support needed</p>
          <p className="text-[11px] text-[var(--text-soft)] mt-1">
            {readiness.teamName || readiness.teamId} needs {readiness.supportNeeded} support player{readiness.supportNeeded !== 1 ? "s" : ""} to reach target squad size.
          </p>
        </div>
      )}

      {recommendation && <RecommendationPanel recommendation={recommendation} />}

      {readiness.ruleImpacts.length > 0 && (
        <RuleImpactPanel ruleImpacts={readiness.ruleImpacts} />
      )}

      {recommendation && recommendation.crossTeamImpacts.length > 0 && (
        <CrossTeamImpactPanel impacts={recommendation.crossTeamImpacts} />
      )}
    </div>
  );
}