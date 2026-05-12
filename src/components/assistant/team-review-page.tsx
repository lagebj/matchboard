"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import type { TeamReadiness, SelectionExplanation, Recommendation } from "@/domain/assistant-manager/types";
import { getTeamReadiness, getSelectionExplanation } from "@/domain/assistant-manager/service";
import { TeamReadinessCard } from "./team-readiness-card";
import { RuleImpactPanel } from "./rule-impact-panel";
import { CrossTeamImpactPanel } from "./cross-team-impact-panel";
import { RecommendationPanel } from "./recommendation-panel";

export function TeamReviewPage({ teamId }: { teamId: string }) {
  const [readiness, setReadiness] = useState<TeamReadiness | null>(null);
  const [_explanation, setExplanation] = useState<SelectionExplanation | null>(null);
  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [r, e] = await Promise.all([
        getTeamReadiness(teamId),
        getSelectionExplanation("TEAM", teamId),
      ]);
      setReadiness(r);
      setExplanation(e);
    });
  }, [teamId, startTransition]);

  if (!readiness) {
    return <div className="p-4 text-sm text-zinc-500">Loading team review...</div>;
  }

  const recommendation: Recommendation | undefined = readiness.recommendation;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Team Review</p>
        <Link href="/teams" className="text-[10px] text-zinc-500 hover:text-zinc-300">Back to teams</Link>
      </div>

      <TeamReadinessCard readiness={readiness} />

      {readiness.supportNeeded > 0 && (
        <div className="rounded-md border border-amber-700/40 bg-amber-900/15 p-3">
          <p className="text-xs font-semibold text-amber-300">Support needed</p>
          <p className="text-[11px] text-zinc-300 mt-1">
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