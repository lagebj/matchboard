# ADR-0136: Touchline Design Atlas & Composition Convergence

## Status

Accepted (2026-09-11). **Complete (2026-09-12) — all 10 phases delivered and the final human
visual approval granted** (see "Phase 10 complete" / "Human final visual approval: granted" below
for the full account). **Phases 0–3 implemented (inventory/provenance, presentation view
models, semantic widget/viz library, route-complete UI Lab), followed by two rounds of Hard Gate
A review feedback (pitch-line markings, GK kit colour + opt-in perspective tilt, shirt-shaped
tokens, vertical pitch orientation — see `docs/domain/touchline-atlas-provenance.md` §12–§13),
each verified with a full `npm run validate` pass and merged (#519, #520).

**Hard Gate A: approved 2026-09-11.** The human reviewer confirmed the Phase 3 UI Lab
(`/dev/ui-lab/atlas`, including both feedback rounds) matches expectations — information
hierarchy, component composition, visual fidelity, and data-story quality all accepted. Per
`13_IMPLEMENTATION_PHASES_AND_GATES.md`, this unblocks **Phase 4 — High-identity routes** (Today,
League, Events, Event detail, Match detail, Players, Player detail, Insights), which stops again
at **Human Gate B** before Phase 5 (the football work surfaces: Round Board, Lineup, Tactics,
Rotations, Live Reporting, Follow Live, Post-match). Phases 6–10 (historical/intelligence routes,
utility/config/collaboration routes, brand asset convergence, transitional-design removal, full
validation and final sign-off) remain unstarted and ungated until their own turn.

**Phase 4 is complete — all 8 named routes migrated (Today, League, Events, Event detail, Match
detail, Players, Player detail, Insights).** All are the real production routes, not UI-Lab
copies; each freezes all existing domain/business logic and is additive composition only. Full
account: `docs/domain/touchline-atlas-provenance.md` §14 (Today), §15 (League), §16 (Events +
Event detail), §17 (Today performance follow-up), §18 (Today squad-status placement follow-up),
§19 (Match detail), §20 (Players + Player detail), §21 (Insights, completing Phase 4).

**Human Gate B: approved 2026-09-12.** The maintainer confirmed Phase 4's production migration
(the 6 merged PRs above, including the 3 real regressions found and fixed along the way) and
explicitly authorised proceeding into Phase 5. Per `13_IMPLEMENTATION_PHASES_AND_GATES.md`, this
unblocks **Phase 5 — football work surfaces** (Round Board, Lineup, Tactics, Rotations, Live
Reporting, Follow Live, Post-match), which stops again at **Human Gate C** before Phases 6–10
(historical/intelligence routes, utility/config/collaboration routes, brand asset convergence,
transitional-design removal, full validation and final sign-off).
**Phase 5 complete: all seven named routes addressed (Round Board, Lineup, Tactics, Rotations,
Live Reporting, Follow Live, Post-match) across 5 PRs.** All are the real production routes, not
UI-Lab copies; every existing mutation (draft generation, lineup/tactics/rotation editing, live
session/clock/event-recording, and post-match report completion) is frozen, completely untouched
— only presentation and, where a genuine ordering mismatch was found, composition order changed.
Live Reporting itself received **no code change** — a deliberate, disclosed finding, not a gap:
its scoreboard/control-grid composition is already an incident-hardened design (ADR-0133) that
already matches the golden reference's intent, achieved during ADR-0134's earlier material
migration. Post-match had two real, disclosed ordering bugs fixed (the submit action moved from
the shell's header to its correct last position; League's page had team reflection and player
observations in the wrong relative order, unlike Event's own panel, which was already correct).
Full account: `docs/domain/touchline-atlas-provenance.md` §22 (Round Board), §23 (Lineup +
Tactics), §24 (Rotations), §25 (Live Reporting — no change — and Follow Live), §26 (Post-match,
completing Phase 5).

**Phase 5 is now complete. Per `13_IMPLEMENTATION_PHASES_AND_GATES.md`, Phases 6–10 (historical/
intelligence routes, utility/config/collaboration routes, brand asset convergence, transitional-
design removal, full validation and final sign-off) do not begin without a fresh, explicit human
approval at Human Gate C** — mirroring exactly how Human Gate B was required before Phase 5
itself began. The implementing agent does not self-certify visual fidelity or scope completeness
as a substitute for that approval.

**Human Gate C: approved 2026-09-12.** The maintainer confirmed all 5 Phase 5 PRs (#531–#535,
covering all 7 named routes) and explicitly authorised proceeding into Phase 6. This unblocks
**Phase 6 — historical/intelligence routes** (History, Opponents, Teams, Season, evidence detail
routes), migrated with the same "freeze existing mutation logic, verify before claiming done"
discipline applied throughout Phases 4–5. `13_IMPLEMENTATION_PHASES_AND_GATES.md` names no further
human gate between Phase 6 and Phase 7 (Formations, Groups, Rules, Settings, More, Peer reviews,
invitation) — but Phase 6's own completion is still reported back for confirmation before Phase 7
begins, matching this programme's practice of checking in at every phase boundary rather than
chaining phases unattended purely because a named gate is absent.

**Phase 6 complete: History, Opponents (list + detail), Teams (overview + detail), Season, and the
evidence detail routes — all 5 of 5.** All are the real production routes, not UI-Lab copies. History: every existing
all-time (not single-league-season) query this page ran is preserved unchanged — a real
architectural fork (whether to switch to the league-season-scoped `getSeasonPlayerRoundMatrix()`/
`getMovementPathSummary()` canonical sources named in `history-view-model.ts`'s own doc comment)
was found and deliberately rejected, since doing so would have silently narrowed History's scope
to one season. Opponents: the list page was substantially rebuilt (it had none of the spec's
fields beyond a name and match counts); the detail page needed only one small, disclosed fix (a
previously-missing Won/Drawn/Lost record). The same class of architectural fork recurred —
`getOpponentHistory()` requires a specific football-group id, unlike the org-wide list/detail
pages — resolved with two new batched (not per-opponent-looped), tested pure modules instead.
Teams: **no architectural fork this time** — Teams overview being league-season-scoped is the
correct, already-documented product shape (unlike History/Opponents' all-time scope), confirmed
directly against AGENTS.md. Both routes needed only one small, disclosed, previously-unwired gap
each — "unresolved planning attention" on the overview (a dedicated view-model field with no
production caller, now fed by a new batched-per-distinct-round derivation, never per-team) and a
season Won/Drawn/Lost record on the detail page (absent entirely; the page's existing 7-tab
structure was correctly left alone as already substantially matching spec intent, richer than the
golden's flat "grid," per AGENTS.md's own documented tab design). Season: also **no fork** — its
rich player × round matrix/movement-path/drill-down content (`SeasonOverviewClient`) is a real,
AGENTS.md-documented product decision, correctly left untouched. Two small, additive,
previously-missing gaps found instead: no page header/title existed anywhere (a direct AGENTS.md
"Header: `Season`..." miss), and `buildSeasonViewModel()` (round progress + participation
coverage) had no production caller — both layered above the existing content, matching Today's
own "new summary layer above existing content" pattern. An evidence-spotlight widget and a
recent/upcoming-matches list were deliberately **not** added — the former would reintroduce the
exact unbatched-query performance risk already diagnosed and reverted from Today (§14); the
latter would duplicate what Today/League already own. **Evidence detail routes**: a read-only
compliance survey of all 14 `/insights/*` sub-route clients against
`07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §D`'s six composition bullets found **14 of 14 already
compliant — no code change made**. Each has exactly one stated question, one table/matrix
visualization (matching AGENTS.md's own "matrix is primary" pattern for these exact routes),
factual disclaimer-style explanation text, evidence/sample detail, and contributing data; every
summary-tile row found is a direct same-question summary, not an unrelated metric. This is a
genuine, verified "already substantially covered" finding (the same class as Live Reporting §25
and Team Detail's tabs §29), not a skipped audit — and resolves the composition half of the
Touchline material-migration record's own "bundle §8... tracked follow-up" note (AGENTS.md); the
separate light-mode dark-pin/token concern that note also named remains open. Full account:
`docs/domain/touchline-atlas-provenance.md` §27 (History), §28 (Opponents), §29 (Teams), §30
(Season), §31 (evidence detail routes, completing Phase 6).

**Phase 6 is now complete.** Per `13_IMPLEMENTATION_PHASES_AND_GATES.md`, no human gate is named
between Phase 6 and Phase 7 (Formations, Groups, Rules, Settings, More, Peer reviews, invitation)
— but, matching this programme's practice of checking in at every phase boundary rather than
chaining phases unattended purely because a named gate is absent, Phase 7 work does not begin
without reporting this completion back first.

**Maintainer decision (2026-09-12): no further check-in stops for the remainder of the
programme.** Asked directly, the maintainer confirmed Phases 7–9 (Formations/Groups/Rules/
Settings/More/Peer reviews/invitation; brand asset convergence; transitional-design removal) may
proceed back-to-back without a check-in between each, since `13_IMPLEMENTATION_PHASES_AND_GATES.md`
names no human gate across any of that span — this removes the session's own self-imposed
practice above, it is not a change to the spec's own gate structure. Phase 10's own stated
completion criterion, "Human final visual sign-off required," is not a self-imposed check-in this
decision removes — it is the phase's own deliverable, not a "may I proceed" pause between phases,
and stays in force as written.

**Phase 7 complete: all seven named routes addressed** (Formations, Groups, Rules, Settings,
More, Peer reviews, Invitation). Formations: the real production
create/edit route, not a UI-Lab copy; every existing slot-mutation/save/list action is frozen,
completely untouched. `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §A` names four "selected
slot details" facts — three (role type, exact derived target role, lane) were already
implemented via the existing `deriveExactTargetRole()` call; only the automatic-planning
eligibility-tier meaning was missing, now added as one new sentence. The golden's 3-column
desktop layout and a live-synced persistent inspector were both deliberately not built — genuine,
disclosed, interaction-model-driven decisions (a real two-page list/edit navigation split
predates this pass; `SlotEditDialog`'s own local state would need lifting for a live-synced
external panel, a larger refactor than this fix warrants). Groups: the Group detail page's
identity/tabs/dense-table/edit-action were already correct (already the real 6-tab set named in
provenance §0 item 11); the one genuine gap was a missing "Guest players" count tile in the
top summary strip, even though the Guest players tab and its data were already present — added as
a 5th tile, zero new queries. Rules: **no code change** — `RulesForm`'s existing grouped-section
composition already exactly matches the spec's "label; short consequence; control" ask for both
real rule fields (`MatchboardRuleConfig` has no others), and no invented options exist. Settings:
Appearance/Organisation were already correct; Notifications/App-PWA/Team-configuration/Data-
privacy stay deliberately absent (no data owner, or already correctly placed elsewhere — App/PWA
already lives on More+Today, Team configuration is inherently per-team); the one genuine gap was
a missing "About" section (app version), added reusing the existing `APP_VERSION` constant. The
golden's desktop side-navigation was deliberately not built — this page's real content (4–5 short
sections) doesn't warrant one, the same class of decision as Formations' declined 3-column
layout. More: **no code change** — the page already has the exact five named groupings (Coaching
& evidence, Competition & history, Structure & configuration, Collaboration, Settings) plus a
legitimate admin-only "Advanced" sixth group, and the "Install Matchboard" PWA callout already
renders unconditionally. Peer reviews: `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §F`
requires each request to show its target, requester, change/superseded state, and primary
action — the existing Pending-for-me/Requested-by-me/History sections and per-row status/action
composition were already correct, but no row displayed *who* requested it. `ReviewRequest`
stores only membership ids (no Prisma relation to `OrganisationMembership`), so the one genuine
gap was closed with a single batched server-side lookup (`page.tsx`) resolving requester ids to
display names, passed down as a plain map — no new query per row, no name stored in the
component's own state. Decision reviews are correctly absent from this page (§F: "No decision
reviews mixed into peer reviews" — they render on Today/player/team detail instead, per
AGENTS.md's "Review vocabulary"). Invitation: `§H` requires organisation identity, invitation
meaning, accept, and "use another account" — the first three were already correct, and no
marketing feature list was added despite the golden reference illustrating one (§H's own text
prohibits it: "no marketing feature list unless the invited scope actually grants it," and this
codebase has no invitation-scoped feature grant to check against). The one genuine, load-bearing
gap: "use another account" did not exist — an invitation targets one specific email, and there
was no way to switch Google accounts without abandoning the invite flow entirely. Added a new,
self-contained `useAnotherAccountAction()` (sign out, then re-initiate Google sign-in with the
account chooser forced open, returning to the same invite link) — it calls `signIn`/`signOut`
directly with a hardcoded `redirectTo`, so it needed no change to the shared `/signin` page or
global auth middleware. A separate, lower-severity, real defect was found and disclosed rather
than folded in: the global unauthenticated redirect ignores any callback destination, so a
brand-new coach not yet signed in at all lands on `/` after authenticating rather than back at
the invite (recoverable by re-clicking the same email link, not a hard failure) — fixing that
touches security-sensitive shared middleware and needs open-redirect-safe validation, a
materially larger surface than this route's own narrow fix, so it is left for a dedicated
follow-up. Full account: `docs/domain/touchline-atlas-provenance.md` §32 (Formations), §33
(Groups), §34 (Rules), §35 (Settings), §36 (More), §37 (Peer reviews), §38 (Invitation,
completing Phase 7).

**Maintainer decision (2026-09-12): continue through Phase 10 without further check-in stops,
except the one explicitly named in the phase spec.** Per the earlier "no further check-in stops
for the remainder of the programme" decision (Phases 7–9), and a direct instruction to continue
through the rest of the programme without any additional human gates unless explicitly stated in
`13_IMPLEMENTATION_PHASES_AND_GATES.md` itself — that document names no gate for Phases 8 or 9,
and Phase 10's own stated completion criterion ("Human final visual sign-off required") remains
the one stop that is not self-imposed and stays in force exactly as written.

**Phase 8 complete: brand asset convergence.** Per `11_BRAND_ICON_AND_PWA_CONTRACT.md`: same mark
geometry, same product name, no redraw/reshape/new symbol — only the explicitly Allowed
colour-only derivative. `scripts/generate-pwa-icons.sh` (reproducibility script; committed
PNGs/ICO are the deliverable) recoloured every app-icon asset from the pre-Touchline brand green
(`#144937`) + white mark to the Touchline accent (`--tl-accent`, `#C7F54A`) + near-black mark
(`--tl-accent-on-fill` dark, `#101500`) — matching §2's "Preferred launcher: Touchline
accent/lime background; existing mark in near-black" exactly:
`android-chrome-{192,512}.png` (`purpose: "any"`, previously left unchanged by ADR-0123's own
script — now brought into the same treatment), `maskable-{192,512}.png`, `apple-icon.png` (180),
`icon.png` (32). One additional, previously-unaddressed defect of the exact same class ADR-0123
had already fixed for `apple-icon.png` was found and fixed: `src/app/favicon.ico` was a
transparent PNG-in-ICO with a plain black mark, nearly invisible against a dark browser tab bar —
now opaque, matching every other icon. `src/app/manifest.ts`'s `background_color`/`theme_color`
were corrected from a slightly-off pre-Touchline value (`#0a0d13`) to the exact Touchline dark
canvas token (`--tl-canvas`, `#090b0f`) already used by `layout.tsx`'s own `viewport.themeColor`
— the two had drifted apart. The golden reference's own mark geometry (`brand-asset-matrix.png`)
was confirmed to differ from the repository's canonical mark and was correctly ignored per §5's
explicit instruction ("golden brand board correction... is visual guidance for color/safe-zone
treatment only... use the repository mark"). `docs/product/brand-strategy.md`'s "final logo/app
icon" owner-approval gate is addressed directly in that document: this narrow, colour-only,
mark-preserving change is covered by ADR-0136's own Accepted status and explicit Phase 8 scope,
not a fresh standalone brand decision — the gate remains open for anything further. Full account:
`docs/domain/touchline-atlas-provenance.md` §39.

**Phase 9 complete: remove transitional design.** Per `12_CODE_CHANGE_MAP.md §13`: "remove
obsolete generic wrapper components only if no remaining consumers... delete visual compatibility
CSS from old page composition where safe." This is deliberately narrow — CSS-token-level
compatibility aliases were already fully removed by ADR-0134 Phase 10, and the mainstream
pre-Touchline shared primitives (`Button`, `PageHeader`, `SectionHeader`, `Surface`, etc.) remain
genuinely load-bearing across the large majority of routes not yet swapped to a Touchline
equivalent — deleting any of those would break the app, not clean it up, so none were touched. A
systematic consumer-count audit (every export checked for real, non-self-referential importers
across the whole `src/` tree, not a tool's static-analysis guess — barrel re-exports produce
false positives a tool like `ts-prune` cannot reliably resolve) found exactly four fully orphaned
files and one deprecated compatibility export, all confirmed zero-consumer before deletion:
`src/components/ui/severity-badge.tsx` (`SignalBadge` + 3 helper functions — real signal
rendering moved fully to `StatusPill`/`DecisionBanner`, confirmed directly in `round-board.tsx`'s
own imports), `src/components/ui/status-rail.tsx` (`StatusRail`), `src/components/ui/
warning-card.tsx` (`SignalCard` — despite ADR-0007's original text calling this file "WarningCard"
informally, no component of that name ever existed; `SignalCard` was the real export, now
confirmed to have had zero consumers), `src/components/ui/branded-surface.tsx` (`BrandedSurface`,
pre-Touchline, from the original #103 "non-empty state branding" PR, superseded by direct
`Surface`/`TouchlineWidget` usage), and `MatchScoreRow` (`match-presentation.tsx`'s own
`@deprecated` alias for `MatchRow`, ADR-0125's original name for the component before its own §11
rename — kept only for migration, with zero remaining production callers). Every doc-comment
reference to `MatchScoreRow` in AGENTS.md and `docs/product/adaptive-interaction-design.md` was
updated to `MatchRow`; the component test exercising it was renamed rather than deleted (the
coverage is real and still needed, just under the current name). ADR-0007 and ADR-0125 — both
historical, append-only records whose original text made present-tense claims now false — each
gained a short superseding note in their own Status section; their bodies are otherwise
unchanged. Full account: `docs/domain/touchline-atlas-provenance.md` §40.

**Phase 10 complete: complete validation.** Per `13_IMPLEMENTATION_PHASES_AND_GATES.md`'s own
list (unit, typecheck, lint, E2E, screenshots, accessibility, mobile device, PWA install, light/
dark, reduced motion) and `14_ACCEPTANCE_AND_CONFORMANCE.md §A–J`. Full `npm run validate` (14
steps) on `main` at this programme's final merge commit (`cc4354fa`) — **all 14 passed**,
including the complete unit + component + worker suites (3,929 + 279 + 84 tests) and a successful
`build`. The standing per-PR E2E pipeline (`test-acceptance.yml`, full `npm run test:e2e`
including `accessibility.spec.ts` and `pwa-installability.spec.ts`) already passed on every PR in
this programme; the same final merge commit was independently reconfirmed via `ci-checks.yml`'s
post-merge "Browser Acceptance Tests" smoke job — [run
34717114053](https://github.com/lagebj/matchboard/actions/runs/34717114053), all jobs
`completed/success`. Two genuine, disclosed gaps (not silently passed): no dedicated automated
e2e assertion for light/dark rendering across every migrated route, and no dedicated automated
e2e assertion for `prefers-reduced-motion` behaviour — both mechanisms exist and were verified by
direct source inspection (`AppearanceControl`; `@media (prefers-reduced-motion: reduce)` in
`globals.css`/`touchline.css`) rather than a browser-level automated check. Screenshots were not
regenerated wholesale — each phase's own provenance entry already captured and reviewed real
screenshots for its own routes; a full re-capture sweep remains legitimate, non-blocking follow-up
per the same documentation-screenshot discipline ADR-0134 Phase 11 already established. Full
account, including the consolidated deviations list and deleted-transitional-design restatement:
`docs/domain/touchline-atlas-provenance.md` §41.

**Per `14_ACCEPTANCE_AND_CONFORMANCE.md §J`, the coding agent cannot mark "Visual fidelity"
(section F) complete itself. This ADR does not attempt to.**

```
AWAITING HUMAN VISUAL APPROVAL
```

**Human final visual approval: granted (2026-09-12).** The maintainer reviewed the programme's
final state on `main` (through PR #550) and approved. Section F (Visual fidelity) and the whole
`14_ACCEPTANCE_AND_CONFORMANCE.md` gate checklist are now closed — the last open item from
`13_IMPLEMENTATION_PHASES_AND_GATES.md`'s Phase 10. **The Touchline Design Atlas & Composition
Convergence programme is complete.**

**This closes all 10 phases of the Touchline Design Atlas & Composition Convergence programme.**
Every route named in `data/route-composition-matrix.json` has
been migrated (Phases 4–7), brand assets converged to the Touchline treatment (Phase 8), and
transitional design removed (Phase 9) — all under the "implementer, not designer" contract this
ADR opened with, verified at every step with `npm run validate` and, where a genuine defect or
architectural fork was found along the way, disclosed rather than silently resolved in whichever
direction was easiest.

- **Today** (`(app)/o/[orgSlug]/today/page.tsx` + `AssistantCommandCentrePage`): every existing
  situational-decision-support behaviour (matchday banner, grouped work items, decision reviews,
  next-round readiness, deferred-item annotation, "at a glance" metrics, weekly coaching context,
  upcoming rounds, PWA install) is frozen, unchanged. New, real, database-backed additions: a
  match hero (`NextMatchHero`, shown when no decision is urgent enough to force-feature and a
  real upcoming match exists — previously this state showed only a generic empty state), squad
  status (org-wide `Player.currentAvailability`), and latest results (last 5 completed matches).
  An evidence-spotlight story was also built, then removed before shipping after it measurably
  slowed Today under concurrent CI load — a real, disclosed performance finding, not a design
  change of mind (`getTeamSeasonMatchPhasePatterns()`'s own doc comment already discloses its
  unbatched per-match query pattern); see the provenance doc's §14 for the full account. The
  golden's illustrative "Training" schedule row and a redundant second rendering of today's
  matches were deliberately not built — see the provenance doc's `PROHIBITED_ILLUSTRATIVE` entry
  and its "deliberately omitted" reasoning. Verified: full `npm run validate` (14/14), a new
  DB-backed test (`get-org-active-player-availability.test.ts`), a new pure-logic test
  (`today-match-presentation.test.ts`), 2 new component tests plus all 24 pre-existing ones
  passing unchanged, and a real screenshot captured against the seeded Fjordvik FK dataset via
  the existing test-agent auth flow (not a fixture).
  **Follow-up fix (§16):** "Latest matches" originally reused League's `getFixturesOverview()` —
  fine for League's own page, but that function loads every season/round/match org-wide
  unbounded, and calling it a *second* time from Today (very likely the single highest-traffic
  page) measurably compounded CI load even after the evidence-spotlight removal above. Replaced
  with a new, deliberately narrow, bounded query, `getRecentCompletedMatches()`
  (`src/lib/matches/get-recent-completed-matches.ts`) — same displayed data, far cheaper. 5 new
  DB-backed tests. See the provenance doc's §17 for the full account.
  **Follow-up fix (§18):** `SquadReadinessWidget` was nested inside the `featuredMatch` branch
  only, so it almost never rendered for an active coach (a real `nextAction` is the more common
  case) — found while capturing verification screenshots. Moved out to render independently of
  which hero branch is active, alongside `RecentFootballWidget`. New regression test locks it in.
- **League** (`(app)/o/[orgSlug]/fixtures/page.tsx` + `fixtures-page.tsx`): round/period
  generation, plan-integrity counts, and populate-all are frozen, unchanged. New: a
  `WorkbenchToolbar` "Open Round Board →" shortcut for the current/upcoming round
  (`05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §B`), wired from the already-built
  `buildLeagueViewModel()` into real `FixturesOverview` data. Found and fixed a real bug while
  wiring real data: the view model's fallback chain ended in an unconditional `rounds[0]`, which
  would "feature" an already-finished round as if it needed action when every round in a period
  was finalized — a new regression test locks in the fix. Verified: full `npm run validate`
  (14/14), 3 new/updated tests, and a real screenshot against the same seeded dataset.
- **Events** (`(app)/o/[orgSlug]/events/page.tsx` + `(app)/events/[eventId]/event-detail.tsx`):
  squad generation, fill/regenerate, guest-player, availability, match, and finalization
  behaviour are frozen, unchanged. New: a "Next event" feature widget on the Events list (same
  "shown twice" pattern) and a `SquadReadinessWidget` on Event detail's Overview tab, both computed
  entirely from already-loaded data — no new query added, deliberately, after the Today
  performance lesson. Both mappings were extracted to new pure, unit-tested modules
  (`src/lib/events/event-list-presentation.ts`, `event-squad-readiness.ts`). The UI-Lab
  reference's "Next match" and "Helpers" widgets on Event detail were deliberately deferred, not
  built — both would need a genuinely new query this pass intentionally avoided. Verified: full
  `npm run validate` (14/14), 9 new unit tests, and real screenshots against the seeded dataset.
- **Match detail** (`(app)/o/[orgSlug]/matches/[matchId]/page.tsx` + `match-detail.tsx`):
  deliberately narrow scope — top-level identity/header/summary composition only. Every existing
  tab (Squad, Tactics, Rotations, After match, Opponent context, Review) and every mutation inside
  them is frozen, completely untouched (Phase 5 scope). New, in the header area only: a Squad
  widget (core/support/development/matchday counts, from already-loaded selections, zero new
  query), a Preparation checklist (3 real booleans; `lineup` needed one new, single-row existence
  check — not the unbounded-tree class of query that caused the Today regression), and a Planning
  attention widget (the single highest-priority existing warning, already loaded). Closed a real,
  disclosed gap found along the way: `match-view-model.ts` (Phase 1) had never had a unit test —
  added now that it has a real caller. "Availability" (per-player currentAvailability) was
  deliberately deferred, matching the "prefer zero new queries" discipline. Verified: full
  `npm run validate` (14/14), 17 new unit tests across 3 modules, and a real screenshot against the
  seeded dataset.
- **Players** (`(app)/o/[orgSlug]/players/**`): a deliberately small change. The Players list's
  row-expansion inspector (`SeasonOverviewTable`'s existing `expandedPlayer` interaction) was found
  to already cover the UI-Lab reference's "selected-player inspector" concept — a competing
  side-panel version was not built, to avoid duplicating existing UX. Player detail's ~15 existing
  panels already independently satisfy most of the bundle spec (opportunity/position-exposure
  evidence, development focus, observations, recent football); the one genuinely missing, small,
  safe piece — a participation summary strip (Played/Goals/Assists/Planned absent) below the
  header, from already-computed all-time stats, zero new query — was added. The spec's tabbed
  Overview/Matches/Development/Evidence restructuring was deliberately deferred as a real
  page-hierarchy decision with regression risk disproportionate to this pass, needing its own
  dedicated review. Verified: full `npm run validate` (14/14), 5 new unit tests (closing
  `player-list-view-model.ts`'s own test-coverage gap along the way), and real screenshots against
  the seeded dataset.
- **Insights** (`(app)/insights/insights-client.tsx`): the hub was found to be exactly the
  anti-pattern the bundle spec warns against ("do not create a metrics dashboard of equal cards")
  — twice over (a flat 4-tile summary grid, and a flat 13-card list). Replaced with the spec's own
  four named sections (Opportunity & load / Roles & development / Match patterns / Planning
  quality), each with at most one `EvidenceSpotlightWidget` headline reusing the exact same
  already-fetched overview numbers — zero new query. Real bug found and fixed along the way:
  `/insights/player-pathways`, a fully-built canonical Insights surface, was entirely absent from
  the hub's card list — added. Verified: full `npm run validate` (14/14), 9 new unit tests, and
  real screenshots against the seeded dataset. **This completes Phase 4.**

**Phase 5 — football work surfaces:**

- **Round Board** (`src/components/round/round-board.tsx`): every existing mutation (drag/drop/
  touch/move, generate/regenerate/clear, emergency repair) is frozen, completely untouched — the
  spec's own instruction ("keep as dense professional workbench... no decorative dashboard
  widgets above the work area") describes what was already there, not a call to add anything to
  the main work area. Two Touchline Finish primitives (ADR-0135) — `WorkbenchToolbar` and
  `WorkbenchSummaryStrip` — were purpose-built for exactly this spot but never actually wired
  into production until now. `WorkbenchSummaryStrip` replaces `RoundStatusStrip`'s `MetricTile`
  grid (the "dashboard card" pattern the spec calls out) with a 1:1 port of the exact same
  conditional facts via a new pure function, `buildRoundWorkbenchSummaryItems()`
  (`src/lib/rounds/get-round-workbench-summary.ts`) — no new query, no logic change.
  `WorkbenchToolbar` wraps the existing Regenerate/Clear buttons with a context label — same
  handlers, only the layout wrapper changes. `round-status-strip.tsx` removed as dead code (its
  only consumer). Verified: full `npm run validate` (14/14), 7 new unit tests, all 17
  pre-existing `round-board.test.tsx` tests (including the dedicated open/closed-boundary
  Regenerate/Clear visibility tests) passing unchanged, and a real screenshot against the seeded
  dataset. Full account: `docs/domain/touchline-atlas-provenance.md` §22.
- **Lineup + Tactics** (`src/components/matches/match-tactics-panel.tsx`): the spec's "Lineup"
  and "Tactics" sections both map onto this one existing tab, which already served "Lineup"
  (editable pitch/formation/assignment). The genuinely missing piece was "Tactics"'s
  selected-player inspector (identity, exact role, positional fit) — added via two already-built
  widgets and one new pure function, `computePlayerPositionFitEntries()`
  (`src/domain/positions/position-fit-entries.ts`). Found and fixed a real shared-primitive
  problem while wiring it in: the pitch's slot click was gated entirely on `!readOnly`, so the
  inspector could never work on a closed/locked lineup — exactly when reviewing positional detail
  matters most. Added a new, additive `onSlotView` callback to `TacticsBoard`
  (`src/components/formations/tactics-board.tsx`), fired regardless of `readOnly`, fully separate
  from the existing `onSlotClick` (unchanged gate) — verified not to affect Event's own lineup
  panel, which relies on that exact gate with no independent check of its own. New component
  tests caught two real bugs in the first draft before a screenshot was ever taken: a missing
  prop-forward in `TacticsBoard`'s dispatcher, and `onSlotClick` firing unconditionally once
  `onSlotView` made a slot clickable at all (a real mutation-safety regression, now locked in by a
  dedicated test). Verified: full `npm run validate` (14/14), 5 new unit tests + 4 new component
  tests, and a real screenshot of the inspector rendering correctly on a **planning-closed**
  match. Full account: `docs/domain/touchline-atlas-provenance.md` §23.
- **Rotations** (`src/components/matches/planned-rotation-panel.tsx`): the changes list was a
  flat, individually-bordered card per row — arguably the exact "disconnected substitution-card
  grid" the spec warns against. Replaced with the same `TouchlineTimeline`/`TimelineItem`
  primitives Today already uses — a pure visual wrapper swap; every existing control inside each
  row (move/edit/remove, status pill, notes) is unchanged. A new pure function,
  `computeRotationTimelineStates()`, maps each change's already-known status to a timeline node
  state (`APPLIED` → done, first non-applied → next, rest → later) — no new query. The three
  separate diagnostic boxes (validation issues, generation notes, coverage checks) were
  deliberately left unconsolidated — genuinely different domain concepts, forcing them into one
  generic warnings widget would blur real distinctions the UI-Lab's own simplified fixture never
  had to represent. Verified: full `npm run validate` (14/14), 5 new unit tests, and a real
  screenshot. Full account: `docs/domain/touchline-atlas-provenance.md` §24.

This is a follow-up to ADR-0134 (Touchline) and ADR-0135 (Touchline Finish & Visual Convergence
follow-up). It does not replace either — Touchline's tokens/theme system and the Finish
programme's widget/pitch/control-glass primitives are the foundation this bundle builds
composition on top of. This ADR records the durable rules established by the
`.matchboard-work/matchboard_touchline_design_atlas_implementation_followup_2026-09-11/` bundle
and implemented in this pass.

## Context

Where ADR-0134/0135 converged Matchboard's visual *material* (tokens, typography, widget/pitch
anatomy), the Design Atlas bundle is a composition/information-architecture convergence: it
supplies a golden-reference atlas and per-route composition specs for 31 routes (Today, League,
History, Round Board, match-detail sub-tabs, Events, Players, Insights, Opponents, Teams, Season,
Formations, Groups, Rules, Settings, More, Peer reviews, Invitation, and a shared system-states
gallery) and requires an agent implementing it to act strictly as an *implementer*, not a
designer: no product-shape decisions, no page-hierarchy decisions, no widget-selection decisions
beyond what the bundle specifies. The bundle's own execution sequence is a 14-step pipeline with
three hard human-approval gates (A, B, C); this ADR covers Phases 0–3, ending at Gate A.

## Decision

1. **Golden reference images are composition authority (hierarchy, density, widget anatomy,
   grouping), never domain-data or navigation-structure authority.** Where a golden image implies
   a product-shape change unsupported by canonical Matchboard data or by a standing,
   repeatedly-reinforced product decision, the standing decision wins and the conflict is recorded
   rather than silently resolved either way. The single most consequential instance: the golden
   atlas boards' sidebars show more items than the real navigation; the 5-item Today/League/
   Events/Players/More primary navigation (AGENTS.md "Canonical routes", Phase 2.4) is unchanged.
   See `docs/domain/touchline-atlas-provenance.md §0` for the full register of 17 such
   corrections (opponent-tendency vocabulary, no percentage strength scores, no external
   standings table, no invented accent-color picker, no photos, no map, no fabricated player
   attributes, etc.).
2. **Every new field flows through one classified provenance path**: canonical domain data →
   a pure, DB-free, unit-tested presentation view-model builder in `src/lib/touchline/presentation/`
   → a semantic Touchline widget → route composition. Fifteen view-model modules exist (Today,
   League, History, Insights overview, Player list, Player detail, Event list/detail, Event
   squad, Match detail/planning-hub, Opponents list/detail, Teams overview/detail, Season,
   Round Board, Peer reviews), each carrying a `Sources:`/`Derived:` provenance comment
   classifying every field as `EXISTING_DIRECT` / `EXISTING_QUERYABLE` / `DERIVED_PRESENTATION` /
   `CONDITIONAL`, with 33 passing unit tests. No field is invented data to fill a screenshot; a
   full `PROHIBITED_ILLUSTRATIVE` register (`docs/domain/touchline-atlas-provenance.md §10`)
   names golden-image details with no real data owner (team logos, shot/possession tracking,
   opponent player names, cooperating-club lists, work-rate/style attributes, notification
   preferences) that were deliberately not built.
3. **A widget/viz library extends, not duplicates, the existing Touchline Finish primitives.**
   Thirteen new named widgets (`src/components/touchline/widgets/`) and ten viz primitives
   (`src/components/touchline/viz/`, including `DotComparison` — ADR-0125's originally
   spec-approved-but-unbuilt ninth evidence primitive) either wrap an existing production
   component (`NextMatchHero` over `OperationalMatchCard`; lineup/tactics/formations composition
   reuses the existing production `TacticsBoard`/`PitchPlayerToken`/`BenchRail`/
   `PositionFitList`/`TouchlineInspector` directly, never a second pitch) or compose the shared
   `TouchlineWidget` primitive, which gained five new tone values (`hero`/`feature`/`support`/
   `scan`/... — see `touchline-widget.tsx`) reconciled with its three original tone names as
   aliases. `PitchExposure` reuses the existing `POSITION_GRID` lookup (now exported from
   `position-map.tsx`) rather than a second hard-coded position map.
4. **Phase 3's UI Lab is route-complete**: all 31 matrix routes plus the Phase 2 widget/viz
   gallery render under `/dev/ui-lab/atlas/` (dev-only, unauthenticated tooling route, unchanged
   security boundary from ADR-0123/existing `PUBLIC_ROUTES` treatment of `/dev/**`), each backed
   by realistic, explicitly-fictional fixture data typed against the real view-model input
   contracts. No production route was migrated, touched, or restyled.
5. **Hard Gate A is a stop condition, not a formality.** Per the bundle's own contract, the
   implementing agent must never self-certify visual fidelity. Phases 4 onward (high-identity
   route migration, football work-surface migration, remaining routes, brand/PWA, transitional
   Product-Surface-1.0 removal, full regression, final approval) do not begin until a human
   reviews the Phase 3 UI Lab and explicitly approves it.

## What shipped in this pass (Phases 0–3)

- **Phase 0 — inventory & provenance**: `docs/domain/touchline-atlas-provenance.md`, covering 17
  golden-reference corrections, per-route-family provenance tables for all 9 route families, the
  `PROHIBITED_ILLUSTRATIVE` register, and the navigation-scope decision restatement.
- **Phase 1 — presentation view models**: 15 modules under `src/lib/touchline/presentation/`
  (see Decision §2), each with unit tests under `__tests__/` (33 tests, 6 suites).
- **Phase 2 — widget/viz library**: 13 widgets (`src/components/touchline/widgets/`), 10 viz
  primitives (`src/components/touchline/viz/`), the `TouchlineWidget` tone extension, and the
  `/dev/ui-lab/atlas/components` gallery page demonstrating all of them against fixture data.
- **Phase 3 — route-complete UI Lab**: `src/app/dev/ui-lab/atlas/fixtures.ts` (one shared,
  realistic, explicitly-fictional fixture set across every route) and 30 route-composition pages
  under `src/app/dev/ui-lab/atlas/routes/`, plus an `/dev/ui-lab/atlas` index page enumerating all
  of them. Screenshots for every route at desktop (1440×900) and mobile (390×844) viewports were
  captured against the running dev server and archived outside the repository (development
  evidence, not a committed baseline — see "Screenshots" in the accompanying report).

**Explicitly not done in this pass** (Phases 4–10, per `13_IMPLEMENTATION_PHASES_AND_GATES.md` —
Hard Gate A has since been approved, see Status above): any production route migration, brand
mark/icon/PWA regeneration, removal of Product Surface 1.0 residue, and full acceptance-gate
verification / public-doc screenshot regeneration. These begin in a follow-up ADR/PR sequence
starting with Phase 4.

## Consequences

- Future Design Atlas work (Phases 4+) has a settled, tested provenance/composition foundation to
  build production migration on, rather than re-deriving field sourcing or widget contracts
  per-route.
- The 17-item golden-vs-domain correction register and the `PROHIBITED_ILLUSTRATIVE` register are
  now durable references — a future phase must not silently reopen a decision already recorded
  there without a new explicit maintainer decision.
- No behavioural, security, or production-visible change occurred in this pass; standard
  production verification gates (`npm run validate`) still apply and passed clean on this branch.

## References

- `.matchboard-work/matchboard_touchline_design_atlas_implementation_followup_2026-09-11/` (the
  full bundle: `CODING_AGENT_PROMPT.md`, `00`–`14` spec documents, golden reference images,
  `data/route-composition-matrix.json`)
- `docs/domain/touchline-atlas-provenance.md`
- ADR-0134 (Touchline), ADR-0135 (Touchline Finish & Visual Convergence follow-up)
- ADR-0125 (Reference Convergence: Match Presentation / Timeline / Evidence Story), ADR-0129
  (Exact positional semantics), ADR-0130 (Product Surface 1.0)
