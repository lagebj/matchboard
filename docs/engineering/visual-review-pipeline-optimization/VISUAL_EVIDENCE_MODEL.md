# Visual Evidence Model

## Before this change

`archive-evidence.mjs` (ADR-0159, 2026-11-09 follow-up) already never let missing capture evidence
affect an approval's validity — verified by reading the script before changing it: a missing
`ui-lab-visual-review.yml` run logged "archival deferred (not a failure: approval remains valid
regardless)" and returned cleanly. What was missing was any positive record of *why* evidence was
missing, or any attempt to recognize a deployment-based review (the far more common review path,
per the owner's amendment) as a distinct, legitimate evidence type.

## After this change

`scripts/visual-authority/evidence-model.mjs` (new, pure, unit-tested) classifies, per approved
scenario, into exactly one of:

- **`CAPTURE_REVIEW`** — a successful `ui-lab-visual-review.yml` run exists for the approved
  revision. Behavior unchanged from before this PR: screenshots are downloaded, sha256-verified
  against `capture-attestation.json`, and archived as a GitHub Release.
- **`DEPLOYMENT_REVIEW`** — no capture run exists, but the PR's own comment thread contains a real
  `visual-review-deploy.yml`-posted "Deployed PR #<n> (\`<sha>\`) to the Test slot" comment matching
  the approved revision (matched by exact string pattern, including SHA-prefix tolerance — see
  `findDeploymentCommentForRevision`). Archived as a notes-only GitHub Release: same tagging
  convention as `CAPTURE_REVIEW`, zero screenshot assets, notes stating plainly that this was a
  deployment review with no capture.
- **`NO_EVIDENCE_RECORDED`** — neither exists. Logged explicitly as such. The approval remains
  fully valid regardless (unchanged from before this PR) — this case is about honest archival
  logging, not approval gating.

## Derivation, not reviewer choice

The brief asked to "avoid requiring the reviewer to select an evidence mode if the system can
derive it reliably from recorded deployment and capture facts." This implementation derives the
type entirely from two already-recorded facts (a successful workflow run; a real PR comment posted
by a privileged workflow) — no reviewer input, no new field for a human to fill in.

## No new approval database

The PR comment thread remains the sole approval ledger (ADR-0159, unchanged). This evidence model
only decides what gets *archived* once an approval already exists via that ledger — it never
participates in the approve/reject decision itself. `archive-evidence.mjs`'s job in
`visual-authority-gate.yml` still runs with `needs: gate` and `if: needs.gate.outputs.conclusion ==
'success' && needs.gate.outputs.state == 'APPROVED'`, unchanged.

## Historical evidence compatibility

Every existing archived `CAPTURE_REVIEW` release (from before this PR) is unaffected — the tagging
convention (`evidence-tag.mjs`) is unchanged, and `releaseExists()`'s idempotency check still finds
them and skips re-archival. No historic manifest or attestation was rewritten.
