# Target Architecture

This change implements ADR-0161. See that ADR for the authoritative decision record; this document
summarizes the resulting shape for engineering reference.

## Three separated concerns

### A. Technical acceptance (automatic)

- `ci-checks.yml`, `security.yml` — unchanged, not touched by this PR.
- `ui-lab-visual-review.yml`'s new `acceptance` job — runs automatically on the same path filter
  `ui-lab-visual-review.yml` already used, plus `workflow_dispatch`. Starts the local fixture
  server and runs the B08/Gate C/Gate D/Gate E Playwright suites. No screenshot capture.

### B. Human visual acceptance (on explicit request)

Two mechanisms exist and both remain available, unmerged, per the owner's amendment:

- **`acceptance` PR label** (`test-acceptance.yml`, ADR-0153/ADR-0075) — the owner's actual default
  today. Full isolated Neon branch + Vercel deploy + Cloudflare Worker deploy + Playwright E2E.
  Unchanged by this PR.
- **`/visual-review deploy`** (`visual-review-deploy.yml` + `visual-authority-gate.yml`, ADR-0159)
  — the lighter, comment-triggered path with its own Test-slot lease and the one required check in
  this family (`Visual Authority Gate`). Unchanged by this PR except for the evidence-archival
  extension described in `VISUAL_EVIDENCE_MODEL.md`.

No screenshot generation is required for either path — both already let a human look at the real
deployed UI Lab (or the real app, for the `acceptance` label path) directly in a browser.

### C. Visual regression evidence (on demand)

`ui-lab-visual-review.yml`'s `capture` job — `workflow_dispatch` only, `mode: targeted` (default,
requires `scenarios`) or `mode: full` (requires `confirm_full: FULL CAPTURE`). See
`CAPTURE_SELECTION_CONTRACT.md`.

## What this PR does not do

- Does not merge `visual-review-deploy.yml`/`visual-authority-gate.yml` into `test-acceptance.yml`,
  or remove either mechanism. `Visual Authority Gate` is a live required check; removing it requires
  explicit owner authorization and a live ruleset change, neither performed here. See
  `MIGRATION_AND_ROLLBACK.md` for the (unexecuted) consolidation analysis the owner asked for.
- Does not change `test-acceptance.yml`, `ci-checks.yml`, `security.yml`, or any Prisma/auth/
  tenancy code.
- Does not change any live GitHub ruleset.
