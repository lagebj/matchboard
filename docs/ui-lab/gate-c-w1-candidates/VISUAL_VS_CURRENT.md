# Gate C W1 — Visual vs Current

**Revised after an independent review of PR #826 found three genuine production defects.** The
original version of this document claimed every candidate confirms the shipped baseline with no
proposed refinement. That claim is now corrected: C01 and C03 propose a real, narrow,
regression-tested production change (P1-01/P1-02/P1-03); C02 remains a baseline confirmation,
now with a more rigorous identity-collision fixture (P2-03).

## What changed in production, and why fixtures alone could not have shown it

The independent review found that `TodaySurface` previously had no single owner for three facts
once a same-day Matchday object exists:

1. Whether the quiet-day calm hero should still claim "nothing needs your attention" — it
   shouldn't, when Matchday has a real action (P1-01).
2. Whether "Today in order" (other same-day football) should be visible — it should, whenever
   Matchday has a same-day match, not only on decision days (P1-02).
3. Whether the context rail should repeat squad readiness/carry-forward the main column (or
   Matchday's own card) already shows — it shouldn't, ever (P1-03).

These are genuine `today-surface.tsx`/`today-quiet-state.tsx` changes — fixtures could not fix
them, because the defect was in production's own composition logic, not in what data the
fixture supplied. See `CURRENT_STATE_AUDIT.md` for the file-by-file classification and
`candidate_manifest.json`'s `baselineAssetRef` fields for which candidates now carry
`PROPOSED_REFINEMENT (implemented)` instead of `CONFIRMS_SHIPPED_BASELINE`.

## What each candidate now shows

- **C01** confirms the shipped quiet-day composition, now additionally proving (P1-03) that
  squad readiness and carry-forward render exactly once, not twice.
- **C02** confirms the shipped decision-day composition, now additionally proving (P2-03) a real
  identity collision is correctly suppressed, not merely a count cap.
- **C03** confirms the shipped Matchday pre-live composition, now additionally proving (P1-01)
  the quiet-day hero never contradicts a real Matchday action, (P1-02) a genuinely busy same-day
  chronology stays discoverable alongside Matchday rather than only on decision days, and (P2-02)
  every readiness link has the real organisation-scoped shape and reaches a real, verified
  destination when clicked.

## Responsive behavior

Unchanged in mechanism from the original wave: desktop (1440×900), mobile (390×844), narrow
(320×720), plus `gc-360`/`gc-430` smoke widths, in both dark and light. Document-level horizontal
overflow is a hard CI failure for any Gate C scenario. `e2e/ui-lab-gate-c.spec.ts`'s own
responsive suite independently re-verifies all eight routes at 320/360/390/430/768/1440px.

## Fresh capture evidence

Per the independent review's explicit instruction, the previous 80-capture attestation (against
the pre-remediation revision) is **not** reused as evidence for this changed rendering. A new
`capture-attestation.json` is generated against this remediation's own CI run — see
`REVIEW_RECORD.md`.
