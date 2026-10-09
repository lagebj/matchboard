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
