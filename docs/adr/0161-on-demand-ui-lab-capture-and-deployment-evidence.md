# ADR-0161: On-Demand UI Lab Capture and Deployment-Based Visual Evidence

## Status

Accepted. Implements the capture-pipeline half of this decision now. Explicitly defers (plan
only, no execution) the question of whether `visual-review-deploy.yml`/`visual-authority-gate.yml`
should eventually be consolidated into the `acceptance`-label pipeline — see "Deferred: governance
consolidation" below.

## Date

2026-11-28

## Context

`.github/workflows/ui-lab-visual-review.yml`'s `capture` job ran automatically on every `pull_request`
event touching a path-filtered set (`src/app/dev/ui-lab/**`, Touchline/match-detail components, the
capture script itself). Measured on the most recent real run at the time of this ADR
(`gh run view 46074722262`, PR #850's branch, 2026-11-27):

| Measurement | Observed |
|---|---|
| Total job duration | 27m12s |
| Screenshot-capture step | 20m35s (≈76% of total) |
| Scenarios registered in `scripts/ui-lab-visual-review.mjs` | 109 |
| Approximate screenshots produced | ~1,700 (109 scenarios × viewport/theme/interaction combinations; not independently recounted to an exact figure) |
| B08 + Gate C + Gate D + Gate E Playwright suites (combined) | ≈5m30s |

None of this workflow's jobs are in ruleset `21317362`'s required status checks (verified via
`gh api repos/lagebj/matchboard/rulesets/21317362`) — only `Visual Authority Gate`
(`visual-authority-gate.yml`, a separate workflow) is required. So the capture job's cost is pure
CI-minutes overhead with no merge-gating role: every ordinary push to a UI-Lab-touching PR pays a
~20-minute, ~1,700-screenshot capture run even when the change touches one or two scenarios, and a
purely prose/doc follow-up commit inside the same PR pays it again.

`archive-evidence.mjs` (ADR-0159's 2026-11-09 follow-up) already tolerates a missing capture run —
"No successful `ui-lab-visual-review.yml` run found ... archival deferred (not a failure: approval
remains valid regardless)" — so approval validity was already decoupled from capture availability
before this ADR. What this ADR adds on that front is making the *reason* for a missing capture
explicit (a real deployment review, versus genuinely no evidence at all) rather than leaving every
no-capture case looking identical in the archive log.

Separately, `test-acceptance.yml` (ADR-0153) already provides a full deploy-and-functionally-test
pipeline via the `acceptance` PR label, including real Vercel/Neon provisioning and Playwright E2E
— a path the original design brief for this change was not aware existed. `visual-review-deploy.yml`
+ `visual-authority-gate.yml` (ADR-0159) remain a second, lighter, comment-triggered path with their
own Test-slot lease, fingerprinting, and the one genuinely required check in this family. This ADR
does not merge or remove either path — see "Deferred" below.

## Decision

### 1. Capture is no longer automatic; Playwright acceptance suites are

`ui-lab-visual-review.yml` is split into two jobs:

- **`acceptance`** (name: "UI Lab acceptance (Playwright, no capture)") — runs on the *same*
  `pull_request` path filter as before, plus `workflow_dispatch`. Starts the local fixture server
  and runs the B08/Gate C/Gate D/Gate E Playwright suites only. No screenshot capture, no capture
  artifact upload. This is "Technical acceptance" (per the brief's three-concern split) and keeps
  running automatically because these are real regression-catching browser tests, not expensive
  visual evidence generation.
- **`capture`** (name: "Capture fixture-backed UI Lab views (on-demand)") — `workflow_dispatch`
  only. Takes two inputs:
  - `mode`: `targeted` (default) or `full`.
  - `scenarios`: comma-separated scenario slugs, required when `mode: targeted`.
  - `confirm_full`: must equal the literal string `FULL CAPTURE` when `mode: full`, so an empty or
    accidental full-mode dispatch cannot silently run the entire registry.

  A validation step rejects an empty targeted selection, an unconfirmed full request, or an
  unrecognized `mode` before Chromium is ever installed. Unknown scenario slugs are rejected by the
  capture script itself (see below) — the job fails rather than silently running zero or all
  scenarios.

No ruleset change was required: neither job in this workflow was ever a required check.

### 2. Scenario selection in the capture script

`scripts/ui-lab-visual-review.mjs` is unchanged in every scenario definition, interaction handler,
viewport, and manifest field it already had. A new, separately unit-tested module,
`scripts/ui-lab-visual-review/select-scenarios.mjs`, adds:

- `parseCaptureArgs(argv)` — reads `--all` or `--scenarios=<comma,list>` from `process.argv`.
  Invoked with neither flag (the script's original contract, unchanged, for ad-hoc local runs)
  behaves exactly as before: capture everything. `--all` and `--scenarios=` together, an empty
  `--scenarios=` list, or a duplicate slug all throw before any browser launches.
- `resolveSelectedScenarios(allScenarios, parsed)` — validates every requested slug against the
  real registered set (unknown slugs throw, never silently fall back to "capture everything" or
  "capture nothing and report success"), and returns the selected scenarios **in their original
  registration order**, never requested-argument order.

The main script filters its existing `scenarios` array through this module once, then runs its
existing capture loop over the filtered list unchanged. The coverage-completeness check (which
already existed to catch a registered-but-never-captured scenario) now checks completeness against
the *selected* set, not the full registry — selecting three scenarios and getting exactly three
captures is success, not a coverage gap.

`manifest.json` gains: `captureMode`, `requestedScenarios`, `resolvedScenarios`,
`workflowRunId`/`workflowRunAttempt` (from `GITHUB_RUN_ID`/`GITHUB_RUN_ATTEMPT` when present). Every
existing field (`sourceCommitSha`, `environment`, `knownLimitations`, `approvalStatus`, `captures`)
is unchanged — this is purely additive, so `capture-attestation.json`/candidate-manifest consumers
that only read the existing fields are unaffected.

### 3. Deployment-reviewed evidence, derived from the existing comment ledger — no new storage

`archive-evidence.mjs` already never lets missing capture evidence affect an approval's validity.
This ADR adds one concrete capability on top of that existing safety: when no successful capture
run exists for the approved revision, the archive job now checks the PR's own comment thread (the
same thread ADR-0159 already treats as the sole approval ledger) for a real
`visual-review-deploy.yml`-posted "Deployed PR #<n> (`<sha>`) to the Test slot" comment matching the
approved revision. If found, it archives a notes-only GitHub Release (same tagging convention,
`evidenceType: DEPLOYMENT_REVIEW`, no screenshot assets, linking the deployment comment) instead of
silently logging "deferred." If neither a capture run nor a deployment comment exists, the archive
log says so explicitly (`NO_EVIDENCE_RECORDED`) — the limitation is recorded, never hidden, and
still never affects the already-recorded approval.

This derives the evidence type from facts already recorded on the PR (a real deployment comment, a
real successful capture run) rather than asking a reviewer to pick a mode, and introduces no new
approval database — the PR comment thread remains the one and only approval ledger, exactly as
ADR-0159 established. `scripts/visual-authority/evidence-model.mjs` is a small, pure, unit-tested
classifier (`CAPTURE_REVIEW` / `DEPLOYMENT_REVIEW` / `NO_EVIDENCE_RECORDED`) used by
`archive-evidence.mjs`'s existing orchestration; no secrets, tokens, or session data are read or
archived by this addition.

### 4. Documentation-first alignment

`docs/development/coding-agent-working-session.md`'s "Visual Authority Gate (ADR-0159)" section
step 4 ("Let CI produce real capture evidence ... if the PR is a UI Lab candidate wave") is updated
to describe capture as optional and on-demand, requested via `workflow_dispatch` rather than implied
by touching a UI-Lab path. The approval/gate/deploy steps around it are unchanged.

## Deferred: governance consolidation (plan only, not executed)

The owner directed (amendment to the original request) that the `acceptance`-label pipeline
(ADR-0153/ADR-0075) is their actually-used deployment-and-review mechanism, and asked whether
`visual-review-deploy.yml`, the `/visual-review deploy`/`release` commands, `visual-authority-gate.yml`,
scenario fingerprinting, and screenshot-dependent approval archival can be retired in its favor.

This ADR does **not** retire any of that. `Visual Authority Gate` is a live, required,
merge-blocking check on ruleset `21317362` as of 2026-10-21 (ADR-0159, Stage B) — removing or
weakening it requires explicit owner authorization and a live ruleset change, neither of which this
PR performs. See `docs/engineering/visual-review-pipeline-optimization/MIGRATION_AND_ROLLBACK.md`
for the concrete dependency trace and recommended (not executed) consolidation path, and
`PERFORMANCE_EVIDENCE.md` for why the two mechanisms are not strictly redundant today (the
lightweight path provisions zero Neon/Cloudflare resources; the `acceptance` label path provisions a
full isolated Neon branch + Worker deploy — different cost/scope tradeoffs, not just two ways to do
the same thing).

## Consequences

- An ordinary PR commit touching UI Lab paths no longer pays a ~20-minute, ~1,700-screenshot
  capture run. The automatic `acceptance` job (Playwright suites only) still runs, at roughly the
  ≈5m30s measured above plus environment setup.
- A deliberate `workflow_dispatch` targeted capture of N scenarios captures only those N scenarios'
  full viewport/theme/interaction matrix — verified in this PR's own manual dispatch (see
  `PERFORMANCE_EVIDENCE.md`).
- A deliberate full capture remains available (`mode: full`, `confirm_full: FULL CAPTURE`) and
  retains its existing cost — this is now an explicit, infrequent operation, not a default.
- No required status check changes name, trigger, or semantics. `Visual Authority Gate` is
  untouched.
- `archive-evidence.mjs` gains a real `DEPLOYMENT_REVIEW` evidence path without adding any new
  durable storage.

## Related decisions

- ADR-0159 — Visual Authority Gate and deliberate PR review deployments; this ADR amends its
  "capture evidence" assumption in `coding-agent-working-session.md` and extends its evidence
  archival, without changing its approval model, fingerprinting, or required-check status.
- ADR-0153 / ADR-0075 — the `acceptance`-label deploy-and-test pipeline this ADR's "Deferred"
  section discusses consolidating toward, but does not touch.

## History

- 2026-11-28: Accepted and implemented (capture on-demand split, scenario selection, deployment-
  evidence derivation). Governance consolidation explicitly deferred to a migration plan document,
  pending owner authorization to change a live required ruleset check.
