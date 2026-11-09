# ADR-0159: Visual Authority Gate and Deliberate PR Review Deployments

## Status

Accepted. Stage A (this ADR, the applicability/decision-logic scripts, the two new workflows,
Test-slot lease wiring, documentation updates) implemented. **Stage B is also now active**:
`Visual Authority Gate` was added to ruleset `21317362`'s required status checks on 2026-10-21, at
the repository owner's explicit direction, once PR #802 corrected the two Stage A bugs described
in that ADR's History (the `neutral`-conclusion bug and the approval-record fingerprint
self-invalidation bug) that would otherwise have made Stage B's enforcement ineffective. See
"Rollout" below. **A 2026-11-09 follow-up (see History) generalized the comment-ledger model to be
scenario-scoped and confirmed it already works, unmodified, after a PR merges.**

## Date

2026-10-20

## Context

UI Lab candidate work (Gate A, Gate B) has no GitHub-enforced visual-review gate. "Golden"
approval today is a manually-authored block in each wave's `candidate_manifest.json`, written at
the repository owner's explicit direction once they had reviewed real CI-captured screenshots —
there is no automated check tying a PR's merge-eligibility to that review actually having
happened, and editing `candidate_manifest.json` by hand carries exactly the same weight whether a
real review occurred or not. Separately, there is no low-cost way to see a PR's actual rendered UI
live without invoking the full `acceptance` label path (`docs/adr/0075-...md`,
`docs/adr/0153-...md`) — an isolated Neon branch, a Cloudflare Worker deploy, and a full Playwright
suite, all for the sole purpose of a human looking at a screen.

ADR-0153's cost-containment goal — an ordinary push to an open PR must provision zero Vercel/Neon
resources — is the primary invariant this ADR must not violate while closing the gap above.

## Decision

### Applicability classifier

`scripts/visual-authority/classify.mjs` (pure, unit-tested) decides, from a PR's changed-file
list, whether anything could invalidate a UI Lab candidate's captured presentation: paths under
`src/app/dev/ui-lab/`, the shared Touchline/match-detail/match-insights component directories UI
Lab candidates compose, `scripts/ui-lab-visual-review.mjs` itself, or a `candidate_manifest.json`/
`capture-attestation.json` under `docs/ui-lab/`. Prose documentation on its own (`BLOCKERS.md`,
`SOURCE_RECONCILIATION.md`, etc.) is not applicable by itself. **Fails closed**: if the workflow
cannot retrieve the complete changed-file inventory (pagination failure, API error), the
classifier is told so explicitly and always returns `applicable: true` regardless of what partial
path data it has.

A separate, stricter function, `classifyLightweightDeployEligibility()`, answers a different
question for the lightweight deploy workflow only: is this PR's diff narrow enough (no Prisma
schema/migrations, no auth/middleware code, no Worker code, no workflow files, nothing
secret/env-shaped) to deploy without the full `acceptance` path's protections.

### The PR's own comment thread is the approval ledger — no separate storage

`scripts/visual-authority/evaluate-gate.mjs` re-derives the approval state fresh, every time the
gate runs, from the PR's own comment history (`scripts/visual-authority/parse-comment.mjs` parses
each comment for `/visual-approve <sha>` / `/visual-reject <sha>`, optionally scoped to specific
scenarios) filtered to comments from an actor who, **at evaluation time**
(`scripts/visual-authority/check-actor-permission.mjs`, re-checked every run, never cached),
genuinely has write/maintain/admin access to this repository. The last privileged
approve-or-reject command wins. There is no separate "is this approved" database to go stale or
drift from reality — the comment thread already is GitHub's own durable, auditable record, exactly
matching "preserve the historical decision record."

An approval is valid for the exact approved commit SHA, **or** for any later commit whose
visual-content fingerprint (`scripts/visual-authority/fingerprint.mjs` — a sha256 over the sorted
content of every fixture/page/capture-script-entry/`candidate_manifest.json`, deliberately
excluding prose docs and the derived `capture-attestation.json`) matches the fingerprint at the
approved SHA. This is what lets a documentation-only follow-up commit keep an existing approval,
while any substantive change to rendered content, fixture data, or interaction behavior correctly
invalidates it.

