# Gate C W1 — Visual vs Current

**Revised twice.** A first independent review found three genuine production defects
(P1-01/P1-02/P1-03); a second found that the P1-03 fix itself introduced two new
information-loss defects (P1-04/P1-05), now also corrected. The original version of this
document claimed every candidate confirms the shipped baseline with no proposed refinement —
that claim is corrected: C01 and C03 propose a real, narrow, regression-tested production
change; C02 remains a baseline confirmation, with a more rigorous identity-collision fixture
(P2-03).

## What changed in production, and why fixtures alone could not have shown it

`TodaySurface` had no single owner for several facts once a same-day Matchday object exists:

1. Whether the quiet-day calm hero should still claim "nothing needs your attention" — it
   shouldn't, when Matchday has a real action (P1-01).
2. Whether "Today in order" (other same-day football) should be visible — it should, whenever
   Matchday has a same-day match, not only on decision days (P1-02).
3. Whether the context rail should repeat organisation-wide squad availability or the quiet-day
   hero's own featured carry-forward item — it shouldn't, since those ARE the same fact shown
   twice (P1-03's correct half).
4. Whether the context rail should keep showing organisation-wide squad availability once a
   Matchday anchor exists — it should, because Matchday's own card shows a *different* fact
   (match-specific selected-squad readiness), not the same one (P1-04 — correcting an
   over-broad P1-03 condition that wrongly suppressed it).
5. Whether the context rail should keep showing the carry-forward items the quiet-day hero does
   NOT feature inline — it should, because the hero only ever features the first of up to three
   (P1-05 — correcting another over-broad P1-03 condition that discarded the rest).

These are genuine `today-surface.tsx`/`today-quiet-state.tsx`/`today-context-rail.tsx` changes —
fixtures could not fix them, because the defect was in production's own composition logic. See
`CURRENT_STATE_AUDIT.md` for the file-by-file classification and `candidate_manifest.json`'s
`baselineAssetRef` fields for which candidates now carry `PROPOSED_REFINEMENT (implemented)`
instead of `CONFIRMS_SHIPPED_BASELINE`.

## What each candidate now shows

- **C01** confirms the shipped quiet-day composition, now additionally proving: organisation-wide
  squad availability renders exactly once (P1-04); all three of its carry-forward items remain
  reachable — one featured inline, two via the context rail — rather than the 2nd/3rd being
  silently dropped (P1-05).
- **C02** confirms the shipped decision-day composition, now additionally proving (P2-03) a real
  identity collision is correctly suppressed, not merely a count cap.
- **C03** confirms the shipped Matchday pre-live composition, now additionally proving: (P1-01)
  the quiet-day hero never contradicts a real Matchday action; (P1-02) a genuinely busy same-day
  chronology stays discoverable alongside Matchday; (P1-04) organisation-wide squad availability
  (28 available) remains visible, with a scope label, alongside Matchday's own distinct
  match-specific readiness (e.g. "8 of 11 planned") — deliberately different numbers so neither
  value can mask the other; (P2-02) every readiness link has the real organisation-scoped shape
  and reaches a real, verified destination when clicked.

## Responsive behavior

Unchanged in mechanism: desktop (1440×900), mobile (390×844), narrow (320×720), plus
`gc-360`/`gc-430` smoke widths, in both dark and light. `e2e/ui-lab-gate-c.spec.ts`'s own
responsive suite independently re-verifies all eight routes at 320/360/390/430/768/1440px, plus
dedicated desktop/mobile assertions that the P1-04/P1-05-preserved information is genuinely
present in the mobile stacked reading order, not only on desktop.

## Fresh capture evidence

Per the independent review's explicit instruction, no prior revision's attestation is reused as
evidence for this changed rendering. A new `capture-attestation.json` is generated against this
remediation's own CI run — see `REVIEW_RECORD.md`.
