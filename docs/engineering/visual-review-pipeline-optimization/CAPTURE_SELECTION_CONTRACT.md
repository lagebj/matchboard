# Capture Selection Contract

## Workflow dispatch inputs (`ui-lab-visual-review.yml`, `capture` job)

| Input | Type | Default | Rule |
|---|---|---|---|
| `mode` | choice: `targeted`/`full` | `targeted` | Any other value fails validation before checkout |
| `scenarios` | string (comma-separated slugs) | `""` | Required (non-empty) when `mode: targeted`; ignored when `mode: full` |
| `confirm_full` | string | `""` | Must equal exactly `FULL CAPTURE` when `mode: full`; ignored when `mode: targeted` |

Validation happens in a dedicated "Validate capture mode inputs" step, before `actions/checkout`,
`npm ci`, or the Chromium install — an invalid request fails fast and cheaply.

## Script-level contract (`scripts/ui-lab-visual-review.mjs` + `scripts/ui-lab-visual-review/select-scenarios.mjs`)

- No CLI args at all → capture every registered scenario (the script's original, unchanged
  contract — preserves every existing ad-hoc/local invocation).
- `--all` → same as no args, explicit.
- `--scenarios=<slug1,slug2,...>` → capture only the listed scenarios, **in their original
  registration order** (not argument order).
- `--all` and `--scenarios=` together → throws.
- `--scenarios=` with an empty list, or any empty entry (`a,,b`) → throws.
- A duplicate slug in the list → throws, naming the duplicate.
- Any slug not present in the registered `scenarios` array → throws, naming every unknown slug and
  listing the full registered set.

Every throw happens before Chromium launches (`parseCaptureArgs`/`resolveSelectedScenarios` are
pure, called at module top-level before `chromium.launch()`). There is no code path that selects
zero scenarios and reports success — a `targeted` request always has ≥1 requested slug (validated
by `parseCaptureArgs`), and every requested slug must already be registered (validated by
`resolveSelectedScenarios`) or the whole run fails.

## Coverage-completeness check (preserved, rescoped)

The pre-existing check that a registered scenario must always produce ≥1 capture (originally added
after a scenario was registered but silently never captured) now checks against the **selected**
set, not the full registry — a targeted capture of 3 scenarios is complete once those 3 produced
captures; it is not held to the other 106 scenarios it was never asked to capture.

## Manifest additions (additive only)

`manifest.json` gains `captureMode`, `requestedScenarios`, `resolvedScenarios`, `workflowRunId`,
`workflowRunAttempt`. Every field that existed before this change (`sourceCommitSha`, `environment`,
`knownLimitations`, `approvalStatus`, `captures`) is unchanged in name, shape, or meaning — existing
consumers of `manifest.json`/`capture-attestation.json` that only read those fields are unaffected.
No schema version bump was needed because nothing existing was removed or reshaped.

## Unit tests

`scripts/ui-lab-visual-review/__tests__/select-scenarios.test.ts` — 14 cases covering: single/
multiple selection, whitespace trimming, `--all`/`--scenarios=` mutual exclusivity, empty selection,
empty-entry selection, duplicate rejection, registration-order preservation regardless of requested
order, unknown-id rejection (including "one valid + one unknown" rejecting the whole request, never
partially succeeding).
