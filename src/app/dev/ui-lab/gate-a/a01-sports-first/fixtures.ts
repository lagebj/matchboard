import type { MetricStripItem } from "@/components/touchline";
import { liveMatchIdentity } from "../shared/match-identity-fixture";

/**
 * A01 — global composition, sports-first hierarchy (programme_v054 `20_UI_LAB_CANDIDATE_WAVES.md`
 * A01; XR-S02: "object-first composition, no generic nested-card dashboard"). Deterministic,
 * reuses the shared Gate A match identity fixture so the hero object is the same real match used
 * by A02, not an invented one.
 */
export const heroMatchPresentation = liveMatchIdentity;

/** A short, real metric cluster — one coherent question ("how is the squad looking right now?"),
 * not individual stat cards. */
export const squadMetrics: MetricStripItem[] = [
  { id: "available", label: "Available", value: "13", tone: "accent" },
  { id: "doubtful", label: "Doubtful", value: "1", tone: "attention" },
  { id: "unavailable", label: "Unavailable", value: "2", tone: "danger" },
];

/**
 * Static, read-only lineup preview for the context-local "Lineup" quick action (PR #777
 * remediation, XR-I01: the action must stay in this match's workspace, not navigate to an
 * unrelated demonstration). No position-edit affordance — this is a preview, not an editor.
 */
export type LineupPreviewEntry = { slot: string; name: string; number: number };

export const lineupPreview: LineupPreviewEntry[] = [
  { slot: "GK", name: "Kristian", number: 1 },
  { slot: "LB", name: "Marius", number: 3 },
  { slot: "CB", name: "Lars", number: 5 },
  { slot: "CB", name: "Jonas", number: 4 },
  { slot: "RB", name: "David", number: 2 },
  { slot: "CM", name: "Elias", number: 8 },
  { slot: "CM", name: "Emil", number: 6 },
  { slot: "CM", name: "Sander", number: 10 },
  { slot: "LW", name: "Oliver", number: 11 },
  { slot: "ST", name: "Henrik", number: 9 },
  { slot: "RW", name: "Theo", number: 7 },
];
