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

## Real CI capture — not yet generated at the time of this commit

`capture-attestation.json` in this directory is a placeholder (`approvalStatus: "CANDIDATE"`, no
`captures`) committed alongside the candidate code so the directory's required document set is
complete from the first commit. The real attestation — downloaded from the CI run, every
SHA-256 independently recomputed from the raw bytes — is committed in a documentation-only
follow-up commit after this PR's own `ui-lab-visual-review.yml` run completes, the same
two-commit pattern B01-B06 already established. Real screenshots have not been generated or
claimed at the time of this commit; no hash below this point is invented.

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
