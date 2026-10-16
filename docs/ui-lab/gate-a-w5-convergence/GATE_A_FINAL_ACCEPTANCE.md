# Gate A — Final Acceptance Record

**Programme revision:** Matchboard Experience Convergence v0.5.4
**Gate:** Gate A (W0-W5), final closeout
**Date:** 2026-10-16
**Status:** `GATE A CLOSEOUT BLOCKED` — see "What's not done" below. Design authority is complete;
durable official publication is not.

## Owner closeout authorization

Repository owner (Lage Berger-Brendryen) authorized the full closeout sequence (PR #783 merge,
A07 revision, W4 approval processing, release-storage test, official release conditional on
acceptance) on 2026-10-16, in this conversation. This authorization covered the *workflow*; it
did not by itself constitute visual approval of any specific image. That approval was obtained
separately and explicitly: a gallery of the actual capture evidence
(https://claude.ai/artifact/Wh65CtotLK84qgtcWvDEwj) was published and shown to the owner, who
responded, verbatim: **"Approved, all of it."** That is the human decision this record relies on
for every `APPROVED_GOLDEN` status set in this closeout. No approval field in any manifest was
set without this exchange.

## Approved scenario inventory

All 38 manifest entries (39 logical scenario IDs) are `APPROVED_GOLDEN` as of this closeout.

| Wave | Families | Entries | Approved | Capture count | Revision |
|---|---|---:|---|---:|---|
| W1 | A01, A02, A06, A12 | 4 | 4 | 48 | `7dbdf85c` (2026-10-09) |
| W2 | A04 | 6 | 6 | 92 | `35a6ee48` (2026-10-10) |
| W3 | A03, A07, A09 | 15 | 15 | 442 (A03 104 + A07 280 + A09 unchanged) | A03/A09 `eea27298` (2026-10-11); **A07 revised `03a57e9b` (2026-10-16)** |
| W4 | A05, A08, A10, A11 | 13 | 13 | 252 | `03a57e9b` (2026-10-16) |
| **Total** | 12 families | **38** | **38** | **890 approved** (914 attested) | — |

`node scripts/audit-gate-a-golden-authority.mjs` against this branch: 38 manifest entries, 39
logical scenario IDs, 38 approved, 0 pending, 0 missing, 0 unexpected, **0 integrity errors**,
`goldenAuthorityComplete: true`.

## W4 approval resolution

All 13 W4 scenarios (A05 ×4, A08 ×3, A10 ×3, A11 ×3), `CANDIDATE` since the W4 merge (PR #780,
2026-10-12), are now `APPROVED_GOLDEN`:
- A05/A08/A11 (10 scenarios): approved against their original W4 capture evidence
  (`capture-attestation.json`, sourceCommitSha `82da919557d26ae6b0e8e54c67ba9d1f2e0f3135`),
  independently re-verified byte-exact against the original CI artifact this session — nothing in
  these three families changed since the W4 merge (confirmed via `git log`).
- A10 (3 scenarios): approved against **fresh** captures taken after the W5-F02 responsive fix
  changed A10's shared container component — the original W4-era captures for A10 specifically
  were stale and are not what was approved.

## A07 revision history

A07 was first approved 2026-10-11 (PR #779, revision `eea27298e3c97371245d6a2c6152b6137e194d44`,
26 captures per scenario). This closeout applies a new revision:

| Field | Prior revision | New revision |
|---|---|---|
| revisionSha | `eea27298e3c97371245d6a2c6152b6137e194d44` | `03a57e9beb7eccfd30e8aaedc766f8561ce6370a` |
| Approved | 2026-10-11 | 2026-10-16 |
| Captures/scenario | 26 | 56 |
| Change | — | W5-F01 responsive-squeeze fix (600-840px inspector layout), layout-only |

The prior revision's SHA and all 26 original capture hashes per scenario are preserved under each
scenario's `approval.supersedes` field in `candidate_manifest.json` — never deleted or silently
overwritten. Both revisions remain reconstructible: the prior from commit `eea27298e`, the new
revision's 56-capture set from the artifact cited below.

## Final fixture and capture references

- **Deterministic generation**: `docs/ui-lab/gate-a-w5-convergence/authority_inventory.csv`,
  regenerated via `node scripts/generate-gate-a-authority-inventory.mjs --write`, which refuses to
  write from semantically invalid input (verified this session: unexpected/missing scenario,
  duplicate ID, or hash-mismatched input each block generation; only this fully-approved,
  internally-consistent state generates successfully).
- **CI source for new evidence this closeout**: run `38861930463`
  (https://github.com/lagebj/matchboard/actions/runs/38861930463), artifact
  `ui-lab-review-38861930463-1` (expires 2026-10-23), synthetic merge commit
  `d246b00353d7c349af26ea58b7f1931121d0f887` of branch tip `03a57e9beb7eccfd30e8aaedc766f8561ce6370a`.
  Supplies both A07's 56-capture-per-scenario revision and A10's 3 recaptured scenarios.
- **CI source for unchanged W4 evidence**: run `38258456189`, artifact
  `ui-lab-review-38258456189-1` (expires 2026-10-19) — A05/A08/A11.
- **Source for W2/W3's unchanged evidence**: runs `38040296558` and `38122262239` respectively,
  both independently re-downloaded and byte-verified this session (not merely trusted from prior
  records).

## Independent byte verification (this session, not just the audit script's internal check)

Every one of the 890 approved capture hashes was checked against actual downloaded PNG bytes from
the CI artifacts above — not just against the committed `capture-attestation.json` records (which
the audit script checks internally). Result: **zero mismatches outside W1.**

### W1's known, disclosed gap

W1's 48 approved capture hashes (recorded 2026-10-09 against a **local** capture, never uploaded
to any CI run) do not match the bytes of any currently available CI artifact — including two
independent GitHub Actions runs this session that happened to re-capture the same W1 routes.
Pixel-level comparison confirms those CI renders are **pixel-identical** to each other but not
**byte-identical** to the locally-captured, git-recorded approved hash — consistent with a
different PNG encoder (local Playwright/Chromium vs. GitHub Actions' build) producing different
compressed bytes for visually identical content. This is not a new problem introduced by this
closeout; it is the exact gap `07_GOLDEN_AUTHORITY_STORAGE_AND_RELEASE.md` and the closeout
mandate anticipated ("investigate where the original locally captured approved PNGs are stored").
**Classification: `HASH_RECORD_PRESENT_BYTES_UNAVAILABLE`, not `VERIFIED_BYTES`.** The approval
record itself is not in question (a human did approve specific hashes on 2026-10-09); what's
unavailable is independently re-deriving those exact bytes today.

## Verification tier statement (per the closeout mandate's own required distinctions)

| Tier | Status | Evidence |
|---|---|---|
| `METADATA_VERIFIED` | ✅ Complete for all 38 scenarios | `audit-gate-a-golden-authority.mjs`: 0 issues, `goldenAuthorityComplete: true` |
| `CAPTURE_BYTES_VERIFIED` | ✅ 37/38 families (890/890 non-W1 captures); ⚠️ W1 unavailable (see above) | Independent re-download + SHA-256 recomputation, this session |
| `DURABLE_STORAGE_VERIFIED` | ✅ Mechanism tested; ❌ not yet applied to the full 38-scenario collection | Draft test release `design-ref-gate-a-storage-TEST-2026-10-16` (not public — draft), 4 assets uploaded, independently downloaded, checksums matched |
| `OWNER_APPROVED` | ✅ Complete | "Approved, all of it," 2026-10-16, against the published gallery |
| `GATE_A_COMPLETE` | ❌ **Not yet** | See below |

## Release-storage capability test (not the official collection)

A draft GitHub Release (`design-ref-gate-a-storage-TEST-2026-10-16`, not public, 4 of 38
scenarios: A04, A07, A10, A11) was created, independently downloaded, and SHA-256-verified
byte-for-byte against the upload. The D7 storage mechanism (GitHub Release assets) works as
specified. The **official** 38-scenario collection was **not** published:

1. W1's byte-unavailability (above) means an "official, all-38, byte-verified" release cannot
   honestly claim full byte verification for all 38 scenarios without disclosing that gap
   prominently.
2. Publishing a real (non-draft) release is itself a more consequential, harder-to-reverse action
   than the draft test, and deserves its own explicit go-ahead rather than being bundled into the
   broader closeout authorization.

## Complete authority-audit output

```json
{
  "expectedScenarios": {
    "totalManifestEntries": 38,
    "totalLogicalScenarioIds": 39,
    "approved": 38,
    "pending": 0,
    "missing": [],
    "unexpected": []
  },
  "approvedEntries": 38,
  "pendingEntries": 0,
  "unexpectedEntries": 0,
  "completionCriteria": {
    "allExpectedScenariosPresent": true,
    "noUnexpectedScenarios": true,
    "allApprovedGolden": true,
    "zeroIntegrityErrors": true
  },
  "goldenAuthorityComplete": true,
  "issues": []
}
```

## What's not done — remaining Gate B prerequisites (carried forward, not resolved here)

Unchanged by this closeout, still real, still deliberately out of scope:

- **A10 production structured-proposal capability** does not exist (`PlannedMatchAdvisorViewModel`
  carries free-text only; `assignPlayerToSlot` has no revision/concurrency field).
- **A11 vs. ADR-0139**: the guarded-review target conflicts with ADR-0139's accepted automatic
  primary-position promotion. Requires a deliberate ADR amendment before any real implementation.
- **A09 planned-selection quick-add** has no production equivalent; the automated RSVP-deadline
  decline policy A09-S3 illustrates does not exist in source.
- **W1's PNG byte-recoverability gap** (above) — recommend capturing a fresh, CI-sourced W1
  revision at the next convenient wave if durable, independently-reproducible bytes matter more
  than preserving the original 2026-10-09 local-capture hash record.
- **Official D7 release publication** for the full 38-scenario collection — mechanism proven,
  not yet executed for the real collection.
- Every per-family production-owner mapping in `PRODUCTION_OWNER_AND_GATE_B_HANDOFF.md` remains
  unchanged and still applies.

## Completion declaration

Per the closeout mandate's own acceptance rule: declare `GATE A COMPLETE` only if every listed
condition is true. Checking them:

- ✅ All 38 expected manifest entries have valid approved golden authority.
- ✅ All 39 logical scenario IDs accounted for.
- ✅ Visual-review and approval records complete (owner reviewed the actual gallery, explicit verbatim approval recorded).
- ✅ A07's revision resolved and traceable (prior + new revision both reconstructible).
- ✅ W4's 13 scenarios have valid exact-reference approval records.
- ⚠️ **Not fully true**: "All approved capture evidence is verified and recoverable" — true for 37/38 families; W1's bytes are verified-as-approved-at-the-time but not independently re-derivable today.
- ✅ Durable release packaging/storage/retrieval successfully tested.
- ❌ **Not true**: "The official collection is published and independently verified" — not attempted, by design, pending a separate explicit decision.
- ✅ Final audit reports zero missing/unexpected/invalid scenario records.
- ✅ All relevant technical checks pass (typecheck, lint, 270+227 tests, terminology, policy, docs, CI, Security, UI Lab Visual Review).
- ✅ No unapproved production implementation introduced.
- ✅ This record states the exact authority granted and its remaining limitations.

**Declaration: `GATE A CLOSEOUT BLOCKED`.** Design authority (approval) is genuinely complete.
Official, durable publication is the one remaining step, intentionally not taken without a
further explicit decision — see "What's not done" above.