Each candidate's own `approval` block within `candidate_manifest.json` is excluded from that
file's contribution to the fingerprint (corrected in History below; the original Stage A text
said the opposite). The `approval` block is a *record* of a decision already made on the comment
thread, not a new decision — hashing it created a self-invalidation loop: `promote-to-golden.mjs`
writing the approval metadata into the manifest as a follow-up commit would change the manifest's
fingerprint, making that very commit look like it carried a *different* visual-content fingerprint
than the one just approved, falsely reporting `INVALID` for the commit that exists solely to
record the approval. Every other field in the manifest (`status`, `fixtureVersion`,
`componentOwners`, `knownGaps`, etc.) still counts toward the fingerprint as before.

### `Visual Authority Gate` status check

`.github/workflows/visual-authority-gate.yml` runs on every PR to `main` (`opened`, `reopened`,
`synchronize`) and on every PR comment event (`created`, `edited`, `deleted`) — not gated by any
workflow-level path filter, per the PR #675 lesson recorded in ADR-0075's History: a path-filtered
workflow with required-named jobs can leave those jobs permanently "expected" the moment a ruleset
requires them, with no path to resolution short of removing the rule. A `resolve-pr` job always
runs first and computes whether the event is even PR-shaped; the `gate` job (`needs: resolve-pr`,
`if: always()`) always reports a real Checks-API conclusion against the **exact PR head SHA** —
`NOT_APPLICABLE` (success), `APPROVED` (success), `AWAITING_APPROVAL` (failure), or `INVALID`
(failure) — never leaves the check pending indefinitely. `AWAITING_APPROVAL` reports `failure`,
not `neutral`: GitHub's required-status-checks merge gate treats a `neutral` conclusion as
passing (identically to `success`/`skipped` — see `required-checks.mjs`'s own
`evaluateRequiredChecks`), so a `neutral` conclusion here would let an unreviewed PR merge the
instant Stage B makes this check required — exactly the outcome this gate exists to prevent. This
correction (found before Stage B, so it never had a live blocking effect) is recorded in History
below.

This workflow never runs `actions/checkout` against PR content at all — every file it needs to
read (to compute a fingerprint at a given SHA) is read via the GitHub Contents API, specifically
to avoid the exact class of bug ARR-0024 already found once in this repository (`actions/checkout`
defaulting to a detached `refs/pull/<PR>/merge` ref when no explicit `ref:` is given).

### Lightweight, comment-triggered Test deployment

`.github/workflows/visual-review-deploy.yml` triggers only on `issue_comment: created` matching
`/visual-review deploy` or `/visual-review release` — never on PR open/push. For a deploy request:
verifies the commenter's permission; refuses outright if the PR's head repository isn't this same
repository (no fork deploys on this path); verifies the ruleset's required checks are already
green for the exact head SHA, **excluding `Visual Authority Gate` itself** (`required-checks.mjs`'s
`excludeContexts` parameter — added when Stage B made that check required; without the exclusion,
a UI-Lab PR's deploy request would require an approval that itself typically depends on the owner
seeing this very deploy first, a circularity found and fixed the first time Stage B and this
lightweight-deploy path were exercised together on a real UI-Lab PR, see History); runs the
stricter eligibility classifier; joins the existing `test-slot` concurrency group (shared with
`test-acceptance.yml`/`test-db-migrate.yml`, so it can never race either); checks the
`TEST_SLOT_LEASE` repository variable for a conflicting active lease from a different PR; if
clear, runs `scripts/visual-authority/deploy-pr-revision.sh <sha>`.

**This workflow never checks out the PR's own code** — found and fixed during this PR's own
review, not assumed safe: an earlier draft did check out the PR's resolved head SHA (explicitly,
never a default event-derived ref, per ARR-0024) before running `vercel deploy` from that
directory, mirroring `scripts/test-acceptance/deploy-test-baseline.sh`'s pattern. CodeQL's
`actions/untrusted-checkout` query correctly flagged this as **critical**: unlike
`deploy-test-baseline.sh` (which only ever checks out `main`, trusted content), this workflow is
triggered by `issue_comment` and would have been checking out PR-controlled content with Vercel
secrets in scope. `deploy-pr-revision.sh` instead creates the deployment via Vercel's REST API
`gitSource` mechanism (`POST /v13/deployments` with `gitSource: {type: "github", ref: <sha>, org,
repo}`) — Vercel's own infrastructure fetches the exact commit directly from GitHub and builds it
remotely, polls until `readyState` is `READY`, then aliases via `POST /v2/deployments/{id}/aliases`.
The privileged runner never has the PR's own files on disk at all. **No** Neon branch, no
migration, no Worker deploy, no Playwright suite.
A release request, or PR close, or `test-db-migrate.yml`'s own baseline redeploy, clears the lease
and restores the baseline alias via the existing `restore-baseline-alias.sh`, unchanged.

