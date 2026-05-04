import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import type { Match, Player, Selection, Team } from "@/generated/prisma/client";
import { formatPlayerName } from "@/lib/player-metrics";

type SelectionWithPlayer = Selection & {
  player: Pick<Player, "id" | "firstName" | "lastName" | "primaryPosition" | "supportSuitability" | "developmentReadiness" | "nonRotatable" | "reducedMatchLoadAllowed" | "currentAvailability"> & {
    coreTeam: Pick<Team, "id" | "name">;
  };
};

type MatchWithTeam = Match & {
  team: Pick<Team, "id" | "name">;
};

export type AssistantAdviceCard = {
  category: "support_plan" | "backfill_chain" | "development_exposure" | "player_load" | "decisions_needed" | "finalization_status" | "fairness_flags" | "team_burden";
  title: string;
  recommendation: string;
  risk: string;
  alternative: string;
  consequence: string;
  severity: "blocker" | "warning" | "info";
  actionHref: string;
};

export type FinalizationStatus = {
  canFinalize: boolean;
  reason: string;
  draftMatchCount: number;
  finalizedMatchCount: number;
  totalMatchCount: number;
  unresolvedWarnings: number;
};

export function buildAssistantAdvice(
  matches: MatchWithTeam[],
  selections: SelectionWithPlayer[],
  teams: Team[],
  warnings: { severity: string; rule: string; message: string }[],
): { cards: AssistantAdviceCard[]; finalizationStatus: FinalizationStatus } {
  const cards: AssistantAdviceCard[] = [];

  const selectionsByMatchId = new Map<string, SelectionWithPlayer[]>();
  for (const sel of selections) {
    const existing = selectionsByMatchId.get(sel.matchId) ?? [];
    existing.push(sel);
    selectionsByMatchId.set(sel.matchId, existing);
  }

  const draftMatches = matches.filter(
    (m) => selectionsByMatchId.get(m.id)?.some((s) => s.status === SelectionStatus.DRAFT),
  );
  const finalizedMatches = matches.filter(
    (m) => selectionsByMatchId.get(m.id)?.some((s) => s.status === SelectionStatus.FINALIZED),
  );
  const unresolvedWarnings = warnings.filter(
    (w) => w.severity === "HARD_BLOCK" || w.severity === "REQUIRES_OVERRIDE",
  );

  const finalizationStatus: FinalizationStatus = {
    canFinalize: draftMatches.length > 0 && unresolvedWarnings.length === 0,
    reason:
      draftMatches.length === 0
        ? "No draft matches to finalize"
        : unresolvedWarnings.length > 0
          ? `${unresolvedWarnings.length} unresolved blocker warning${unresolvedWarnings.length === 1 ? "" : "s"}`
          : "Ready to finalize",
    draftMatchCount: draftMatches.length,
    finalizedMatchCount: finalizedMatches.length,
    totalMatchCount: matches.length,
    unresolvedWarnings: unresolvedWarnings.length,
  };

  for (const match of draftMatches) {
    const matchSelections = selectionsByMatchId.get(match.id) ?? [];
    const supportSels = matchSelections.filter((s) => s.role === SelectionRole.SUPPORT);
    const backfillSels = matchSelections.filter((s) => s.role === SelectionRole.BACKFILL);
    const devSels = matchSelections.filter((s) => s.role === SelectionRole.DEVELOPMENT);
    const coreDrops = matchSelections.filter((s) => s.role === SelectionRole.CORE_MATCH_DROP);
    const reducedDrops = matchSelections.filter((s) => s.role === SelectionRole.REDUCED_MATCH_LOAD_DROP);

    if (supportSels.length > 0) {
      const supportNames = supportSels.map((s) => formatPlayerName(s.player)).join(", ");
      const sourceTeams = new Set(supportSels.map((s) => s.player.coreTeam.name));
      const targetTeam = match.team.name;

      cards.push({
        category: "support_plan",
        title: `${targetTeam} receives ${supportSels.length} support player${supportSels.length === 1 ? "" : "s"}`,
        recommendation: `${supportNames} from ${[...sourceTeams].join(" and ")} should fill support slots for ${targetTeam}.`,
        risk: `Sending ${supportSels.length} player${supportSels.length === 1 ? "" : "s"} out may weaken ${[...sourceTeams].join(" and ")} core depth.`,
        alternative: "Consider a shorter support rotation or reduced support count if source teams are thin.",
        consequence: `${targetTeam} must drop core match if support slots are not filled.`,
        severity: backfillSels.length > 0 ? "warning" : "info",
        actionHref: `/matches`,
      });
    }

    if (backfillSels.length > 0) {
      const backfillNames = backfillSels.map((s) => formatPlayerName(s.player)).join(", ");
      const affectedSourceTeams = new Set(supportSels.map((s) => s.player.coreTeam.name));
      const chain = [...affectedSourceTeams].length > 0
        ? `Squad repair needed because ${[...affectedSourceTeams].join(", ")} player${supportSels.length === 1 ? "" : "s"} moved to support.`
        : "Squad repair positions exist in the selection.";

      cards.push({
        category: "backfill_chain",
        title: `${backfillSels.length} squad repair position${backfillSels.length === 1 ? "" : "s"} in this round`,
        recommendation: `${backfillNames} should fill squad repair slots. ${chain}`,
        risk: "Squad repair players may not have the same position fit or experience level as the original core player.",
        alternative: "Check if reducing support count avoids the squad repair chain entirely.",
        consequence: "Source teams drop below minimum core depth if squad repair is not resolved.",
        severity: "warning",
        actionHref: `/matches`,
      });
    }

    if (devSels.length > 0) {
      const devNames = devSels.map((s) => formatPlayerName(s.player)).join(", ");
      cards.push({
        category: "development_exposure",
        title: `${devSels.length} development selection${devSels.length === 1 ? "" : "s"}`,
        recommendation: `${devNames} should receive development minutes in this round.`,
        risk: "Development players may need more support or simpler positional assignments.",
        alternative: "Consider a confidence rebuild role if the player is returning from absence.",
        consequence: "Skipping development exposure hurts long-term fairness and player readiness.",
        severity: "info",
        actionHref: `/matches`,
      });
    }

    if (coreDrops.length > 0) {
      const dropNames = coreDrops.map((s) => formatPlayerName(s.player)).join(", ");
      cards.push({
        category: "player_load",
        title: `${coreDrops.length} core match drop${coreDrops.length === 1 ? "" : "s"}`,
        recommendation: `${dropNames} should be rested this round. Check that this does not break fairness targets.`,
        risk: "Repeated drops for the same player indicate a fairness problem.",
        alternative: "If the player is development-ready, consider a development role instead of a full drop.",
        consequence: "Dropped players fall behind teammates in match count and may need priority in the next round.",
        severity: "warning",
        actionHref: `/matches`,
      });
    }

    if (reducedDrops.length > 0) {
      const reducedNames = reducedDrops.map((s) => formatPlayerName(s.player)).join(", ");
      cards.push({
        category: "player_load",
        title: `${reducedDrops.length} reduced match load drop${reducedDrops.length === 1 ? "" : "s"}`,
        recommendation: `${reducedNames} have reduced match load allowance and should be rested.`,
        risk: "These players are flagged for reduced load. Skipping rest increases fatigue risk.",
        alternative: "If squad depth is critical, override with documented reason.",
        consequence: "Overriding reduced match load may violate coach-configured safety rules.",
        severity: "warning",
        actionHref: `/matches`,
      });
    }
  }

  if (draftMatches.length > 0) {
    cards.push({
      category: "decisions_needed",
      title: `${draftMatches.length} draft match${draftMatches.length === 1 ? "" : "es"} need review`,
      recommendation: "Review the draft selection, check warnings, and finalize when ready.",
      risk: "Leaving drafts unresolved blocks downstream planning for subsequent rounds.",
      alternative: "Regenerate drafts if availability has changed since the last generation.",
      consequence: "Drafts left in limbo delay match preparation and communication to families.",
      severity: draftMatches.length > 2 ? "warning" : "info",
      actionHref: `/matches`,
    });
  }

  const allCategories: AssistantAdviceCard["category"][] = [
    "support_plan",
    "backfill_chain",
    "development_exposure",
    "player_load",
    "decisions_needed",
    "finalization_status",
    "fairness_flags",
    "team_burden",
  ];
  const presentCategories = new Set(cards.map((c) => c.category));
  for (const cat of allCategories) {
    if (!presentCategories.has(cat)) {
      const label =
        cat === "support_plan" ? "Support plan" :
        cat === "backfill_chain" ? "Squad repair chain" :
        cat === "development_exposure" ? "Development exposure" :
        cat === "player_load" ? "Player load" :
        cat === "decisions_needed" ? "Decisions needed" :
        cat === "fairness_flags" ? "Fairness flags" :
        cat === "team_burden" ? "Team burden" :
        "Finalization status";

      cards.push({
        category: cat,
        title: `No ${label.toLowerCase()} issues`,
        recommendation: `No action needed for ${label.toLowerCase()} right now.`,
        risk: "N/A",
        alternative: "N/A",
        consequence: "N/A",
        severity: "info",
        actionHref: `/matches`,
      });
    }
  }

  return { cards, finalizationStatus };
}