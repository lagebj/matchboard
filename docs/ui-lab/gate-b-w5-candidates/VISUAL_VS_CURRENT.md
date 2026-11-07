# Gate B W5 — Visual vs. Current Production (B08)

Real browser screenshot evidence for B08 comes from this PR's own CI run of the "UI Lab Visual
Review" GitHub Actions workflow (`scripts/ui-lab-visual-review.mjs`, 5 new scenario entries
registered this wave — `candidate_manifest.json`/`capture-attestation.json`), **not from this local
session**. Local `next dev` + Playwright cannot hydrate pages in this devcontainer (a known,
pre-existing environment constraint: the HMR WebSocket upgrade fails/retries forever, reproducing
even on untouched pages — not something this wave introduced). `capture-attestation.json` now holds
the real attestation from that CI run (workflow run 42412296463) — 72 screenshots, all independently
re-hashed from the downloaded artifact with zero mismatches against its own manifest.json, replacing
the earlier placeholder in a documentation-only follow-up commit (see `BLOCKERS.md`).

## The one intentional visual difference from live production — do not mistake for a capture bug

`after/page.tsx`'s bottom-row "Post-match report" widget is **deliberately lighter** than today's
live production `AfterMatchOverview`: it shows a status pill plus a single link only, where
production's own current widget additionally repeats the team-reflection status and a
"Continue/View" CTA that the dedicated "After match" tab already owns in full (the verified,
field-by-field duplication finding in `INFORMATION_OWNERSHIP_MATRIX.md` §3). This is a **candidate
composition correction**, not a production change — nothing in `main`'s own `AfterMatchOverview` was
touched. A reviewer comparing a B08-AFTER screenshot against today's real Match Details AFTER page
should expect this one widget to look different and smaller; every other panel on the page (Match
story, Key figures, coaching-intent review, Assistant Coach, final lineup) is the real, unmodified
production composition and should look identical.

## Everything else on all five pages is the real production composition

No other panel, tab, or widget across BEFORE/LIVE/AFTER/REPORT-DRAFT/REPORT-COMPLETED was
redesigned for this wave — see `SOURCE_RECONCILIATION.md` for the full reuse-vs-substitute ledger by
page. Any other visual difference a reviewer notices against live production is either a genuine
fixture-data difference (this is a synthetic match, not a real one) or a defect to report, not an
intended design change.

## Capture matrix as registered — matches the 72 real captures produced

| Scenario | Standard viewports × themes | Extra widths | Interaction states |
|---|---|---|---|
| B08-BEFORE | 320/390/1440 × dark/light (6) | 360/430 (+4) | — |
| B08-LIVE | 320/390/1440 × dark/light (6) | 360/430 (+4) | — |
| B08-AFTER | 320/390/1440 × dark/light (6) | 360/430/600/768/900 (+10) | — |
| B08-REPORT-DRAFT | 320/390/1440 × dark/light (6) | 360/430/600/768/900 (+10) | `resolved-completion-transition` (desktop+mobile × 2 themes) |
| B08-REPORT-COMPLETED | 320/390/1440 × dark/light (6) | 360/430/600/768/900 (+10) | — |

AFTER and both Report pages get the wider 600/768/900px smoke set (the same tab-rail/dense-layout
squeeze range Gate A's A01/A04 rounds already proved matters) since they carry a real tab rail;
BEFORE/LIVE do not.

Per spec §16's own guidance, the `?tab=review`-becomes-invalid-after-lock behavior and the pinned
`?tab=players` behavior are **not** registered as separate browser-capture scenarios — both are
already proven at the component-test level against the real resolver/reducer functions
(`INTERACTION_AND_STATE_AUDIT.md`), and mechanically adding a capture for an already-proven
equivalent is explicitly discouraged by the brief.

## Capture success is not visual approval

As with every prior Gate B wave: a clean CI capture run proves the pages render and the registered
interactions complete without throwing — it is not an owner review and carries no approval weight.
`official_golden_status` stays `NOT_READY` and `approval` stays `null` regardless of capture outcome
(`REVIEW_RECORD.md`, `candidate_manifest.json`).