### Golden-record promotion

`scripts/visual-authority/promote-to-golden.mjs` writes the **exact existing** `approval` schema
already established by Gate A — quoted verbatim from
`docs/ui-lab/gate-a-w1-candidates/candidate_manifest.json`:

```json
"approval": {
  "state": "APPROVED",
  "scope": "APPROVED_GOLDEN — design reference only; NOT production implementation authorization",
  "approvedAt": "2026-10-09",
  "approvedBy": "Lage Berger-Brendryen",
  "revisionSha": "7dbdf85ccfceb65fcb3fc19ca6428e567c858876",
  "releaseTag": null,
  "releaseStatus": "PENDING — ...",
  "approvedCaptures": [
    { "viewport": "desktop", "theme": "dark", "interactionState": "initial", "file": "...", "sha256": "..." }
  ]
}
```

into the relevant candidate entry — `approvedBy` from the real verified GitHub actor,
`revisionSha`/`approvedCaptures` from the capture-attestation already on that revision. This
script exists and is available to invoke, but **is not wired to auto-run inside
`visual-authority-gate.yml` in this PR** — an explicit scope reduction (see "Rollout").

### Self-approval / credential-indistinguishability limitation

**This mechanism's trust model has a boundary that must be stated plainly, not assumed away.** A
coding agent operating in this repository, in the course of implementing or testing this very
capability, typically holds the repository owner's own GitHub credential (a personal access token
or an authenticated `gh` CLI session) rather than a separately-scoped bot/app identity. On every
GitHub-reachable approval signal this ADR defines — a structured PR comment, in principle even a
native PR review or an environment-deployment approval click — there is no cryptographic way to
distinguish "the human owner typed this" from "an agent holding the owner's own token typed this."

What this mechanism **does** defend against: a different contributor, a compromised or
misbehaving external process, or a buggy automation forging an approval it has no right to grant
— `check-actor-permission.mjs`'s real-time collaborator-permission check is a real, meaningful
boundary against exactly that class of actor.

What it **cannot** defend against: the specific agent session that already holds the repository
owner's own credential deciding, on its own initiative, to post the approval comment itself. No
design choice available within GitHub's own primitives closes that gap, because the gap is a
property of credential sharing, not of this mechanism's design.

The mitigation is therefore a **behavioral rule, not a technical control**: any coding agent
operating in this repository must never itself post a `/visual-approve` or `/visual-reject`
comment, click a deployment-review approval, or otherwise perform the approval half of this loop
on the owner's behalf — under any task framing, including a request to demonstrate or fully test
the approval flow end-to-end. Only the owner's own separate, real-time action does that. The
comment thread's audit trail (timestamped, attributed, append-only, visible to every future
reader) is what makes a violation of this rule detectable after the fact, even though it cannot be
prevented by the gate itself.

## Consequences

- Cost containment is preserved exactly: both new workflows trigger only on explicit PR comments
  (or ordinary PR lifecycle events that cost nothing — status-check computation, not deployment),
  reuse the existing `test-slot` concurrency group and the existing `test` Custom Environment, and
  provision zero new Neon or Cloudflare resources.
- Reuses, rather than duplicates, Gate A's established `approval` schema — a future durable
  GitHub Release storage strategy (ADR-0159's own `releaseStatus` field, same as Gate A's) is
  unaffected by this change.
- Adds exactly one new required-check surface (`Visual Authority Gate`) once Stage B happens; no
  existing required check's name, trigger, or semantics changes.
