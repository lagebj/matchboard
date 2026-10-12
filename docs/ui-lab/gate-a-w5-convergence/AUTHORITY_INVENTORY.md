# Gate A W5 — Authority Inventory

Machine-readable form: `authority_inventory.csv` (38 rows, one per manifest entry, regenerated
directly from the four committed `candidate_manifest.json`/`capture-attestation.json` pairs on
this branch — not copied from the handoff bundle's `reference/candidate_inventory.csv` snapshot,
though that snapshot was diffed against this table and matches it exactly on IDs/fixture
versions/capture counts for W1-W4; the one real discrepancy it could not have caught is the W2
attestation-provenance gap below, since it only records approved counts, not hash identity).

## How this was generated

`scripts/audit-gate-a-golden-authority.mjs` (new in this PR — see `AUTOMATED_VALIDATION_AND_
REGRESSION.md` for why it exists and what it fixes over the handoff bundle's Python original) was
run against this branch, then its per-file hash check was independently cross-verified against the
actual CI artifacts for W2 and W4 (downloaded and recomputed from raw bytes, not trusted from the
script alone — see `VISUAL_COVERAGE_AND_CAPTURE.md`).

## Summary

| Wave | Families | Manifest entries | Logical scenario IDs | Status | Approved/attested captures | Owner approval |
|---|---|---:|---:|---|---:|---|
| W1 | A01, A02, A06, A12 | 4 | 4 | 4 `APPROVED_GOLDEN` | 48 approved (72 attested; 24 extra are `CURRENT_STATE_AUDIT` baseline captures of shipped `completed-match`/`match-preparation`/`player-detail`/`position-map`, not Gate A goldens — see `VISUAL_COVERAGE_AND_CAPTURE.md`) | 2026-10-09, Lage Berger-Brendryen |
| W2 | A04 | 6 | 6 | 6 `APPROVED_GOLDEN` | 92 approved, 92 attested (now 1:1 after this PR's attestation-file fix — was 0:92 before, see `VISUAL_COVERAGE_AND_CAPTURE.md`) | 2026-10-10, Lage Berger-Brendryen |
| W3 | A03, A07, A09 | 15 | 16 (A07-S1/A07-S2 share one manifest entry) | 15 `APPROVED_GOLDEN` | 348 approved, 348 attested | 2026-10-11, Lage Berger-Brendryen |
| W4 | A05, A08, A10, A11 | 13 | 13 | 13 `CANDIDATE` | 0 approved; 186 attested (candidate evidence only) | **Not recorded** — see `APPROVAL_DEPENDENCIES.md` |
| **Total** | 12 families (A01-A12) | **38** | **39** | **25 `APPROVED_GOLDEN`, 13 `CANDIDATE`** | 494 approved, 698 total attested across all four waves' own files | 25/38 approved |

This matches the W4 handoff bundle's own verified-at-creation snapshot (`03_MERGED_BASELINE_AND_
APPROVAL_INVENTORY.md`) exactly on every count. **`goldenAuthorityComplete: false`** — W4 blocks
C6 (see `AUTHORITY_INVENTORY.md`'s sibling `APPROVAL_DEPENDENCIES.md`).

## Evidence-level classification (per `21_FIXTURE_CAPTURE_AND_AUTHORITY.md`'s vocabulary)

| Level | Applies to |
|---|---|
| `DIRECTIONAL_STUDY` | The six `F1`-`F6` standalone HTML studies under `programme_v054/directional_studies_not_goldens/` — inputs only, never cited as output authority by any wave |
| `CURRENT_COMPONENT_BASELINE` | W1's 24 extra attested-but-unapproved captures (`completed-match`, `match-preparation`, `player-detail`, `position-map`) |
| `CANDIDATE_GOLDEN` | All 13 W4 entries |
| `APPROVED_GOLDEN` | All 25 W1-W3 entries |
| `VERIFIED_IMPLEMENTATION` | **None exist.** No Gate A candidate has been adopted into a production route; this level requires a Gate B authorization this PR does not grant |

## Per-scenario detail

See `authority_inventory.csv`. Columns: `wave, scenarioId, fixtureId, fixtureVersion, status,
approvedBy, approvedAt, revisionSha, approvedCaptureCount, approvedHashesMatchAttestation,
attestationSourceCommitSha, attestationGeneratedAt`.

`approvedHashesMatchAttestation` is `True` for all 25 approved entries as of this PR (was `False`
for all 6 W2 entries before the attestation-file correction in this PR — see `VISUAL_COVERAGE_
AND_CAPTURE.md`). `n/a` for all 13 W4 `CANDIDATE` entries (no `approval` object exists to check;
this is correct per `audit_gate_a.py`'s/this PR's script's own rule that a `CANDIDATE` entry
carrying approval fields would itself be an error — none do).

## Diff against the W5 bundle's `reference/candidate_inventory.csv` snapshot

No discrepancies in scenario IDs, fixture IDs, fixture versions, or capture counts. The snapshot
predates this PR's W2 attestation-file fix (it could not have recorded that gap, since it only
tracks counts, not per-file hash identity) and predates the A10 breakpoint fix (fixture version
unchanged by that fix — it is a layout-only change, not a fixture/data change, so no version bump
was warranted; see `INTERACTION_STATE_AUDIT.md`).
