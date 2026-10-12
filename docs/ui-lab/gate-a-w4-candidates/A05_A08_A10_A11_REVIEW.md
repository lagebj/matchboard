# Gate A W4 — A05/A08/A10/A11 Review Record

## Status: NOT SUBMITTED / PENDING

No owner review has occurred. Technical implementation, passing local tests, and `tsc`/`eslint`/
`terminology:check`/`policy:verify` success **do not themselves approve a golden** — per
`23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md`: "A passing screenshot pipeline is not approval." All 13
scenario IDs remain `CANDIDATE` in `candidate_manifest.json`.

**Capture evidence status:** real CI screenshot evidence exists for the round-2 (N1–N4, A11-F1)
remediated implementation — `capture-attestation.json` (186 captures, all 13 scenarios × 5
viewports × 2 themes + interaction states, zero console/page errors), from CI run
[`38247353225`](https://github.com/lagebj/matchboard/actions/runs/38247353225)
(`ui-lab-visual-review.yml`, against this PR's branch-tip commit
`370bcba87b455ef54a62b8acfdcc9fe08f69bb71`, synthetic merge commit
`d61c9e540a60433352061ef4dd8eeaf53990f4fc`), artifact `ui-lab-review-38247353225-1`. Every recorded
hash was independently re-verified in this session: the artifact was downloaded fresh via the
GitHub API (never `gh run download`) and all 698 files of that run (not just the 186 W4 ones) had
their SHA-256 recomputed from the raw bytes, zero mismatches; the downloaded zip's byte size also
matched the API-listed size exactly. This supersedes the round-1 evidence (CI run `38213344006`,
commit `8fa4956c7badceb4bba8fc8630e2660db787b641`), which predated round 2's visible-state changes
— see `BLOCKERS.md` W4-BLK-13. The artifact is a **temporary** GitHub Actions artifact (expires
`2026-10-19T12:19:59Z`) — no durable GitHub Release has been created (see `BLOCKERS.md` W4-BLK-06,
unchanged from every prior wave).

## What this candidate proves

| Case | Coach question | States exercised |
|---|---|---|
| A05-disabled | Does Assistant Coach off leave no reserved gap and deterministic facts untouched? | Absent, deterministic unaffected |
| A05-enabled-with-pattern | Is a valuable hypothesis conspicuous, cited, and clearly not a fact? | Hypothesis card, simulated promote/dismiss |
| A05-enabled-without-pattern | Does "ran, found nothing" read differently from "off"? | Honest quiet notice |
| A05-unavailable | Does an AI failure stay restrained, with facts intact? | Unavailable notice, deterministic unaffected |
| A08-off | Same layout, no reserved gap, as a parity structural property? | `assistant-coach-slot` absent entirely |
| A08-on-strong-pattern | Same layout, conspicuous synthesis? | `assistant-coach-slot` contains the hypothesis card |
| A08-on-no-insight | Same layout, no filler? | `assistant-coach-slot` contains only the honest notice |
| A10-review-alternative-success | Can I review an evidence-backed lineup proposal and apply it in place? | Open, evidence/rationale/limitations, diff preview, pending, `SUCCESS` |
| A10-stale-proposal-blocked | Is a stale proposal blocked before I can even try to apply it? | Inspectable, no Apply affordance, revision mismatch stated |
| A10-disabled-or-failed | Does "no proposal" stay honest and point back to manual editing? | No proposal, reachable entry point |
| A11-coach-text-and-parsed-evidence | Can I see exactly what was structured from my own note, and nothing more? | Original note + validated parsed observations |
| A11-profile-change-review-guarded | Can I review and explicitly accept a guarded profile-change proposal? | Before/after, evidence, `ACCEPTED` (simulated) |
| A11-profile-change-review-rejected | Can I reject (or defer) without any change or implicit write? | `REJECTED`/`DEFERRED` (simulated) |

## Requirement traceability

| Requirement | Source | Covered by |
|---|---|---|
| A05/A08/A10/A11 per-ID definition | `programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` rows 6, 31, 37, 38 | `CONTRACT_RECONCILIATION.md`; all 13 scenarios |
| XR-I01/XR-I02 context-local interaction | `programme_v054/17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` | Desktop inspector/mobile sheet pattern, A10; `SAME_VIEW`, A05/A08/A11 |
| Assistant Coach capability families 1-3 | `programme_v054/04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md` | A05/A08 (interpret), A10 (structured assistance), A11 (governed learning) |
| Deterministic facts survive AI state | `src/lib/matches/match-insights/get-match-insights.ts` (verified) | A05/A08, all four states |
| No AI write without coach approval | `programme_v054/01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md` D4 | A10 (Apply is coach-triggered only), A11 (Accept/Reject/Defer) |

## Owner review questions (per `18_OWNER_VISUAL_REVIEW_SHEET.md`)

1. Can I understand each Assistant Coach state without a separate AI workspace?
2. Are recorded facts, deterministic findings, and AI suggestions visually distinct in every state?
3. Do I understand evidence strength, limitations, and uncertainty before any action?
4. Can I tell exactly what a structured proposal or profile-change review would change?
5. Does the pitch (A10) remain readable on a 390px phone and at the 600/768/840px breakpoints?
6. Do unavailable, stale, and no-insight states remain useful rather than alarming?
7. Can I reject, discard, or defer without accidental changes?
8. Are pending, applied, stale, and unavailable states honest and safe?
9. Does this improve coach decisions enough to justify later production implementation, given the
   disclosed gaps in `BLOCKERS.md` (especially W4-BLK-03/04/09/10)?

## Approval fields (per scenario, to be completed only by the repository owner)

- `status`: CANDIDATE / APPROVED_GOLDEN / REVISE / REJECT — currently `CANDIDATE` for all 13.
- `approvedBy`, `approvedAt` — not set.
- `scope`: design reference ONLY, same scope boundary as every prior Gate A wave.
- Capture evidence: real CI `UI Lab Visual Review` evidence exists (`capture-attestation.json`,
  186 captures, CI run `38247353225`, post-round-2-remediation) — see "Capture evidence status"
  above. An owner approval must still cite the exact capture hashes it reviewed.

**No code merge, release, or further programme wave is implied or authorized by this candidate.**