- A genuinely new mechanism in this repository: no prior workflow here parses PR comments as
  structured commands. Reviewed carefully for the two known failure classes this repo has already
  paid to learn (PR #675's permanently-pending required check; ARR-0024's detached-HEAD checkout)
  rather than re-discovering them.
- `scripts/visual-authority/*.mjs` are plain ESM, tested with Vitest, in a different style from
  this repository's existing bash CI scripts — a deliberate departure, not an oversight: the task
  requires deterministic unit tests for applicability/decision logic, and a bash script is not
  practically unit-testable the way these pure functions are.

## Rollout

### Stage A (this PR)

Implement everything above. The `Visual Authority Gate` check reports real statuses on real PRs
but is **not** added to ruleset `21317362`'s required checks — it cannot block any merge yet.

**Bootstrap note**: both new workflows deliberately check out their trusted decision logic from
the PR's *base* ref (`main`), never the PR's own ref — see the security rationale in both workflow
files' header comments. That means **this governance PR's own gate run cannot produce a real
verdict**: `main` does not contain `scripts/visual-authority/` until this PR merges, so the
checkout finds nothing and the evaluation step fails with a module-not-found error. That failure is
expected, harmless (Stage A is not yet a required check), and is not a sign the mechanism is
broken — it is the direct, correct consequence of refusing to trust a PR's own copy of its own
gatekeeping code. Real Stage A observation (an ordinary PR reporting `NOT_APPLICABLE`, a UI-Lab PR
reporting `AWAITING_APPROVAL`, a real `/visual-approve` resolving it, `/visual-review deploy`
behaving correctly) only becomes possible once this PR is merged, and must be performed against a
*subsequent* PR, not this one. Verify, before considering Stage A complete:

- An ordinary PR (no UI-Lab-relevant files touched) reports `NOT_APPLICABLE`.
- A PR touching a UI Lab candidate reports `AWAITING_APPROVAL` until a real approval comment
  (posted by the repository owner, not by any agent session) resolves it.
- `/visual-review deploy` on an eligible PR deploys and aliases correctly, with zero Neon/
  Cloudflare resources provisioned; an ineligible PR's request is refused with a clear reason.
- `/visual-review release`, PR close, and a baseline redeploy all correctly clear the
  `TEST_SLOT_LEASE` and restore the baseline alias.

### Stage B — performed 2026-10-21

Performed at the repository owner's explicit direction, after PR #802 fixed the two Stage A bugs
that would otherwise have made this enforcement step ineffective (see History):

```
gh api --method PUT repos/lagebj/matchboard/rulesets/21317362 --input - <<'JSON'
{ ...existing ruleset body (read fresh immediately before the call, per the original
  plan below), with "Visual Authority Gate" appended to required_status_checks... }
JSON
```

Confirmed via the PUT response's `updated_at` timestamp (`2026-10-21T10:34:34.264Z`) and a
before/after diff of `required_status_checks` showing exactly one addition — every other rule
(deletion/non-fast-forward/linear-history/pull-request parameters, and all 12 pre-existing required
checks) was read fresh from the live ruleset immediately before the call and left byte-identical,
per the original plan below. `Visual Authority Gate` is now a required check on every PR to `main`:
`NOT_APPLICABLE`/`APPROVED` (`success`) merge normally; `AWAITING_APPROVAL`/`INVALID` (`failure`,
since PR #802) block merge until a real `/visual-approve <sha>` resolves it.

Original plan (preserved for the record): only after Stage A's observation period was explicitly
confirmed sufficient, read the ruleset fresh immediately before the call (ruleset contents can
change between Stage A landing and Stage B being authorized) and perform the PUT as a live,
repository-wide, merge-blocking change — never as a side effect of implementing Stage A itself.

### Deferred, explicitly not in this PR

- Auto-wiring `promote-to-golden.mjs` into `visual-authority-gate.yml` so an `APPROVED` resolution
  automatically writes the golden record. The script exists and is manually invokable; wiring it
  in is a follow-up, kept separate to keep this already-large PR reviewable.
- A durable (non-7-day-expiring) storage strategy for capture attestations — unchanged from Gate
  A's own still-`PENDING` `releaseStatus` state.

## Related decisions

- ADR-0075 — the original per-PR acceptance pipeline this gate deliberately does not duplicate or
  replace; its concurrency design and incident history are the foundation this ADR builds on.
- ADR-0153 — the single-Vercel-project, label-gated acceptance architecture; this ADR's
  lightweight deploy reuses its `test` Custom Environment and `deploy-test-baseline.sh` pattern
  without altering anything ADR-0153 established.
- `docs/ui-lab/gate-a-w1-candidates/candidate_manifest.json` and the Gate A/B UI Lab wave
  convention generally (no single ADR governs the UI Lab candidate/golden workflow itself; its
  conventions live in the `docs/ui-lab/**` doc sets this ADR's classifier and golden-promotion
  script both read and write).

## History

- 2026-10-20: Accepted. Stage A implemented: classifier/fingerprint/comment-parsing/permission
  decision logic (53 unit tests), the two new workflows, Test-slot lease wiring into the existing
  lifecycle hooks, documentation updates. Stage B (ruleset enforcement) deliberately not performed
  in this PR — see "Rollout."
- 2026-10-21: Two corrections found and fixed while preparing Stage B, before the check was ever
  added to ruleset `21317362`'s required checks (so neither had a live blocking effect):
  1. `evaluate-gate.mjs`'s `AWAITING_APPROVAL` state reported Checks-API conclusion `neutral`,
     which GitHub's required-status-checks merge gate treats as passing — identically to
     `success`/`skipped`. Left uncorrected, adding this check to the ruleset would not have
     actually blocked merging an unreviewed UI-Lab PR. Changed to `failure`. `NOT_APPLICABLE` and
     `APPROVED` remain `success`; `INVALID` was already `failure`.
  2. `fingerprint.mjs` hashed each candidate's `approval` block as part of
     `candidate_manifest.json`'s contribution to the fingerprint, as this ADR's original text
     said was intentional. In practice this created a self-invalidation loop: writing a granted
     approval's metadata into the manifest (`promote-to-golden.mjs`) changes the manifest's
     fingerprint, which would make the very commit that records an approval look `INVALID`
     against that same approval. The `approval` block is now excluded from the hash; every other
     field is unaffected.

  Reviewed the existing Gate B W1 (B01–B04) approval records
  (`docs/ui-lab/gate-b-w1-candidates/candidate_manifest.json`) against both fixes: those
  approvals were recorded directly in the merged PR rather than via a `promote-to-golden.mjs`
  follow-up commit, so neither bug had actually corrupted them — left unchanged, no new approval
  decision invented.

  Verified ruleset `21317362`'s live required-status-checks list (read via
  `gh api repos/lagebj/matchboard/rulesets/21317362`) still does not include `Visual Authority
  Gate` — Stage B remains a distinct, later, owner-authorized action; this correction does not
  perform it.
- 2026-10-21 (continued): PR #802 merged. The repository owner then explicitly directed Stage B
  to be performed. Ruleset `21317362` updated (`gh api --method PUT`) to add `Visual Authority
  Gate` to `required_status_checks`, read fresh immediately before the call and diffed to confirm
  only that one addition. `Visual Authority Gate` is now a required, merge-blocking check on every
  PR to `main` — see "Rollout" → "Stage B — performed 2026-10-21" for the verification detail.
- 2026-10-21 (continued): the first real interaction between Stage B and the lightweight deploy
  path, on a real UI-Lab PR (#805, Gate B B05), surfaced a genuine circularity: the repository
  owner requested `/visual-review deploy`, and it was declined because `Visual Authority Gate`
  itself — now a required check — was `failure`/`AWAITING_APPROVAL`. But that check can only turn
  green via a real `/visual-approve`, and the owner's own stated reason for wanting the deploy was
  to see the live render *before* deciding whether to approve — the deploy path had become
  unusable for exactly the PRs it exists to serve, while remaining fully usable for ordinary PRs
  (whose gate is `NOT_APPLICABLE`/success regardless). Fixed by adding an `excludeContexts`
  parameter to `required-checks.mjs`'s `requiredChecksGreen()`, and having
  `run-deploy-request.mjs` pass `excludeContexts: ["Visual Authority Gate"]` — every other
  required check (Lint, Tests, Build, security scans, etc.) still gates the deploy; only the one
  check whose own resolution the deploy is meant to inform is excluded. New tests cover both the
  exclusion itself and that it never excuses a different, genuinely failing required check. See
  `scripts/visual-authority/__tests__/required-checks.test.ts`.
- 2026-11-09: Follow-up generalizing the comment-ledger model from PR-level to scenario-level, and
  confirming (rather than building from scratch) that it already works after a PR merges.
  Motivated by a concrete, confirmed instance of the exact anti-pattern this ADR's "comment thread
  is the ledger" principle was meant to prevent: PR #807 ("record real Visual Authority Gate
  approval for Gate B W2") was a second PR whose only purpose was writing `promote-to-golden.mjs`'s
  output into a manifest, for an approval (on PR #805) that was already fully valid without it.
  Re-running the resolver (read-only) against PRs #808 and #811 found the same gap already present
  but unrecorded: both carry real `lagebj` `/visual-approve <sha>` comments with a
  `success`/"Visually approved" check-run at the time, yet `gate-b-w3-candidates/` and
  `gate-b-w4-candidates/candidate_manifest.json` still said `approval: null` — exactly this ADR's
  own warning ("a missing manifest approval block is not itself evidence of no approval") being
  true in practice, not just in principle.
  - `scripts/visual-authority/resolve-approval.mjs` (new): generalizes `evaluate-gate.mjs`'s
    PR-level decision to per-scenario, reusing each candidate's existing `componentOwners` for
    scope resolution — an unscoped `/visual-approve` command covers every scenario whose
    `componentOwners` the PR's diff actually touches (falling back to every scenario in the
    registry only if none do, never to none), while `scenarios: B01, B04` scopes a command
    explicitly. Each scenario's approve/reject timeline is independent — a rejection of one never
    touches another's state. `evaluate-gate.mjs`'s old whole-PR `evaluateGate()` is retired in
    favor of `evaluateGateFromScenarios()`, which aggregates the per-scenario map into the gate's
    one Checks-API conclusion: `APPROVED` only once every applicable scenario is, one
    `REJECTED`/`STALE` scenario (or a reference to an unknown scenario ID) fails the whole PR
    closed, otherwise `AWAITING_APPROVAL` — this is what makes partial approval across scenarios in
    one PR behave correctly, which the old PR-level-only core had no way to express.
  - `scripts/visual-authority/visual-authority-config.mjs` (new): a narrower allowlist
    (`visual-authority.config.json`, currently `["lagebj"]`) on top of the existing real-time
    `hasWriteAccess` check — approval now requires both, closing the gap where any repository
    writer, not just the actual repository owner, could grant golden-reference approval.
  - `scripts/visual-authority/revision.mjs` (new): validates that an approved/rejected SHA is
    structurally part of the PR — its head, one of its own commits, its real post-merge commit, or
    a GitHub-generated `refs/pull/<n>/merge` preview commit (identified by the PR's head SHA being
    one of ITS parents, since that ref stops resolving once the PR merges but the commit object
    remains fetchable by SHA) — rather than relying on fingerprint coincidence alone. Found live,
    not hypothetically: PR #822's own real approval comment referenced exactly this kind of
    preview commit, and the first version of this validation incorrectly rejected it before the
    parent-SHA check was added.
  - `scripts/visual-authority/status-report.mjs` (new, `npm run visual-authority:status -- --gate
    <A|B> [--format table|json]`): read-only, cross-PR status reporting, reusing
    `resolve-approval.mjs` directly rather than a second approval algorithm. Resolves each
    scenario's introducing PR from a new `sourcePr` field on the candidate (candidate-origin
    metadata, backfilled from each manifest's own real `git log --diff-filter=A` history, never
    guessed — a scenario with no verified `sourcePr` reports `UNVERIFIABLE`, never a guessed
    state), bounding every lookup to one API call per distinct introducing PR rather than an
    unbounded repository-wide scan. Known limitation: this only evaluates a scenario against its
    own introducing PR's comment thread, not every later PR that may have touched a dependency it
    shares with other scenarios — a genuinely later re-approval on a different PR is not yet
    picked up by this report (the live gate itself has no such limitation, since it always
    evaluates the current PR's own full comment thread).
  - `scripts/visual-authority/archive-evidence.mjs` + `evidence-tag.mjs` (new): a new
    `archive-evidence` job in `visual-authority-gate.yml`, `needs: gate`, running only once the
    gate job itself already reported `APPROVED`, with its own narrowly-scoped `contents: write`
    (granted nowhere else in this workflow). Downloads the relevant `ui-lab-visual-review.yml`
    run's capture evidence via `gh run download`, verifies every screenshot's sha256 against
    `capture-attestation.json`, then creates (or idempotently reuses) a GitHub Release tagged
    deterministically from the scenario ID and approved revision. Archival failure is reported but
    never affects the already-recorded approval — this closes this ADR's previously-deferred
    "durable (non-7-day-expiring) storage strategy for capture attestations."
  - Confirmed, not assumed: existing Gate A approvals and Gate B W1's (B01-B04, recorded directly
    in their merged PRs rather than via a `promote-to-golden.mjs` follow-up) remain valid and
    unaffected under every change above. No approval was invented for B06/B07/B08 — their real,
    already-existing PR comments are what the resolver now recognizes; where no valid comment
    exists for a scenario, the gate and status report both still correctly report
    `AWAITING_APPROVAL`/`UNVERIFIABLE`, never a fabricated approval.
  - `promote-to-golden.mjs` is retained, unchanged, as an optional historical-materialization tool
    only — never required to merge, and never auto-wired into the gate (unchanged from this ADR's
    original "Deferred" scope decision; auto-promotion was considered and rejected again here, for
    the same reason: the manifest's `approval` block is a record of a decision, and this ADR's
    resolver is now the authoritative place to read that decision from, not the manifest).
