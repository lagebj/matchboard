import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AssistantCoachHypothesisViewModel } from "@/components/ai/assistant-coach-hypothesis-panel";
import type { PlayerDevelopmentCycleInsight } from "@/lib/ai/presentation/player-development-cycle-insight";
import { buildPlayerDevelopmentViewModel, type PlayerDevelopmentViewModelInput } from "@/lib/touchline/presentation/player-development-view-model";
import type { EvidenceSourceMap } from "../../w2-shared/evidence-source-types";

/**
 * Gate D Wave 2 — D03, grounded longitudinal hypothesis with an existing coach focus (register
 * D03: "AI hypothesis and coach focus"; XR-A01/XR-A04). Jonas Berg's active development focus
 * ("Composure under pressure in the defensive third") already has four observations across a
 * 10-week window — a genuine longitudinal story, not two values compared in isolation. The
 * Assistant Coach hypothesis cites a derived trend plus two of those same observations, discloses
 * one contradicting match event rather than hiding it, and never claims the development focus
 * itself is now complete — that remains the coach's own call via Promote/Dismiss.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W2-D03-GROUNDED",
  fixtureId: "gate-d-w2-d03-grounded-longitudinal-hypothesis",
  fixtureVersion: 1,
  fixtureSha256: "24cb1c5540a93a72dfd4c6277ad869f24ab111cd53a78b27ab757cd356288eb4",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-10-12T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const developmentInput: PlayerDevelopmentViewModelInput = buildPlayerDevelopmentViewModel({
  activeFocus: {
    id: "thread-jonas-composure",
    focus: "Composure under pressure in the defensive third",
    category: "Technical",
    rationale: "Gave the ball away twice under pressure near our own box in the first match of this window.",
    startedAt: "30 Aug 2026",
    reviewState: "PENDING",
    reviewDueAt: "25 Oct 2026",
    observationCount: 5,
  },
  observationTimeline: [
    {
      id: "obs-jonas-w1",
      note: "Looked rushed receiving under pressure near our own box, gave the ball away twice in dangerous areas.",
      createdAt: "30 Aug 2026",
      matchLabel: "vs Lillestrøm",
    },
    {
      id: "obs-jonas-w4",
      note: "Showed one clean turn away from pressure in the defensive third, but still played a hurried pass under the second one.",
      createdAt: "20 Sep 2026",
      matchLabel: "vs Nittedal",
    },
    {
      id: "obs-jonas-w7",
      note: "Consistently took an extra half-second to scan before releasing under pressure; no giveaways in the defensive third this match.",
      createdAt: "27 Sep 2026",
      matchLabel: "vs Asker",
    },
    {
      id: "obs-jonas-w9",
      note: "One giveaway under pressure in the defensive third — the pass was rushed, not just a bad bounce.",
      createdAt: "4 Oct 2026",
      matchLabel: "vs Skedsmo",
    },
    {
      id: "obs-jonas-w10",
      note: "Comfortable receiving under pressure twice in the defensive third; the one giveaway this match came from a bad bounce, not panic.",
      createdAt: "11 Oct 2026",
      matchLabel: "vs Grorud",
    },
  ],
  positionalContextNotes: [],
  completedFocusHistory: [],
});

export const cycleInsight: PlayerDevelopmentCycleInsight = {
  title: "Composure under pressure is a squad-wide recurring theme",
  body: "Several midfielders, including Jonas, showed rushed decisions under pressure early in this review window. The pattern eased for most of the group across the final two weeks, though not uniformly.",
  windowLabel: "30 Aug – 11 Oct 2026",
  teamId: "team-gate-d-w2-u15",
};

export const hypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-d-w2-d03-grounded-hypothesis",
  statement:
    "Jonas Berg's defensive-third giveaway rate decreased across the latest eligible window (previous 3 matches vs. latest 3 matches), and two of his most recent coach observations describe more composed ball retention under pressure in those same matches. This is consistent with the active development focus 'Composure under pressure in the defensive third' showing some effect, though the sample is still short and one match in the latest window still recorded a giveaway under pressure — not every match improved.",
  uncertainty: "MEDIUM",
  supportingRefs: [
    {
      kind: "DERIVED_TREND",
      id: "trend-jonas-giveaway-rate",
      label: "Defensive-third giveaway rate, previous 3 vs. latest 3 matches",
      occurredAt: "11 Oct 2026",
    },
    { kind: "QUALITATIVE_OBSERVATION", id: "obs-jonas-w7", label: "Coach observation, 27 Sep 2026 vs Asker" },
    { kind: "QUALITATIVE_OBSERVATION", id: "obs-jonas-w10", label: "Coach observation, 11 Oct 2026 vs Grorud" },
  ],
  contradictingRefs: [{ kind: "QUALITATIVE_OBSERVATION", id: "obs-jonas-w9", label: "Coach observation, 4 Oct 2026 vs Skedsmo" }],
  missingEvidence: ["Training-session composure drills are not logged in Matchboard", "Only 3 matches in the latest window — a short sample"],
};

export const sources: EvidenceSourceMap = {
  "trend-jonas-giveaway-rate": {
    id: "trend-jonas-giveaway-rate",
    kind: "DERIVED_TREND",
    label: "Defensive-third giveaway rate, previous 3 vs. latest 3 matches",
    occurredAt: "11 Oct 2026",
    detail:
      "Giveaways under pressure in the defensive third: 5 across the previous 3 matches (30 Aug – 20 Sep) -> 2 across the latest 3 matches (27 Sep – 11 Oct). Based on 6 total eligible matches this window.",
    provenance: "DERIVED",
    coverage: "6 of 6 eligible matches recorded",
  },
  "obs-jonas-w7": {
    id: "obs-jonas-w7",
    kind: "QUALITATIVE_OBSERVATION",
    label: "Coach observation, 27 Sep 2026 vs Asker",
    occurredAt: "27 Sep 2026",
    detail: "Consistently took an extra half-second to scan before releasing under pressure; no giveaways in the defensive third this match.",
    provenance: "RECORDED",
    coverage: "Single match observation",
  },
  "obs-jonas-w10": {
    id: "obs-jonas-w10",
    kind: "QUALITATIVE_OBSERVATION",
    label: "Coach observation, 11 Oct 2026 vs Grorud",
    occurredAt: "11 Oct 2026",
    detail: "Comfortable receiving under pressure twice in the defensive third; the one giveaway this match came from a bad bounce, not panic.",
    provenance: "RECORDED",
    coverage: "Single match observation",
  },
  "obs-jonas-w9": {
    id: "obs-jonas-w9",
    kind: "QUALITATIVE_OBSERVATION",
    label: "Coach observation, 4 Oct 2026 vs Skedsmo",
    occurredAt: "4 Oct 2026",
    detail: "One giveaway under pressure in the defensive third — the pass was rushed, not just a bad bounce.",
    provenance: "RECORDED",
    coverage: "Single match observation; this match is inside the latest eligible window and is not excluded from the trend.",
  },
};

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W2-D03-GROUNDED", developmentInput, cycleInsight, hypothesis, sources };
