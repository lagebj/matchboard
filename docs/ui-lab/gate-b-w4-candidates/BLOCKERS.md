# B07 — Blockers and disclosures

## Authorization basis

Picked up directly from the Gate B W4 coding-agent mission brief (B07, Assistant Coach
longitudinal match context), which names the scenario, the required-read ADR set, and explicitly
forbids starting B08, Gate C, production migration, or owner visual approval in this PR.

## Register CSV not independently re-read this session

The original `.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/
programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` is not present in this checkout. The B07 row
is recovered verbatim from the three prior waves' own committed extracts (identical across W1/W2/
W3) instead — see `SCENARIO_REGISTER.md`.

## Local capture not attempted

`next dev` + Playwright cannot hydrate in this sandbox (HMR WebSocket upgrade fails/retries
forever) — a pre-existing, environment-specific limitation that reproduces on untouched,
already-approved earlier Gate B pages too, not something introduced by this wave. Real visual
capture comes from CI's `ui-lab-visual-review.yml` job once this PR is opened and runs, matching
every prior Gate A/B wave.

## Real CI capture — now generated and committed

`capture-attestation.json`'s first commit was a placeholder; this is the documentation-only
follow-up, the same two-commit pattern B01-B06 already established. This PR's first
`ui-lab-visual-review.yml` run (https://github.com/lagebj/matchboard/actions/runs/39848281906)
was cancelled mid-capture by the then-25-minute job timeout (see W4-R4 in
`SOURCE_RECONCILIATION.md`). After raising `timeout-minutes` to 35, the re-run
(https://github.com/lagebj/matchboard/actions/runs/39852677221, `reviewedBranchHeadSha`
`49a2b990842938788afaad26c98fa4805e7e90d4`) completed in 24m59s with all 1144 captures across 57
scenarios, including 20 for B07 (10 per scenario: desktop/mobile/narrow/gb-360/gb-430 × dark/
light). All 20 B07 screenshots were downloaded via `gh run download` and every SHA-256
independently recomputed from the raw bytes — zero mismatches against the artifact's own
self-reported `manifest.json`, no missing files. Both pages were also visually spot-checked
(desktop light for each scenario, plus mobile dark for B07-A) and render exactly as intended —
real, unmodified production Touchline components, the recurring-pattern insight and its evidence
footer on B07-A, the honest "no pattern identified" summary and factually-reported hat-trick on
B07-B, no layout breakage.

## Degraded AI state — deliberately deferred, not attempted

See `INTERACTION_AND_STATE_AUDIT.md`. Not a gap found and left unfixed — a scope decision made
up front, since B07's required contrast (meaningful cross-match pattern vs. trivial single-match
fact) doesn't need a third `unavailable`/`reviewing` variant to be legible, and the brief frames
it as optional.

## Event-origin parity — not attempted, real production constraint

Confirmed during investigation: Event has no completed-match Overview/Advisor composition at
all, and `post_match_review`'s own plan/opponent-history/recent-team-patterns sections are
League-only (tracked separately as issue #696, not introduced by this wave). B07 is built on
League fixtures only, as a consequence of real production scope, not a choice this wave made.

## `npm run build` not run locally

Reproduces pre-existing in this sandbox independent of this change (OOMs on a clean checkout of
`main` too) — not re-attempted here; relies on CI's real Build job, same as every recent Gate B
wave.
