# Gate D W2 — Blockers

## Resolved before implementation

- **D06's missing XR citation** (`SOURCE_RECONCILIATION.md`) — not a blocker: documented as a
  genuine source inconsistency and resolved by treating the register row as authoritative,
  consistent with Wave 1's own precedent for the same class of cross-reference gap.
- **ADR-0157's own text not previously re-read** (Wave 1's disclosed gap) — closed this wave; read
  in full, knowledge hierarchy confirmed to match ADR-0155's own description.

## Production capability gaps — disclosed, filed, not fixed in this wave

Both are genuine missing capabilities (not competing implementations), filed as GitHub issues per
`docs/agents/issue-and-arr-workflow.md`'s three-way test, rather than fixed inline — both require
a production domain-type/contract change out of this wave's UI-Lab-only scope (mission §16):

- **[#845](https://github.com/lagebj/matchboard/issues/845)** — `EvidenceRef` has no navigable
  source-detail capability; D06's "source-linked story" acceptance question is unsatisfied in
  production today. This wave's `EvidenceSourceInspector` is a disclosed directional UI Lab
  answer, not a fix.
- **[#846](https://github.com/lagebj/matchboard/issues/846)** — Player Detail's Development tab
  collapses AI-off / no-hypothesis / provider-not-ready into identical silence (an empty
  `hypotheses` array renders nothing). Corrects Wave 1's own `CURRENT_STATE_AUDIT.md`, which had
  incorrectly attributed a different surface's real OFF/EMPTY/ERROR/STALE states to this one.

## Local verification limitation (pre-existing, not introduced by this wave)

Per existing project memory and Wave 1's own precedent: `next dev` + Playwright cannot hydrate
reliably inside this devcontainer (the HMR WebSocket upgrade fails/retries forever,
reproducing on untouched Wave 1 pages too — not specific to this wave's new routes). This wave's
new Vitest component tests (both `vitest.config.components.ts` and default config) were run and
pass locally; the new `e2e/ui-lab-gate-d.spec.ts` additions were **not** executed locally for
this reason and will be validated by CI's real `ui-lab-visual-review.yml`/`ci-checks.yml` runs —
see `REVIEW_RECORD.md` for what this means for this wave's final disposition.

## No authority conflicts found

No conflict between this wave's scope and any accepted ADR. ADR-0160's mutation-approval
machinery is not triggered by any D03/D06 fixture (neither register row's acceptance question
asks for a position/attribute proposal); where a fixture cites position evidence, it uses the
real `collapseTacticalToProfile()` mapping correctly (verified by test) rather than conflicting
with ADR-0160 §6.

## No unresolved source requirements beyond the disclosed D06 XR gap above

All nine mandatory source files from the mission brief's §2 were recovered and read (see
`SOURCE_RECONCILIATION.md`'s verification list). Nothing required for this wave's scope was
unreadable.
