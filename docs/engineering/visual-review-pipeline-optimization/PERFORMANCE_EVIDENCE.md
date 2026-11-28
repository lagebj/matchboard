# Performance Evidence

All numbers below are from real `gh run` data — either the baseline run measured before this
change, or real `workflow_dispatch` runs executed against this PR's own branch
(`chore/visual-review-pipeline-optimization`, commit `1274e32b1`) before merge. No number here is
estimated or extrapolated.

## Baseline (before this change)

`gh run view 46074722262` — the most recent real automatic `ui-lab-visual-review.yml` run on PR
#850's branch, 2026-11-27, before this PR's split:

| Step | Duration |
|---|---|
| Total job | 27m12s |
| Screenshot capture (109 scenarios, full registry) | 20m35s (≈76% of total) |
| B08 + Gate C + Gate D + Gate E Playwright suites (bundled in the same job) | ≈5m30s |

## After this change — real dispatched runs on this branch

### Automatic `acceptance` job (Playwright only, no capture) — run 46127943111

| Step | Duration |
|---|---|
| Total `acceptance` job | 6m58s (08:54:09–09:01:07 UTC) |
| B08 Playwright suite | 2m28s |
| Gate C Playwright suite | 1m37s |
| Gate D Playwright suite | 1m07s |
| Gate E Playwright suite | 0m29s |

Matches the baseline's bundled Playwright time (≈5m30s suites + environment setup) — unchanged
behavior, now running independently of capture.

### On-demand `capture` job, `mode: targeted`, 2 scenarios — run 46127943111 (same dispatch)

| Step | Duration |
|---|---|
| Total `capture` job | 1m42s (08:54:10–08:55:52 UTC) |
| Screenshot capture step itself | **21s** (08:55:28–08:55:49) |
| Screenshots produced | **24** (2 scenarios × 3 viewports × 2 themes × 2 states — verified by downloading the real artifact and counting files) |

`manifest.json` from this real run confirms: `captureMode: "targeted"`,
`requestedScenarios`/`resolvedScenarios` both `["gate-e-w2-e02-upcoming", "gate-e-w2-e02-completed"]`,
`workflowRunId: 46127943111`, `workflowRunAttempt: 1`, 24 capture records.

### Validation failure paths — real dispatched runs

| Scenario | Run | Result |
|---|---|---|
| `mode: targeted`, empty `scenarios` | 46126777375 | Failed at "Validate capture mode inputs," before checkout |
| `mode: full`, `confirm_full: nope` | 46127406305 | Failed at "Validate capture mode inputs," before checkout, at the same second validation ran (08:47:03) |
| `mode: targeted`, `scenarios: this-slug-does-not-exist` | 46126789665 | Validation step passed (non-empty selection); the `capture` job then failed inside the script itself with `Error: Unknown scenario id(s): this-slug-does-not-exist. Registered: <all 109 slugs>` — the sibling `acceptance` job in the same run completed successfully and unaffected |

## Jobs avoided per ordinary PR update

Before this change, every push matching the path filter ran the full ~1,700-screenshot capture.
After this change, it runs only the `acceptance` job — the `capture` job's `if:
github.event_name == 'workflow_dispatch'` means it does not run at all on a normal push. For a PR
with N pushes touching UI Lab paths during development, this eliminates N−(however many targeted/
full dispatches are actually requested) capture runs; a typical UI Lab wave with 5-10 iterative
pushes previously paid for 5-10 full captures and now pays for zero unless explicitly requested.

## What this does not claim

No fixed "percent saved per month" figure is given — GitHub Actions minutes depend on how often UI
Lab waves are actively being developed, which this document has no reliable historical query for
within the scope of this PR. The per-run numbers above are real and directly comparable; a monthly
estimate would require assuming a push frequency this document has no verified source for.
