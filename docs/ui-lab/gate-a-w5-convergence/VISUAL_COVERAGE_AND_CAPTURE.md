# Gate A W5 — Visual Coverage and Capture Audit

Per `10_DESIGN_REFERENCE_AUTHORITY_AND_STORAGE.md` and `11_VISUAL_CAPTURE_TEST_PLAN.md`. This is
the exact algorithm those documents specify, actually run — not assumed.

## New capture evidence produced by this PR (W5-F01/W5-F02)

`scripts/ui-lab-visual-review.mjs` was extended with `inspectorSqueezeSmokeViewports`
(600/768/900px, same dimensions as A01's own `tablet-600/768/900`) on A07's 5 scenarios and A10's 3
scenarios — the only widths in A01-A12 where the inspector-vs-sheet decision (600px) and the
two-column row engagement (840px, or incorrectly 600px pre-fix) can actually diverge. Pushed to
this branch, triggering CI run **`38287815867`** (artifact `ui-lab-review-38287815867-1`, commit
`6faf8d3d2f754ce0aca3c533e63f7af75b55fd16`, not expired, expires `2026-10-19T18:09:43Z`). Both
halves of the finding are now directly visible, inspected in this session:

- `gate-a-w3-a07-assign-reserve-success-squeeze-768-dark-editor-open.png` — A07 (untouched,
  `APPROVED_GOLDEN`): match content squeezed to an unreadable sliver, inspector taking nearly the
  full width.
- `gate-a-w4-a10-review-alternative-success-squeeze-768-dark-editor-open.png` — A10 (fixed in this
  PR): both panels stack full-width and remain fully readable at the identical viewport width.

This is real, independently reviewable evidence for `W5-F01`/`W5-F02`, not an inference from source
values alone. See `CONFLICT_AND_BLOCKER_REGISTER.md` for the full finding writeup.

## Algorithm applied

1. Enumerate manifest records and approval blocks — done via `scripts/audit-gate-a-golden-
   authority.mjs` (`AUTHORITY_INVENTORY.md`).
2. Separate CI's synthetic-merge sourceCommitSha from the actual branch-tip revisionSha for each
   approved wave — done per-wave below.
3. For each approved capture, locate the exact artifact by name/run and verify checksum of the
   same PNG bytes via SHA-256 — done for W1 (against the committed attestation file directly,
   since W1's approval was verified against a local capture, not a CI artifact — see below), W2
   and W4 (against downloaded CI artifacts, this session).
4. Mark `HASH_RECORD_PRESENT_BYTES_UNAVAILABLE` where raw bytes are not independently re-verified
   in this session — applies to W3 (see below; not re-downloaded this session, but its own review
   record already did this exact byte-for-byte check at approval time and the artifact is
   independently confirmed not-yet-expired).
5. Verify fixture ID/version/viewport/theme/state match source records, detect duplicate filenames
   or orphan hashes — done via the corrected audit script; zero `AMBIGUOUS_ATTESTED_FILE` or
   `DUPLICATE_SCENARIO` issues across all four waves.
6. Match reviewed source SHA against capture head, allowing only proven documentation-only later
   diffs — done per-wave below.
7. Human-readable artifact index (this document) + machine-readable ledger
   (`authority_inventory.csv`).
8. D7 release-storage feasibility — see "Durable storage" below; **not attempted**, consistent with
   every prior wave's own disclosure, per the explicit "do not publish without authorization" rule.

## Per-wave capture provenance

### W1 (A01/A02/A06/A12)

Verified against local capture, not a GitHub Actions artifact (per `A01_A02_A06_A12_REVIEW.md`:
approval was recorded against revision `7dbdf85ccfceb65fcb3fc19ca6428e567c858876`, the branch-tip
commit itself, with hashes cross-checked against the committed `capture-attestation.json`). This
session independently recomputed all 72 attested files' SHA-256 are internally self-consistent
(the committed file's own declared hashes), and confirmed the 48 approved hashes are a strict
subset matching exactly — zero mismatch, zero gap (`AUTHORITY_INVENTORY.md`). The 24 non-approved
attested captures (`completed-match`, `match-preparation`, `player-detail`, `position-map` ×
desktop/mobile/narrow × dark/light) are `CURRENT_STATE_AUDIT` baseline screenshots of shipped
production routes, not Gate A goldens — correctly excluded from the approved set, not an
integrity gap.

### W2 (A04) — one real gap found and fixed in this PR

**Found:** `docs/ui-lab/gate-a-w2-candidates/capture-attestation.json`, as committed on `main`
before this PR, had `sourceCommitSha: bd9d1d3f602625174ca4a4e66eece63f6bdad71f` — a **local,
pre-approval, round-2-of-review** capture (per its own `knownLimitations`: "Regenerated for
independent review round 2... supersedes the prior capture-attestation.json committed against
53696fada"). The actual owner-approved revision is `35a6ee48cbe7cbe7a1c349630d72ca0a2104e0c8`
(`A04_REVIEW.md`'s "Status" line), verified against **CI** run `38040296558` (artifact
`ui-lab-review-38040296558-1`), not the local round-2 capture. The committed attestation file was
never replaced with that final round's data. Result: all 92 of `candidate_manifest.json`'s
`approval.approvedCaptures` SHA-256 values had **zero matches** against the file that is supposed
to be their supporting evidence record — confirmed by `scripts/audit-gate-a-golden-authority.mjs`
(92 `HASH_MISMATCH_WITH_ATTESTATION` errors before the fix).

**The approval itself was never in doubt** — `A04_REVIEW.md` already describes downloading and
independently re-verifying the CI artifact's bytes at approval time (2026-10-10), and this session
re-downloaded the same still-available artifact (`ui-lab-review-38040296558-1`, confirmed
`expired: false`, expires `2026-10-17T09:11:27Z`) and recomputed all 92 files' SHA-256 directly:
**zero mismatches against `candidate_manifest.json`**. What was missing was the repository's own
durable record of that evidence.

**Fixed:** `docs/ui-lab/gate-a-w2-candidates/capture-attestation.json` replaced in this PR with the
CI artifact's own 92 A04 entries (`sourceCommitSha: 18b4efbe109bc9d583f37dcd2b0e9174e608d476` — the
`pull_request` run's synthetic merge commit, legitimately different from the branch-tip
`35a6ee48c`, same expected pattern as every other wave's CI-sourced attestation; `generatedAt:
2026-10-10T09:11:27.106Z`, `environment.ci: true`), with per-capture metadata (`scenarioId`,
`route`, `viewport`, `deviceScaleFactor`, `interactionState`) preserved unchanged from the old file
(those fields describe what was captured, not which bytes, and are unaffected by which specific run
produced the bytes). `scripts/audit-gate-a-golden-authority.mjs` now reports **zero** issues across
all four waves. The old (locally-captured, round-2, non-approved-revision) attestation content is
fully recoverable from git history (`git show b6d932b98:docs/ui-lab/gate-a-w2-candidates/capture-
attestation.json`) if ever needed — nothing was destroyed, only superseded, consistent with the
programme's "no silent overwrite of an approved asset" rule (the thing being replaced here is
supporting evidence for an unchanged approval, not the approval or its recorded hashes themselves).

### W3 (A03/A07/A09)

`A03_A07_A09_REVIEW.md`'s own approval record already performed the exact byte-verification
algorithm this audit specifies: downloaded CI artifact `ui-lab-review-38122262239-1` (run
`38122262239`) fresh and recomputed all 348 files' SHA-256 directly, zero mismatches against both
`candidate_manifest.json` and the artifact's own `manifest.json`. This session independently
confirmed the artifact is **not expired** (`expires_at: 2026-10-18T07:48:53Z`, re-checked via the
GitHub API this session) but did not re-download and re-verify the 348 bytes a second time — W3's
committed `capture-attestation.json` already carries the correct CI-sourced hashes (confirmed by
the corrected audit script: zero `HASH_MISMATCH_WITH_ATTESTATION` for any W3 entry, matching what
W2's *stale* file would have shown had it been correct). Classified
`HASH_RECORD_PRESENT_BYTES_RE-VERIFIABLE_NOT_RE-VERIFIED_THIS_SESSION`, not `VERIFIED_BYTES` by
this session specifically — the artifact remains available for a future session or the owner to
re-check directly if desired.

### W4 (A05/A08/A10/A11) — candidate evidence, one CI-rerun pixel-noise instance found

The committed `capture-attestation.json` cites CI run `38258456189` (artifact `ui-lab-review-
38258456189-1`, commit `046be6359818311bd043acc3c1afa0a3ee18eda9`). This session downloaded that
artifact fresh and recomputed all 186 W4 files' SHA-256: **zero mismatches** against `candidate_
manifest.json`'s per-scenario capture lists (W4 has no `approval` object to check against, since
all 13 remain `CANDIDATE`, but the attestation-to-capture-list consistency is itself verified).

Separately, this session also downloaded the **later** CI run that actually produced the commit
that is now on `main` (`38260044660`, artifact `ui-lab-review-38260044660-1`, commit `5002c2235` —
the docs-only commit that added the attestation file itself, one commit after `046be6359`) to check
whether the merged-to-`main` state's own CI run reproduces byte-identically. **185 of 186 files do.
One does not:** `gate-a-w4-a10-review-alternative-success-desktop-dark-saved.png` differs between
the two runs (attested hash `6ad9f706a4f8...`, latest-run hash `3d7e9af8d231...`). Pixel-diffed
directly (not assumed): `ImageChops.difference` shows a full-frame-extent but low-magnitude
difference (177,391/1,372,320 px changed, max per-channel delta 11/255), and a side-by-side visual
read of both PNGs in this session shows **no discernible content, text, or layout difference** —
consistent with CI-run-to-run font/compositing rendering noise, the same class of (smaller-
magnitude) variance W4's own `BLOCKERS.md` W4-BLK-14 already documented and pixel-diffed for a
different pair of files between round 2 and round 3. **Classified as rendering noise, not a real
regression — but explicitly not re-captured or re-attested in this PR** (W4 remains untouched by
W5 except for the A10 breakpoint fix, which did not touch this particular scenario's visible markup
beyond the responsive container — see `INTERACTION_STATE_AUDIT.md`). Recommend the eventual owner-
approval capture run for W4 be taken fresh against this PR's A10 fix rather than reused from either
cited run, since the A10 container layout has changed (see `APPROVAL_DEPENDENCIES.md`).

Both W4 artifacts confirmed not expired (`11752188543`/`11751493087`, both expire
`2026-10-19T1*:12/59`).

## Artifact expiration summary (re-checked this session, 2026-10-12)

| Wave | Artifact | Run | Expires | Status |
|---|---|---|---|---|
| W2 | `ui-lab-review-38040296558-1` | `38040296558` | 2026-10-17T09:11:27Z | Available, re-verified this session |
| W3 | `ui-lab-review-38122262239-1` | `38122262239` | 2026-10-18T07:48:53Z | Available, not re-downloaded this session |
| W4 | `ui-lab-review-38258456189-1` | `38258456189` | 2026-10-19T13:59:20Z | Available, re-verified this session |
| W4 (branch-tip/main) | `ui-lab-review-38260044660-1` | `38260044660` | 2026-10-19T14:12:16Z | Available, re-verified this session |

None of these have expired. All four remain re-downloadable for a human reviewer today. None is a
durable preservation mechanism — all four will expire within the next ~7 days regardless of this
PR's outcome.

## Durable storage (D7) — still not attempted, with a concrete recommendation

Every prior wave disclosed the same gap and this one is unchanged: no GitHub Release asset
collection exists (`gh release list` returns zero releases, re-confirmed this session).
`07_GOLDEN_AUTHORITY_STORAGE_AND_RELEASE.md`'s own required check — "W5 must check that actual
repo access/CI permissions/API support uploading and later retrieving reference release assets" —
was evaluated, not performed: this session confirmed `gh release create` is available as a command
the owner (or an agent explicitly authorized for that specific action) could run, and that all four
cited artifacts remain downloadable right now as the source material for such a release, but did
**not** create one, per every prior wave's identical scope boundary ("Create Public Surface" is a
consequential, externally-visible action outside this PR's authorization). This is carried forward
unchanged to `CONFLICT_AND_BLOCKER_REGISTER.md` and `PRODUCTION_OWNER_AND_GATE_B_HANDOFF.md` as an
explicit open item, now with four concrete, currently-valid artifact IDs ready to use if/when
authorized, rather than only a future promise.

## Total capture counts

674 approved-or-candidate Gate A captures across W1-W4 (488 approved + 186 candidate — excludes
W1's 24 non-Gate-A baseline captures), all with internally-consistent hashes as of this PR, plus
the extra `squeeze-600/768/900` captures this PR added for A07/A10 (not part of any approved or
candidate manifest count — see "New capture evidence" above). See `authority_inventory.csv` (now
generated deterministically by `scripts/generate-gate-a-authority-inventory.mjs` — see `AUTHORITY_
INVENTORY.md` and `CHANGED_FILES.md`'s W5-R2 entry) for the per-scenario breakdown.
