# Gate E W1 — Independent Review Record

A fresh, context-independent review (no memory of this implementation session) was commissioned
after implementation, per the mission brief §13. It checked the official register, the actual
code/test diffs, and real GitHub Actions evidence directly — not this document set's own claims.

## Review round 1

**Checklist (18 items):**

1. Scenario IDs exist in register — no issue. Verified directly against the CSV; E01's acceptance
   question text matches verbatim.
2. No invented scenario — no issue. All 8 register rows accounted for in `WAVE_SCOPE.md`.
3. Wave boundary coherent/documented — no issue. The register-order/adjacency rule is applied
   consistently; E01 standing alone is defensible.
4. Production owners reused, not reimplemented — **MAJOR**. `buildLeagueOperatingViewModel()`/
   `LeagueSurface` were confirmed byte-identical to `main` via `git diff`, but the header area in
   `league-fixture-mount.tsx` was a hand-rolled `<h1>`/layout, not the real `TouchlinePageHeader`/
   `TouchlineButton` production uses — a real, undisclosed divergence (production renders the
   title at 28/32px; the candidate rendered it at 20px with different layout classes).
5. Navigation respects the four-item architecture — no issue.
6. Selected-context links work or limitation disclosed — no issue. ARR-0035 claim verified true
   against the actual ARR file.
7. Factual claims backed by source data — no issue beyond #4.
8. Counts/units/rates/periods valid — no issue; independently re-run tests confirm fixture/
   view-model agreement.
9. Empty/incomplete/unknown states distinct — no issue.
10. N/A — no coach-assessment-vs-fact claim in E01.
11. N/A — no AI/Assistant Coach surface in E01.
12. Domain rules preserved — no issue; zero production code changed.
13. N/A — no simulated mutation in this wave.
14. Responsive and keyboard interactions verified — **MINOR**. Responsive coverage is real
    (overflow assertions + 6 mobile/narrow captures); no test exercises keyboard-only interaction
    (no `page.keyboard.press`, no focus-order assertion). Low risk given only native
    `<select>`/`<button>`/`<a>` elements are involved, but "verified" overclaimed this specific
    dimension.
15. Screenshots match implementation revision — no issue. Independently re-downloaded the CI
    artifact and spot-checked 4 of 12 hashes directly; all matched.
16. No earlier golden changed without authority — no issue; E01 has no prior approved state.
17. Docs don't overclaim — **MAJOR** (same finding as #4 — `VISUAL_VS_CURRENT.md`'s "does not...
    diverge from production behaviour in any way" was false given the header substitution) plus
    **MINOR**: `BLOCKERS.md`/`capture-attestation.json` reference this very `REVIEW_RECORD.md`
    before it existed — an intentional forward-reference (consistent with the Gate B/C/D
    precedent of writing this file only once the review it describes has actually happened), but
    confusing if read out of order; `CHANGED_FILES.md` already discloses the ordering correctly.
18. Source/test coverage adequate — no issue. Re-ran both test configs directly: 12/12 node,
    11/11 component, matching the claimed coverage.

**Summary:** 0 BLOCKING, 2 MAJOR, 2 MINOR.

## Remediation (same PR)

- **MAJOR #4/#17 (header divergence):** fixed — `league-fixture-mount.tsx` now imports and renders
  the real `TouchlinePageHeader`/`TouchlineButton`, exactly matching `fixtures-page.tsx`'s own
  composition (including the real "Create match" navigation link, which is a plain link, not a
  mutation, and was therefore safe to keep — only "Generate all draft squads", a real Server
  Action, remains omitted). All local tests (lint, typecheck, node + component suites) re-verified
  green after the fix. See `BLOCKERS.md` BLK-E01-05 and the git history for the exact commit.
- **MINOR (keyboard coverage):** not added in this wave — recorded as a disclosed, non-blocking
  limitation. `LeagueSeasonRail`'s own keyboard handling is real, unmodified production code
  already covered by its own component-level expectations elsewhere in the codebase; this wave
  does not introduce a new interactive primitive that would need its own keyboard test.
- **MINOR (dangling reference):** left as-is — the ordering is intentional and already correctly
  disclosed in `CHANGED_FILES.md`; this record now exists, resolving the dangling reference for
  any future reader.

## Review round 2 (external review, after round 1's remediation had already landed)

A further review — external to this implementation session, not a self-review — re-examined the
already-fixed PR and found six additional findings round 1's reviewer had missed, all independently
re-verified against the actual fixture dates, rendered layout, and documentation in this session
before any change was made (exact computed dates via Node, exact `grep`/file reads for every
documentation claim):

| ID | Severity | Finding | Verified? |
|---|---|---|---|
| E01-R1 | MAJOR | Several display labels (period `dateRange`, round `dateRange`, one period's title/id) contradicted their real underlying dates | Confirmed — recomputed every `offsetDays()` value independently and compared |
| E01-R2 | MAJOR | Both candidate pages capped the actual League product surface at `max-w-[720px]` against the real app shell's `max-w-[96rem]` | Confirmed — read both page files and `src/app/(app)/layout.tsx` directly |
| E01-R3 | MINOR | `DATA_TRUTH_AND_FIXTURES.md` claimed "eleven matches"; real count is ten | Confirmed — counted matches directly from the fixture source |
| E01-R4 | MINOR | Three docs still claimed "Create match" was omitted; it is rendered | Confirmed — `grep` found the stale claims in `INTERACTION_AND_STATE_AUDIT.md`/`WAVE_SCOPE.md`/`candidate_manifest.json` |
| E01-R5 | MINOR | `VISUAL_VS_CURRENT.md` referenced a since-superseded CI run | Confirmed — two further successful runs existed beyond the one cited |
| E01-R6 | Acceptance-language gap | "Context restoration" was conflated with default-focus re-resolution; XR-T01's actual text is about real selected-context restoration on return navigation | Confirmed by re-reading `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md`'s XR-T01 entry directly |

**Summary:** 0 BLOCKING, 2 MAJOR, 3 MINOR, 1 acceptance-language gap — all six fixed in this PR
(see `BLOCKERS.md` BLK-E01-06 for the full remediation account). A genuinely fresh,
context-independent review (round 3, not this session's own judgment) was then commissioned to
verify these fixes before finalizing — see below.

## Review round 3 (fresh independent review of the round-2 remediation)

<!-- Filled in after a freshly-spawned review agent inspects the remediated code, tests, and a
new CI capture run. Not self-assessed. -->

## Disposition

Pending review round 3's outcome — see above. Round 1 and round 2's own findings are fully
remediated with no unaddressed BLOCKING or MAJOR item as of this writing. Owner Visual Authority
approval has not been requested or assumed by this review.
