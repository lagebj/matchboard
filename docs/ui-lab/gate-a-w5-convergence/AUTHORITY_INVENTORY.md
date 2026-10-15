# Gate A W5 — Authority Inventory

Machine-readable form: `authority_inventory.csv` (38 rows, one per manifest entry), generated
deterministically by `node scripts/generate-gate-a-authority-inventory.mjs --write` directly from
the four committed `candidate_manifest.json`/`capture-attestation.json` pairs — never hand-edited.
Running the generator twice against unchanged inputs produces byte-identical output (verified this
session). Not copied from the handoff bundle's `reference/candidate_inventory.csv` snapshot, though
that snapshot was diffed against this table and matches it exactly on IDs/fixture versions/capture
counts for W1-W4.

**Independent technical review correction (W5-R2):** an earlier version of this document reported
**494** approved captures. That number was wrong — it was manually typed rather than derived, and
double-counted part of W1's non-approved baseline captures. The correct total, computed from the
manifests themselves (`sum(approval.approvedCaptures.length)` across all 25 `APPROVED_GOLDEN`
entries), is **488**. See the regenerated table below and `CHANGED_FILES.md`.

## How this was generated

`node scripts/generate-gate-a-authority-inventory.mjs --write` (reads via the shared
`scripts/lib/gate-a-authority.mjs` loader; see `CHANGED_FILES.md` for why this is now a separate
generation tool from `audit-gate-a-golden-authority.mjs`'s read-only integrity check). Its
per-file hash check was independently cross-verified against the actual CI artifacts for W2 and W4
(downloaded and recomputed from raw bytes, not trusted from the script alone — see `VISUAL_
COVERAGE_AND_CAPTURE.md`).

## Summary

| Wave | Families | Manifest entries | Logical scenario IDs | Status | Approved captures | Attested captures | Owner approval |
|---|---|---:|---:|---|---:|---:|---|
| W1 | A01, A02, A06, A12 | 4 | 4 | 4 `APPROVED_GOLDEN` | 48 | 72 (24 extra are `CURRENT_STATE_AUDIT` baseline captures of shipped `completed-match`/`match-preparation`/`player-detail`/`position-map`, not Gate A goldens — see `VISUAL_COVERAGE_AND_CAPTURE.md`) | 2026-10-09, Lage Berger-Brendryen |
| W2 | A04 | 6 | 6 | 6 `APPROVED_GOLDEN` | 92 | 92 (1:1 after this PR's attestation-file fix — was 0:92 before, see `VISUAL_COVERAGE_AND_CAPTURE.md`) | 2026-10-10, Lage Berger-Brendryen |
| W3 | A03, A07, A09 | 15 | 16 (A07-S1/A07-S2 share one manifest entry) | 15 `APPROVED_GOLDEN` | 348 | 348 | 2026-10-11, Lage Berger-Brendryen |
| W4 | A05, A08, A10, A11 | 13 | 13 | 13 `CANDIDATE` | 0 | 186 (candidate evidence only) | **Not recorded** — see `APPROVAL_DEPENDENCIES.md` |
| **Total** | 12 families (A01-A12) | **38** | **39** | **25 `APPROVED_GOLDEN`, 13 `CANDIDATE`** | **488** | **698** | 25/38 approved |

These two columns are **different evidence categories and must not be summed together**:
"Approved captures" (488) counts only screenshots a manifest's `approval.approvedCaptures` array
names as part of a human-approved golden. "Attested captures" (698) counts every screenshot any
wave's `capture-attestation.json` records, approved or not (candidate evidence, superseded
captures, and W1's non-Gate-A baseline routes all count here too). A capture can be attested
without being approved; it cannot be approved without also being attested (enforced by this
script's `APPROVED_FILE_NOT_IN_ATT` check, now an error — see below).

This matches the W4 handoff bundle's own verified-at-creation snapshot (`03_MERGED_BASELINE_AND_
APPROVAL_INVENTORY.md`) on manifest-entry and logical-ID counts. **`goldenAuthorityComplete:
false`** — W4 blocks C6 (see `APPROVAL_DEPENDENCIES.md`).

## Evidence-level classification (per `21_FIXTURE_CAPTURE_AND_AUTHORITY.md`'s vocabulary)

| Level | Applies to |
|---|---|
| `DIRECTIONAL_STUDY` | The six `F1`-`F6` standalone HTML studies under `programme_v054/directional_studies_not_goldens/` — inputs only, never cited as output authority by any wave |
| `CURRENT_COMPONENT_BASELINE` | W1's 24 extra attested-but-unapproved captures (`completed-match`, `match-preparation`, `player-detail`, `position-map`) |
| `CANDIDATE_GOLDEN` | All 13 W4 entries |
| `APPROVED_GOLDEN` | All 25 W1-W3 entries |
| `VERIFIED_IMPLEMENTATION` | **None exist.** No Gate A candidate has been adopted into a production route; this level requires a Gate B authorization this PR does not grant |

## Golden-authority completion semantics (W5-R1)

`node scripts/audit-gate-a-golden-authority.mjs` no longer defines completion as "zero `CANDIDATE`
entries and zero errors" — that formula could report completion with every candidate `REJECT`ed, a
scenario silently absent from a manifest, or an approved capture missing from its own attestation
(previously a `WARNING`). Completion is now a **positive requirement**, checked against an explicit
39-entry/38-ID expected-scenario registry (`scripts/lib/gate-a-authority.mjs`'s
`EXPECTED_SCENARIOS`, cross-checked against the programme register in `SOURCE_RECONCILIATION.md`):

1. Every expected scenario ID is present in its wave's manifest (`MISSING_EXPECTED_SCENARIO` is now
   an error, not silent omission).
2. Every expected scenario's `status` is `APPROVED_GOLDEN` — `CANDIDATE`, `REVISE`, `REJECT`, and
   any unrecognized status all correctly prevent completion (an unrecognized status is now an
   error, not a harmless warning).
3. Every `APPROVED_GOLDEN` entry has complete, valid `approval` metadata (reviewer, date, a 40-hex
   git revision SHA, at least one approved capture).
4. Every approved entry has at least one capture for each of `desktop`/`mobile` (`MISSING_
   REQUIRED_VIEWPORT`) and both `dark`/`light` for every `(viewport, interactionState)` combination
   it does capture (`MISSING_THEME_PAIR`) — both newly-added structural checks, verified against
   the real repository data in this session with zero false positives.
5. Every approved screenshot reference exists in the wave's own attestation file (`APPROVED_
   FILE_NOT_IN_ATT`, **now an error**, was a warning).
6. Every referenced screenshot's SHA-256 matches the attestation's recorded value for that file.
7. No duplicate or empty scenario identifiers exist.

Current result against this branch: `goldenAuthorityComplete: false` (13 W4 scenarios are
`CANDIDATE`), with **zero** integrity issues of any severity — the metadata itself is fully
consistent; only governance (W4's outstanding owner decision) is incomplete. See `scripts/__tests__/
audit-gate-a-golden-authority.test.ts` for the negative-test matrix proving each of the above
actually blocks completion, and `CHANGED_FILES.md` for the full command output.

**What a clean, complete result would and would not mean**, per the script's own `scopeDisclaimer`
output field (kept machine-readable, not just prose, so a consumer can't miss it): a passing
metadata audit never independently verifies raw PNG bytes beyond the committed attestation's own
recorded hash, never confirms durable off-git storage exists, never confirms a reviewer's visual
judgement was sound beyond a recorded `approvedBy`/`approvedAt`, and never authorizes production
implementation.

## Per-scenario detail

See `authority_inventory.csv`. Columns: `wave, scenarioId, fixtureId, fixtureVersion, status,
approvedBy, approvedAt, baseCommitSha, approvalRevisionSha, captureSourceCommitSha,
reviewedBranchHeadSha, approvedCaptureCount, approvedHashesMatchAttestation,
attestationGeneratedAt`.

**Provenance fields corrected (W5-R2):** an earlier version of this CSV used one overloaded
`revisionSha` column that, for W4, held the historical pre-candidate base commit
(`1a2b5095ead2568aef2a7a505a15409b588107ac`) in a column readers could mistake for an approval
revision — W4 has never had one. The schema now separates four distinct identities:

| Field | Meaning | W1-W3 (approved) | W4 (candidate) |
|---|---|---|---|
| `baseCommitSha` | The manifest's own recorded branch baseline (`candidate_manifest.json`'s top-level `baseCommitSha`) | Populated | Populated (`1a2b5095e...`) — informational only, **not** an approval |
| `approvalRevisionSha` | The actual owner-approved code revision (`approval.revisionSha`) | Populated, 40-hex git SHA | **Empty** — no approval exists |
| `captureSourceCommitSha` | The revision the capture evidence represents (`capture-attestation.json`'s `sourceCommitSha`) — often a `pull_request` run's synthetic merge commit, legitimately different from the branch tip | Populated | Populated |
| `reviewedBranchHeadSha` | The actual branch head at the capture point, where the attestation separately records it | Not recorded by W1-W3's attestation schema (empty) | Populated (`046be6359...`) |

`approvedHashesMatchAttestation` is `true` for all 25 approved entries as of this PR (was `false`
for all 6 W2 entries before the attestation-file correction — see `VISUAL_COVERAGE_AND_CAPTURE.md`)
and blank for all 13 W4 `CANDIDATE` entries (no `approval` object exists to check against; a
`CANDIDATE` entry carrying approval fields would itself be flagged as `CANDIDATE_HAS_APPROVAL_
FIELDS`, and none do).

## Diff against the W5 bundle's `reference/candidate_inventory.csv` snapshot

No discrepancies in scenario IDs, fixture IDs, fixture versions, or capture counts. The snapshot
predates this PR's W2 attestation-file fix (it could not have recorded that gap, since it only
tracks counts, not per-file hash identity) and predates the A10 breakpoint fix (fixture version
unchanged by that fix — it is a layout-only change, not a fixture/data change, so no version bump
was warranted; see `INTERACTION_STATE_AUDIT.md`).
