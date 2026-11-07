# Gate B W5 — Blockers / Open Questions (B08)

Status: implementation complete (all 9 spec steps). All items below are resolved or disclosed as
permanent, deliberate scope boundaries — none block the PR; see `REVIEW_RECORD.md` for the real
current status.

## Resolved during this audit (recorded here so Step 4 doesn't re-derive them)

- **Tab sets**: the task brief's §3 table was checked against `src/lib/matches/
  match-detail-tabs.ts` directly and matches exactly, including the DRAFT-defaults-to-`players`
  rule and the "Debrief" label / `reflection` URL-key split. No mismatch to flag.
- **The flagship duplication finding** (Overview's own "Post-match report" status widget vs. the
  dedicated "After match" tab's status/integrity surface) is fully verified field-by-field — see
  `INFORMATION_OWNERSHIP_MATRIX.md` §3. Not speculative.
- **SafePostMatchReportShell location**: `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/
  safe-post-match-report-shell.tsx` + `use-safe-report-lifecycle.ts` (same dir). Confirmed reusable
  pattern for B08-REPORT-DRAFT/-COMPLETED (parameterize with a new B08 fixture, do not reuse B05's
  match identity).
- **Gate B index page**: `src/app/dev/ui-lab/gate-b/page.tsx` — flat `SCENARIOS` array; already
  contains a line stating B08 "remains deferred, not deleted from scope" that must be updated once
  B08 lands, plus 15 new entries (5 primary + any companion/nav-origin stand-ins) need adding.
- **Event has no dedicated Match Details route** — confirmed, zero file exists. B08's "Event-origin
  parity" requirement (brief §7) must reuse B06's existing comparison scaffold
  (`b06-league-event-parity/{league,event}/{before,after}` + the two nav-origin stand-in pages),
  not invent a new Event Match Details page (explicitly forbidden by brief §19's non-goals).

## Resolved during Step 4 implementation

1. **RESOLVED — Overview report-status widget correction shape.** Implemented as a 2-column grid
   (the degraded third cell was dropped, not kept as a visibly empty slot) — status pill + single
   "Continue report"/"View full report" link, full detail removed. See `after/page.tsx` and the
   directly-asserting test in `INTERACTION_AND_STATE_AUDIT.md`.
2. **RESOLVED — the §3 correction is visibly demonstrated, not just documented**, with an on-page
   disclosure callout noting the intentional difference from current production (`VISUAL_VS_CURRENT.md`).
3. **RESOLVED — a new, real gap found while building `after/page.tsx`:** the reused, unmodified
   `MatchAfterMatchPanel` renders its own secondary "Continue report"/"View full report" link via
   the real `orgUrl()` helper, which resolves to a production-shaped `/o/.../matches/.../post-match`
   URL rather than this candidate's own `/report-draft` route. The page-level **primary** "Continue
   report" CTA (the one this wave's own transition contract tracks) is correctly wired to
   `/report-draft` and covered by a test. Fixing the secondary link would require threading a new
   prop into a shared production component, beyond this wave's scope — disclosed in
   `TRANSITION_AND_NAVIGATION_CONTRACT.md`, not silently patched.
4. **RESOLVED — LIVE scenario's production-component mounting risk.** Decision: **mount the real
   `LiveMatchClient`** (`src/components/live-match/live-match-client.tsx`), not a hand-built
   imitation. Verified by reading the full component: it has zero server-only imports and zero
   hardcoded network calls of its own — every production side effect (`startSession`,
   `endSession`, `heartbeat`, `persistClock`, `recordEvent`, `getRecentEvents`,
   `getPreMatchPackage`, `reconnectRealtime`, `onLiveUpdate`, `onPersistenceChanged`) is reached
   exclusively through the injected `actions: LiveMatchActions` prop (a plain interface, line 90).
   `useLiveRealtime` (`use-live-realtime.ts`) is **not** called by `LiveMatchClient` itself — it's
   only wired in by the two production adapters (`createLeagueActions`/`createEventActions` in
   `league-live-match-client.tsx`/`event-live-match-client.tsx`), and even there it never connects
   on mount: `ensureConnected()` only runs from a successful real `startSession` call or an
   explicit `reconnectNow()`. So the risk is entirely in *which actions object* gets passed in, not
   in the shared component itself.

   **Implementation approach for B08-LIVE:** write a fixture-local `LiveMatchActions` object (new
   file, e.g. `shared/fixture-live-actions.ts`) that satisfies the real `LiveMatchActions`
   interface with in-memory/Promise-resolved fixture data and never imports
   `use-live-realtime.ts`, `live-actions.ts`/`event-live-actions.ts`, or either production adapter.
   Concretely: `getPreMatchPackage`/`getRecentEvents` resolve the shared B08 fixture's squad/event
   history; `recordEvent` appends to local component state and returns
   `{ success: true, data: { persistenceStatus: "persisted" } }` synchronously (no coordinator);
   `startSession`/`endSession`/`heartbeat`/`persistClock` are no-op-success stubs;
   `reportUrl`/`onLiveUpdate`/`onPersistenceChanged` can be omitted (all optional) or no-op.
   `registerLiveServiceWorker()` and the IndexedDB local-outbox calls
   (`saveSessionLocally`/`saveCommandLocally`/etc., from `live-local-store.ts`) run as real
   browser-local side effects regardless of the actions object — harmless (no production reach),
   but use a clearly synthetic, namespaced `matchId` (e.g. prefixed `b08-fixture-`) so fixture
   session/command rows can never collide with a real match's IndexedDB rows on the same browser
   profile. Mount via `<LiveMatchClient matchId={FIXTURE_ID} teamName=... opponentName=...
   periodConfig={...} actions={fixtureActions} subjectType="LEAGUE" />` directly — not through
   either adapter. Disclose in `VISUAL_VS_CURRENT.md` that the League/Event adapters and the real
   coordinator/`useLiveRealtime` connection are the one production layer intentionally not
   mounted; everything else (`LiveMatchClient` itself, its clock/period logic, its event-entry UI,
   `NeedsReviewPanel`, `LiveReportingWarningBanner`) is the real, unmodified production component.

   **Read-only follower companion:** `follow-live-client.tsx` exists as a separate real component
   (confirms the spec's optional "read-only Follow Live companion" is backed by a real production
   piece, not invented) — reuse it the same way (fixture-local data, no real polling target) if the
   companion page is built.

   **B08-BEFORE's live-entry CTA, confirmed NOT inside `before-match-overview.tsx`:** the actual
   "Start live reporting" / "Open Live Reporting" primary action and the read-only
   `/matches/[matchId]/live/follow` link are rendered by `match-detail-shell.tsx` (lines ~226-240,
   `livePrimaryAction`/`describeLiveReportingEntryPointLabel()`), not by `BeforeMatchOverview`
   itself, which only receives `liveReportingStarted` as a boolean flag for its own planning-state
   messaging. B08-BEFORE's candidate must reproduce the shell-level CTA (a real link construction
   using the same label function), not expect `BeforeMatchOverview` alone to contain it — a one-file
   assumption correction `CURRENT_STATE_AUDIT.md` didn't make explicit.
5. **RESOLVED — Debrief URL key regression.** `?tab=review` is only a real tab in Post-Match Report
   DRAFT, not COMPLETED (`combinations` replaces it). Production's real
   `resolvePostMatchReportTab()` fallback already handles this (`CURRENT_STATE_AUDIT.md` §2); B08
   reuses it verbatim via the shared shell and asserts the fallback directly in
   `report-completed/__tests__/page.test.tsx` ("`?tab=review` is invalid once locked..."). Not
   registered as a separate browser-capture scenario — see `VISUAL_VS_CURRENT.md` for why.
6. **RESOLVED — Combination evidence for REPORT-COMPLETED.** Built as a hand-written literal,
   independently verified against the real `deriveCombinationsFromSegments()` output in
   `shared/__tests__/combination-evidence.test.ts`, mirroring B05's own precedent exactly.

## Permanent, deliberate scope boundaries (not gaps to close later)

- `match-flow-panel.tsx`, `plan-vs-reality-panel.tsx`, `what-this-match-added-panel.tsx`,
  `match-opponent-memory.tsx` were reused by import/composition, not read line-by-line in the Step
  1-2 audit; their single-owner verdicts rest on their doc comments and call sites. Low risk (none
  appear duplicated elsewhere in the ownership matrix) but not a complete independent verification —
  acceptable residual, not blocking.
- `before-match-overview.tsx`'s full body was never read; B08-BEFORE instead composes its own page
  directly from the real constituent components (`MatchIdentityCard`, `MatchPreparationWidget`,
  `TouchlinePlanningPitch`) rather than mounting `BeforeMatchOverview` itself. This is a deliberate
  compositional choice (consistent with B01/B06's own established pattern), not an oversight.
- `PlanVsRealityPanel`/`MatchTacticsPanel` are not mounted on B08-AFTER — both self-fetch via real
  server actions/DB against a real `matchId`/`teamId` and are not fixture-injectable (same
  disclosed gap B01 already carries). Tactics/Opponent context/History tab bodies are disclosed
  placeholders on B08-AFTER, the same discipline B05's own "Review" tab uses.
- `FollowLiveClient` is not mounted on B08-LIVE (performs a real realtime-ticket fetch/Durable
  Object connection on mount) — the reporter-vs-follower distinction is demonstrated with a
  read-only summary panel built from the real `MatchScoreHeader` instead.
- LIVE's "Finish reporting" does not auto-navigate to AFTER (that redirect is owned by the
  production adapters B08-LIVE deliberately bypasses) — see
  `TRANSITION_AND_NAVIGATION_CONTRACT.md`'s own "Known gap" entry.
- `capture-attestation.json` is a real placeholder pending this PR's own first CI run of the "UI Lab
  Visual Review" workflow — the same two-commit pattern (placeholder now, real attestation in a
  documentation-only follow-up commit once CI produces it) every prior Gate A/B wave has used. Not
  fabricated locally.
