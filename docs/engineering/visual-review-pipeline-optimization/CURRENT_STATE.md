# Current State (baseline, before this change)

## Workflows involved

| Workflow | Trigger (before) | Required check? | Cost profile |
|---|---|---|---|
| `ui-lab-visual-review.yml` | `pull_request` (path-filtered) + `workflow_dispatch` (already existed) | No (verified via `gh api repos/lagebj/matchboard/rulesets/21317362`) | ~27m job, ~1,700 screenshots, every matching push |
| `visual-authority-gate.yml` | `pull_request` (lifecycle) + `issue_comment` (every comment, unfiltered) | **Yes** — `Visual Authority Gate`, required since 2026-10-21 (ADR-0159 Stage B) | Cheap — status-check computation only, no deployment |
| `visual-review-deploy.yml` | `issue_comment` matching `/visual-review deploy`/`release` | No | Lightweight — Vercel API `gitSource` deploy, no Neon branch, no Worker |
| `test-acceptance.yml` | `acceptance` PR label applied / PR closed | No (but `Tests` etc. from `ci-checks.yml` are required separately) | Expensive — isolated Neon branch, full Vercel deploy, Cloudflare Worker deploy, full Playwright E2E |

The original design brief for this programme was written without knowledge that
`test-acceptance.yml` existed — it describes `visual-review-deploy.yml`'s `/visual-review deploy`
as if it were the only deployment-based review mechanism. In fact there are two, with materially
different cost/scope tradeoffs (see `PERFORMANCE_EVIDENCE.md` and `MIGRATION_AND_ROLLBACK.md`'s
dependency trace).

## Measured cost (verified, not assumed)

`gh run view 46074722262` (the most recent real `ui-lab-visual-review.yml` run on PR #850's branch,
2026-11-27, before this change):

| Step | Duration |
|---|---|
| Total job | 27m12s |
| `npm ci` + Chromium install + server start | ~1m |
| **Screenshot capture** | **20m35s (≈76% of total)** |
| B08 Playwright suite | 2m22s |
| Gate C Playwright suite | 1m33s |
| Gate D Playwright suite | 1m05s |
| Gate E Playwright suite | 0m30s |

109 scenarios are registered in `scripts/ui-lab-visual-review.mjs` at the time of this change,
producing on the order of ~1,700 screenshots per run (scenario × viewport × theme × interaction-
state combinations; not independently recounted to an exact figure for this document).

## Why repeated runs happened

`ui-lab-visual-review.yml`'s `pull_request` trigger used path filters evaluated against each push's
changed-file set. A PR that touched a UI Lab path once, then received a later documentation-only or
unrelated commit, re-triggered the full capture only if that later commit's own diff also matched a
filtered path — in practice, most UI Lab candidate PRs accumulate several commits that each touch
`src/app/dev/ui-lab/**` (fixtures, review docs co-located under `docs/ui-lab/**` are NOT in the
filter, but iteration on the candidate page itself is), so the expensive job re-ran on nearly every
push during active development of a wave.

## Corrected premise: PR #850

The original brief assumed PR #850 ("Gate E W2: Event Day progression and identity, E02") was still
open and needed careful isolation from this work. Verified via `gh pr view 850`: it merged at
`2026-11-28T08:21:02Z` as commit `4f4a6d03c`, before this branch was created from `main`. See
`PR850_HANDOFF.md` — the handoff this document set was asked to produce is moot.
