# ADR-0134: Matchboard Visual Identity & Frontend Reset 1.0 ("Touchline")

## Status

Accepted (2026-09-10). Implementation in progress:

- **Phases 0–3** delivered (theme foundation + `/dev/ui-lab` with the seven golden screens),
  PR #489.
- **UI Lab approved** (2026-09-10) — production-surface migration authorised.
- **Phases 5–9 complete.** `.touchline` is applied **per-surface as an island**
  (`class="touchline"`), not globally on the shell — a global scope made axe-core mis-composite
  unmigrated Product Surface 1.0 components and forced a dark pin anyway (see #490). Every
  island was initially dark-pinned (`data-theme="dark"`) during migration; Phase 9's final part
  removed that pin from every surface that passed a light-mode `axe-core` audit (32 of 48 —
  see the Phase 9 entry below for the 16 still-pinned exceptions and why). The shell nav / top
  bar each carry the island; each migrated
  page wraps its own root; unmigrated pages are untouched PS 1.0. Migrated: shell nav + top bar, **League** (`/fixtures`), **Today** (`AssistantCommandCentrePage`), **Events** (list + `/events/[eventId]` header + event-day timeline), **match detail** (header + actions) + **Follow Live**, **Insights** (hub; sub-route clients island-wrapped, deep editorial redesign is a tracked follow-up), **Round Board** (`/rounds/[matchRoundId]` — page island-wrap, `TouchlineButton` swap, de-zinced; all drag/drop/touch/move/repair mutation logic frozen), the **match-detail Lineup / Tactics / Rotations tabs + formation editor** (`match-tactics-panel`, `planned-rotation-panel`, `pitch-formation`, `player-picker`, `formations-builder` — `TouchlineButton`/`TouchlinePageHeader` swaps, de-zinced, formation editor island-wrapped; all lineup/rotation/slot mutation + `dnd-kit` logic frozen), **Event squad planning** (`event-detail.tsx` squads/lineup tab bodies, `event-matches-tab`, `event-match-lineup-panel`, `event-squad-lineup-board`, `event-guest-player-pool-panel`, `event-match-availability-panel` — de-zinced, danger/success tokens, `TouchlineButton` swap; `create-event-form.tsx` (`/events/new`) island-wrapped with `TouchlinePageHeader` + `TouchlineButton`; all squad-generation/assignment/support/availability mutation logic frozen), and the **live-reporting client** (`live-match-client.tsx`, `planned-rotation-prompt.tsx`, `league-live-match-with-rotation.tsx` — every raw `bg-emerald-*`/`bg-blue-*`/`bg-red-*`/`bg-amber-*`/`bg-green-*` operational-status color replaced with `--danger`/`--warning`/`--success`/accent tokens, "Start live reporting"/"Goal for us" now the one dominant accent-fill primary action per bundle's "one dominant action per active operational context" rule; every clock/score/event-recording/local-sync/realtime mutation path frozen), and **post-match reporting** (`post-match-report-shell.tsx`, `post-match-page.tsx`, `event-match-report-panel.tsx`, `legacy-match-feedback-section.tsx`, `team-reflection-section.tsx`, `match-combination-evidence-panel.tsx`, `football-observation-section.tsx`, `observation-section.tsx` — the last two were pre-existing raw light-mode Tailwind (`gray-*`/`green-*`/`amber-*`) outliers with no dark styling at all, fully token-aligned; League's post-match route page island-wrapped so its five sibling sections share one palette; report completion/reopen, goal/assist/attendance edits, opponent/team/football observation writes all frozen), and **Players list + Player detail** (`/players`, `/players/new`, `/players/[playerId]` — `players-page-client`, `player-editor-form`, `player-profile-header`, `season-overview-table`, `current-round-attention-table`, `manage-base-groups-view`, and the remaining panel/table components; a genuine pre-existing PS0-era `app-hairline`/`rgba(...)` outlier in the editor form fully token-aligned; `player-table.tsx` confirmed dead/unreferenced and deliberately left untouched — restyling unreachable code would misrepresent it as a migrated surface), **History** (`/history` — `movement-overview.tsx`, `export-panel.tsx`, `history-table.tsx`; the export panel's format/visibility toggles and download control, and the table's core/float/movement summary tiles and row chips, all token-aligned; export-panel's Download control became a `TouchlineButton` primary; every finalized-selection read and export computation frozen), and **Opponents** (`/opponents`, `/opponents/[opponentTeamId]`, `sporting-level-section`, `opponent-tactical-tendency-section`, `opponent-combination-evidence-section`, `opponent-combination-situational-summary`, `opponent-team-select`, `previous-encounters-display`/`previous-encounters-panel` — the latter two had a genuine ADR-0130 doctrine violation, not just an unmigrated token: `resultColour()` coloured W green / L red, exactly the "a loss is not danger red, a win is not a success fill" rule; fixed to the same weight-only `outcomeTint` pairing `match-presentation.tsx` already established (win=foreground, loss=muted+medium, draw=soft) rather than just token-aliasing the wrong colours; every opponent/evidence/encounter read is frozen), and **Season** (`/season`, `/season/new` — `season-client.tsx` (671 lines, the biggest single-file token migration of this programme so far), `season-finalize-controls.tsx`, `create-league-season-form.tsx`; the categorical selection-role legend — Core/Support/Development/Squad-repair/Drop cell colours mirroring `tactics-board.tsx`'s own `ROLE_COLORS` precedent — is deliberately left as literal hues, not outcome/severity coloring; genuine severity indicators (finalized/draft/warnings/double-load/readiness counts) mapped to `--success`/`--warning`/`--danger`; finalize/unfinalize controls become `TouchlineButton`; every matrix/movement-path/player-timeline read and the finalize/unfinalize/create-season mutations are frozen), and **Groups** (`/groups`, `/groups/[groupSlug]`, `/groups/new`, `/groups/[groupSlug]/settings` — these four client components were already almost entirely token-clean before this pass, needing only island-wrap + one `Button`→`TouchlineButton`/`--danger` fix in `guest-players-panel.tsx`; group/access/movement-path mutations frozen), and **Rules** (`/rules` — a genuine PS0-era outlier, dense with raw zinc/rgba chrome and custom gradient-pill submit buttons; `rotation-path-card.tsx`'s and `rules-form.tsx`'s categorical role-badge legends (Support/Development/Squad repair) deliberately left as literal hues, same `ROLE_COLORS` precedent; five gradient-pill submit buttons became `TouchlineButton` primary; rule/rotation-path CRUD frozen), and **Settings** (`/settings` — `org-settings-client.tsx` island-wrapped, de-zinced/de-raw-coloured (danger-zone/status-badge/create-principal red-green literals -> `--danger`/`--success`, a genuinely undefined `var(--surface-1)` token reference fixed to `--tl-c-surface-hover`); ships the new **Appearance** section using the existing `AppearanceControl` primitive, wired to the already-mounted `ThemeProvider` — functional immediately for the majority of the app still on Product Surface 1.0 (which has no dark pin), with the Touchline-migrated islands still dark-pinned as a documented, temporary gap closed by the next PR; machine-principal/org CRUD frozen). Phase 9's final part — **the light-mode WCAG-AA audit + dark-pin removal** — is also now **complete**: a static contrast-ratio computation over every real light-token pairing (all pass with margin; `--text-disabled` and a decorative divider border are the two apparent "failures", both legitimately WCAG-exempt — inactive UI components and non-sole-conveyor decorative borders), plus a full `axe-core` browser scan (zero violations, both themes, desktop+compact) against all 6 `/dev/ui-lab` fixture screens — which render the exact same shared Touchline primitives every migrated production surface uses — found and **fixed a real, severe bug** before removing any pin: several files' "categorical legend" colors (Core/Support/Development/Squad-repair badges) were literal Tailwind pastel-on-dark-wash classes (e.g. `text-emerald-300` on `bg-emerald-900/30`) built only for the dark canvas — computed contrast on white ranged 1.4–1.9:1, catastrophically short of 4.5:1. Fix: the dark pin is removed from 32 of the 48 previously-pinned files (Round Board, match-detail Lineup/Tactics/Rotations, Events, live-reporting, post-match reporting, Players, History, Opponents, Groups, Rules, Settings, and the shell nav itself); the 15 Insights sub-route clients and `season-client.tsx` **stay dark-pinned** — their categorical legends were never token-migrated, so this simply extends the *already-documented* bundle §8 Insights-redesign deferral to also cover `season-client.tsx`'s identical pattern, rather than shipping a real accessibility regression to hit an artificial "done" date. `rotation-path-card.tsx`'s one raw-hex SUPPORT badge (`#c0a0db`, 2.26:1 on white) — a subcomponent of the now-unpinned `/rules` page — moved to the existing dual-theme `--tl-c-evidence`/`--tl-c-evidence-subtle` tokens (5.9–6.7:1 both themes); five smaller residual literals in otherwise-clean files were fixed too. The CI-run functional acceptance suite's real `e2e/accessibility.spec.ts` scan (against the actual authenticated Test-slot deployment — stronger evidence than the UI-Lab fixture proxy, since it exercises real seeded data and every shared component in its real page context) then caught a further genuine regression the static/UI-Lab audit missed: three cross-cutting shared components with raw dark-only literals that render inside now-unpinned surfaces — `ResponsiveTableCard`'s compact-card shell (`bg-[rgba(12,15,20,0.45)]`/`text-zinc-50`, exposed on `/opponents`'s phone/tablet card view, measured 1.04–2.94:1), `EmptyState`'s title (`text-zinc-100`, plus its description's `--text-muted`/`--info-subtle` pairing scoring a borderline 4.44:1, tightened to `--text-soft`), and `InstallPwaCard`'s title (`text-zinc-100`, rendered on Today) — all moved to token equivalents (`--foreground`/`--text-soft`/`--surface-muted`/`--border-soft`) with no dark-mode visual change (the tokens' dark values already match the literals they replaced).

  A subsequent pass closes out the rest of Phase 9's originally-scoped item list
  (`14_IMPLEMENTATION_PHASES.md` §9 named Groups, Rules, Settings, **Peer reviews, Decision
  review surfaces, More, Help, sign-in** — only the first three had actually shipped so far,
  despite the "Phase 9 complete" claim above being written before the remaining five were
  addressed; corrected here rather than left standing). **Peer reviews** (`/reviews` —
  `review-list-client.tsx` was already fully token-clean; island-wrap + `TouchlinePageHeader` +
  `TouchlineButton` swap; resolve/cancel mutations frozen). **Decision review surfaces**
  (`due-decision-review-section.tsx`, already rendering inside Today's migrated island —
  `TouchlineButton` swap only). **More** (`/more` — already token-clean; island-wrap +
  `TouchlinePageHeader` swap). **Help** (`help-drawer.tsx` — a real, distinct bug: it is
  portalled to `document.body` (to escape the top-bar's `backdrop-blur` containing-block issue
  documented elsewhere in this file), which also means it escapes any ancestor `.touchline` CSS
  scope — its portal root needed its own explicit `.touchline` class, or every token inside it
  would keep resolving to the plain always-dark `globals.css` values no matter what theme the
  rest of the app is in). **Sign-in** (`(auth)/layout.tsx` + `signin`/`error` pages — island-wrapped
  but **deliberately kept `data-theme="dark"`-pinned**: this file's own "Auth layout rules" already
  mandate the dark theme for auth pages unconditionally, a pre-existing product/security decision
  distinct from every other pinned-then-unpinned surface in this ADR — not a fresh migration
  deferral, so the pin here is permanent, not a TODO).

  This pass also traced the exact same bug class discovered above to its real source: a set of
  **shared, cross-cutting primitives** — `SectionHeader`, `DataTable`, `PlayerChip`,
  `BottomSheet`, `MetricTile`, `WarningCard`, `IntentCard`, `TabRail`, `PlayerMagnet`, `Dialog`,
  `InlineEditField`/`InlineEditSelect`/`InlineEditSegmented`, `Button`, `PageHeader`, `Toast`, and
  shell chrome (`CommandPalette`, `HelpDrawer`, `UserNav`) — all carried the identical raw
  `text-zinc-50`/`-100`/`-200`/`-300` literal pattern already fixed once in `ResponsiveTableCard`/
  `EmptyState`/`InstallPwaCard`. Since these are consumed by essentially every surface migrated in
  Phases 5–9 (not just the five above), this was latent in production already — invisible only
  because every consumer was still dark-pinned at the time. All moved to `--foreground`/
  `--text-soft` equivalents, verified to leave dark-mode appearance unchanged. **Phase 5 through
  Phase 9 are now genuinely all complete**, including Phase 9's full originally-scoped item list. Phase 10 (remove the superseded Product Surface 1.0 system) is next. The compact bottom nav is
  **opaque** (a `position: fixed` translucent surface has no determinate background for WCAG-AA
  contrast checking; `04 §12` already mandates a solid fallback). Phase 9 removes the pins +
  ships the appearance control after a light AA audit; Phase 10 hoists `.touchline` to the shell
  root and deletes the PS 1.0 `:root` layer.

## Context

Product Surface 1.0 (ADR-0130) improved consistency but stayed too close to the previous
visual language — dark-only surfaces, a muted-sage accent, restrained cards, incremental
layout change. The maintainer commissioned a **visual reset**, not another refinement pass:
a completed, frozen design direction delivered as the normative bundle
`.matchboard-work/matchboard_visual_identity_frontend_reset_2026-09-10/` (gitignored working
bundle). This ADR records the decision to adopt it and the durable rules that outlast the
bundle.

The internal codename for the visual language is **Touchline**. It is not shown to users; the
product remains **Matchboard**.

## Decision

### 1. The bundle is the visual authority

`.matchboard-work/matchboard_visual_identity_frontend_reset_2026-09-10/` supersedes ADR-0130's
visual doctrine (see ADR-0130's amended Status). Its frozen decisions
(`01_DECISION_FREEZE_MANIFEST.md`) and exact specifications are authoritative over the current
implementation. Existing domain / security / tenancy / audit / fairness / live-state /
evidence / positional-safety behaviour is **not** changed by this programme
(`17_FUNCTIONAL_FREEZE.md`).

### 2. Brand identity

The existing Matchboard mark (`public/brand/logo.svg`, a monochrome single-path trace;
`logo.eps` vector source) is retained and must not be redesigned. New identity comes from
colour, typography, score/time treatment, spacing, materials, motion, and recurring
match/timeline/evidence compositions — not from the mark. Missing PWA/favicon/monochrome/
maskable derivatives may be generated from the existing mark without changing its geometry.

### 3. Appearance modes

Matchboard supports `system`, `light`, and `dark`. Default is `system`. Storage key
`matchboard-theme`; explicit choice stamps `data-theme="light" | "dark"` on `<html>`; system
omits the attribute and follows `prefers-color-scheme`. A minimal inline pre-hydration
initializer prevents a flash to the wrong explicit theme. `next-themes` is **not** added — the
behaviour is small enough to own locally (`src/lib/theme/`).

**Transitional dark pin (Phases 5–8).** The `.touchline` app-shell wrapper carries a hardcoded
`data-theme="dark"` until Phase 9 ships the Settings → Appearance control. During the phased
rollout, unmigrated surfaces still use Product Surface 1.0 CSS with no audited light palette, so
enabling `system`/light app-wide would surface WCAG-AA contrast failures on those pages (caught
by the acceptance a11y suite). Phase 9 removes the pin (not the `.touchline` class) alongside
the appearance control, after the light palette + every surface pass gate N.

**Light-palette AA adjustments.** Three of the bundle's frozen light values (`03 §5`) fall just
below WCAG-AA 4.5:1 on the light canvas/surfaces and are darkened in `src/app/touchline.css`
per the bundle's own `10 §12` ("ensure readable contrast in bright conditions; do not merely
invert dark tokens") and gate N: muted text `#747e88 → #616973`, accent `#587400 → #4f6c00`;
and the on-accent-fill text in **light** is white (`#ffffff`), not `#101500` — matching
`12_COMPONENT_CONTRACTS.md §16` ("light uses `#587400` + white text"), which the initial token
file did not encode. Dark palette values are unchanged.

Dark remains the primary brand/reference appearance; light is a first-class production theme
(a real sideline mode, not an inverted dark palette).

### 4. Tokens

The normative token set is `data/touchline-tokens.css` in the bundle, mirrored into
`src/app/touchline.css`. Primary dark accent is luminous yellow-green `#C7F54A`
(`#587400` as light-theme text/control colour). Accent is **sparse** — identity, current
selection, primary action, own-team emphasis, selected data — never routine surface fill.
Football outcome is never `--danger` (loss) or `--success` (win); `--live` is its own colour.

Geometry: 8 px controls, 10 px objects, 12 px feature/selected objects, 16 px overlays,
6 px status markers. Routine pill shapes are prohibited. Repeating pitch-line background
graphics are prohibited.

### 5. Typography

Geist Sans remains the UI typeface (body, labels, player names, team names, navigation,
forms, ordinary metadata). **Barlow Condensed** (weights 600/700, `next/font/google`) is added
**only** for sports/numeric display roles: hero score, list score, prominent live clock,
week/round marker, major evidence number. Names are never set in condensed type.

### 6. Materials

Two layers. **Content layer**: opaque/crisp — canvas, flat surface, dividers, alignment,
typography. **Control layer**: may use translucency/blur/subtle border/separation shadow —
compact bottom navigation, floating desktop nav shell, bottom sheets, popovers, sticky
action bars, floating local selectors. Glass is prohibited on match rows, player rows,
evidence stories, settings sections, and routine cards. Cards are exceptional, not the
default grouping device — content defaults to open canvas.

### 7. Product-area grammar (durable owners)

| Area | Grammar | Component owners |
|---|---|---|
| Today | Editorial + temporal | `Timeline`, `OperationalMatchCard`, `ContextRail` |
| League / History | Sports scorebook | `ScorebookRoundSection`, `ScorebookMatchRow` |
| Match / Follow Live | Scoreboard | `MatchScoreHeader`, `LiveScoreboard`, `LiveScoreStrip` |
| Events | Timeline-first temporal | `Timeline`, `TimelineMatchNode`, `ContextRail` |
| Round Board / planning | Calm dense workbench | `WorkbenchToolbar`, `RosterColumn`, `RosterRow`, `Inspector` |
| Insights / evidence | Authored data story | `EvidenceStory` + approved visual primitives |
| Settings / Rules / Groups | Quiet utility | conventional grouped forms |

The canonical normalized `MatchPresentation` projection (ADR-0125) remains the sole owner of
home/away, score orientation, own-team side, lifecycle, result outcome, clock, cancellation,
and planning/report attention. Presentation components consume it; they never re-derive it.

Approved evidence visual primitives: `PhaseDistribution`, `OutcomePair`, `TrendLine`,
`RangeBand`, `SequenceStrip`, `DotComparison`, `ExposureMap`, `CombinationTimeline`. Pie
charts, gauges, speedometers, radar charts, and player-ranking bars are prohibited. Evidence
answers one question per story; confidence and sample size stay explicit; interpretation is
correlational, never causal.

### 8. Navigation

Compact (`<600px`): floating translucent bottom nav (62 px, 16 px radius, 12 px side inset,
safe-area aware, 24×3 px accent indicator bar — never a pill). Medium (600–839): 72 px rail.
Expanded (`≥840`): 216 px sidebar that recedes behind content (3 px accent leading marker on
the active item, no large pill). Five destinations unchanged: Today, League, Events, Players,
More.

### 9. Motion

Existing `motion` package only; no new animation framework. Motion communicates
continuity/state — active-nav indicator travel, selected sibling indicator travel, sheet
rise/fall, adjacent day/event shift, local evidence expand, one restrained score-value
transition, workbench inspector slide/fade. Decorative animation (celebratory score,
confetti, perpetual pulse beyond a live dot, entrance cascades, bouncing buttons,
input-blocking route animation, parallax) is prohibited. `prefers-reduced-motion` and reduced
transparency are respected; nav stays legible without `backdrop-filter`.

### 10. Process — UI Lab is a hard human gate

The previous visual programme migrated the whole app before the visual target was proven.
This programme reverses that: a development-only `/dev/ui-lab` (404 in production) renders the
seven golden reference screens (league desktop/compact, today compact, event-day compact,
round-board desktop, follow-live compact, insights compact) from representative in-memory
fixture data. Screenshots are captured to `artifacts/visual-reset/ui-lab/`. **No production
route family is migrated until a human approves the UI Lab.** After approval, UI Lab
components become the production primitives and migration proceeds in the phases of
`14_IMPLEMENTATION_PHASES.md`. This UI Lab / golden-gate process is the required procedure for
any future major visual change.

### 11. Documentation

`docs/product/adaptive-interaction-design.md` is rewritten as the current frontend design
reference on approval; ADRs are append-only and superseded via a new ADR (this one). AGENTS.md
carries a concise frontend-authority pointer, not duplicated visual measurements. The product
is never called "Touchline" in user-facing or public documentation.

## Consequences

- A second visual token layer (`src/app/touchline.css`, activation class `.touchline`) and a
  `src/components/touchline/` primitive namespace coexist with the Product Surface 1.0 system
  during Phases 5–9. Phase 10 removes the old tokens, compat aliases, and obsolete components;
  no `Old`/`V2`/`Legacy` visual component families remain in production.
- The final production app must look materially different from Product Surface 1.0 at first
  glance. An incremental token swap does not satisfy this programme.
- Icon derivatives generated: dark/light tile treatments, monochrome variant, favicon sizes,
  Apple touch icon, PWA 192/512, maskable 192/512 — all from the unchanged mark geometry.
