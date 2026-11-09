# Gate C W1 — Visual vs Current

Every C01-C03 candidate renders the real, unmodified production `TodaySurface` (and
`TodayMatchday` for C03) — there is no separate "proposed" visual to compare against "current"
because this wave makes no visual change. Each candidate's `candidate_manifest.json` entry
carries `baselineAssetRef: "CONFIRMS_SHIPPED_BASELINE — ..."`, naming the real source files it
mounts, matching the precedent already established in a real, merged Gate B manifest
(`docs/ui-lab/gate-b-w3-candidates/candidate_manifest.json`, B06-LEAGUE-BEFORE/AFTER).

## What each candidate confirms, not proposes

- **C01** confirms the shipped quiet-day composition: calm hero, conditional squad readiness,
  bounded "This week" chronology, at most one carry-forward item — no decision sections render
  at all.
- **C02** confirms the shipped decision-day composition: one primary action with an inline Why?
  disclosure, at most two secondary items drawn from three real sources, no duplicate
  representation of the promoted decision.
- **C03** confirms the shipped Matchday pre-live composition across all three phase boundaries
  and both League and Event sources: a single deterministic featured match, phase-derived
  readiness copy, and exactly one primary action per phase — never a nested readiness card,
  progress ring, percentage meter, or KPI tile grid (`today-matchday.tsx`'s own doc comment
  already forbids these; this wave does not reintroduce them).

## Known visual differences from an older UI Lab demonstration (if any)

None found. No earlier Today-specific UI Lab demonstration exists in this repository to diverge
from — Gate A and Gate B covered Match Details, Post-Match Report, and Assistant Coach
longitudinal context, not Today. This is the first UI Lab wave for the Today surface.

## Responsive behavior

Captured at desktop (1440×900), mobile (390×844), narrow (320×720), plus two Gate-C-specific
smoke widths (360, 430) in both dark and light, per `scripts/ui-lab-visual-review.mjs`'s
`gcExtraSmokeViewports`. Document-level horizontal overflow is checked at every capture and is a
hard CI failure for any Gate C scenario (`isGateCRoute()` gating in that script), the same
strictness Gate B already uses. `e2e/ui-lab-gate-c.spec.ts`'s own responsive suite independently
re-verifies all eight routes at 320/360/390/430/768/1440px in a real browser.
