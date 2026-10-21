# Gate B W2 — Current State Audit

## Route and data ownership

- Canonical owner: `src/app/(app)/o/[orgSlug]/matches/[matchId]/post-match/page.tsx`;
  `src/app/(app)/matches/[matchId]/post-match/page.tsx` is the equivalent redirect (same pattern
  Gate B W1 already confirmed for Match Details).
- `derivePostMatchReportSurfaceState()`/`getPostMatchReportDefaultTab()`/
  `getPostMatchReportTabs()`/`resolvePostMatchReportTab()` — all in
  `src/lib/matches/match-detail-tabs.ts`, the single owning module (unchanged, read directly).

## Component inventory (real, current production — what this wave reuses or deliberately doesn't)

| Component | File | Reused in this wave? |
|---|---|---|
| `PostMatchReportPageShell` | `src/components/matches/match-detail/post-match-report-page-shell.tsx` | Yes — the real tab orchestrator, unmodified, both pages |
| `PostMatchReportHeader` | `src/components/matches/match-detail/post-match-report-header.tsx` | Yes — pure, prop-driven |
| `PostMatchSummaryTab` | `src/components/matches/match-detail/post-match-summary-tab.tsx` | Yes — pure, prop-driven |
| `PostMatchReviewTab` | `src/components/matches/match-detail/post-match-review-tab.tsx` | Yes — DRAFT only, per the real tab set |
| `MatchTimelineList` | `src/components/matches/match-detail/match-timeline-list.tsx` | Yes — pure (Timeline tab) |
| `PostMatchPage` | `src/components/assistant/post-match-page.tsx` | Yes in the real dev-server render (CI capture); **mocked in Vitest component tests** — see `BLOCKERS.md` |
| `PostMatchReportShell` | `src/components/matches/post-match-report-shell.tsx` | Yes, via `PostMatchPage` — the real `Complete report`/`Reopen report`/goal/assist/attendance editor, unmodified |
| `PostMatchDebrief` | `src/components/post-match/debrief/post-match-debrief.tsx` | Yes — real, unmodified; renders its own real read-only view since `status: "SUBMITTED"` in both fixtures |
| `GoalAttributionGapBanner` | `src/components/matches/goal-attribution-gap-banner.tsx` | Yes — real, pure, rendered directly by the shell |
| `RecoveredTimingCallout` | `src/components/matches/recovered-timing-callout.tsx` | Yes, via `PostMatchPage` → `PostMatchReportShell`; real in the CI capture render, not independently unit-tested in this wave (same mocking boundary) |
| `PostMatchUnresolvedBanner` | `src/components/live-match/post-match-unresolved-banner.tsx` | Yes in the real render (renders nothing — no local IndexedDB outbox for a fixture match); **mocked in Vitest component tests** — see `BLOCKERS.md` |
| `FootballObservationSection` / `ObservationSection` | `src/components/player-development/football-observation-section.tsx` / `src/components/opponents/observation-section.tsx` | Yes in the real render; **mocked in Vitest component tests** — see `BLOCKERS.md` |
| `LegacyMatchFeedbackSection` | `src/components/matches/legacy-match-feedback-section.tsx` | Yes — real; renders `null` for this fixture's empty `feedback: []` (honest "nothing here", same as Gate B W1's own empty-state components) |
| `MatchCombinationEvidencePanel` | `src/components/matches/match-combination-evidence-panel.tsx` | Yes — real, pure (Combinations tab, COMPLETED only) |

Every component above is reused **completely unmodified** — this wave adds zero production
code, matching Gate B W1's own "no production route, component, data loader, or schema file is
touched" discipline.

## ADRs consulted

`docs/adr/0147-match-details-and-post-match-report-lifecycle-surfaces.md`,
`docs/adr/0152-coach-learning-loop.md` — both read directly; see `SOURCE_RECONCILIATION.md` for
exactly which sections governed which decision.
