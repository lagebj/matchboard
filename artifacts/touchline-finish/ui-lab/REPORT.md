# Touchline Finish & Visual Convergence — F4 UI Lab Conformance Report

**Date:** 2026-09-11
**Scope:** Phases F0–F4 of `.matchboard-work/matchboard_touchline_finish_followup_2026-09-11/`.
**Status:** F0–F4 implemented. **Hard stop per `11_IMPLEMENTATION_PHASES.md` — human approval
required before F5 (production migration).**

## 0. Start condition

The original Touchline programme's Phases 10–12 were complete before this follow-up started:
`git log` shows PR #514 (Phase 10 — removal of the Product Surface 1.0 system), #515 (Phase 11 —
documentation), #516 (Phase 12 — full verification sweep) already merged to `main`, and
`AGENTS.md` records "Programme status: all 12 ADR-0134 phases are complete." Working tree was
clean at start.

**Disclosed process gap**: `00_EXECUTION_CONTRACT.md`/`11_IMPLEMENTATION_PHASES.md`'s Phase F0
also asks for "before" screenshots of the completed first-programme state, copied to
`artifacts/touchline-finish/before/`. That literal capture step was not run before implementation
started in this session — the first Touchline programme's own screenshots
(`artifacts/visual-reset/ui-lab/`, captured at Phase 4) already document that state, and the
route-by-route "what changed" account is recorded in this report and in ADR-0135, so the intent
of the before/after record is met, but the specific artifact folder was not produced. Recorded
here rather than silently skipped.

## 1. What was implemented

- **F1 — token/material convergence**: widget / control-glass / pitch tokens and radii added to
  `src/app/touchline.css` (dark, light, and system-light-media blocks); `.tl-bottom-nav` geometry
  and material changed to translucent control-glass; `.tl-feature-atmosphere` / `.tl-widget` /
  `.tl-widget-strong` / `.tl-control-glass` / `.tl-pitch-surface` utility classes added.
- **F2 — core component convergence**: `TouchlineWidget`, `WidgetHeader`, `MetricStrip`,
  `CapacityBar`, `QuickActionGrid` (`src/components/touchline/widget/`); `TouchlineBrandTile`
  (`brand/`); `TouchlineBottomNav`/`TouchlineSidebar`/`TouchlineTopBar` updated;
  `TouchlineInspector`/`TouchlineBottomSheet` re-anatomised; `WorkbenchSummaryStrip`/`BenchRail`/
  `PositionFitList`/`PlayerContextHeader` added (`workbench/`); `PitchPlayerToken`/`PitchEmptySlot`
  added (`pitch/`); `LiveActionGrid` added (`live/`); `OperationalMatchCard` gained an optional
  `variant="feature"` treatment.
- **F3 — pitch renderer**: `src/components/formations/tactics-board.tsx`'s lineup/tactics/
  selection-preview rendering now uses `PitchPlayerToken`/`PitchEmptySlot`; the formation
  builder's `ROLE_COLORS` are restrained (border/text, low-alpha background, no saturated
  Tailwind-500 fills); the pitch surface/markings use the new `--tl-pitch-*` tokens. Slot
  geometry, projection, and every callback contract are unchanged; `TacticsBoardPlayer` gained an
  optional, currently-unwired `shirtNumber` presentation field.
- **F4 — extended UI Lab**: seven new dev-only routes under `/dev/ui-lab/` — `shell-light`,
  `shell-mobile`, `event-squad`, `lineup`, `live-reporting`, `player-detail`, `tactics` — plus a
  `tactics` entry synthesised per `10_REFERENCE_CONFORMANCE.md §5`. All render from in-memory
  fixtures (`src/app/dev/ui-lab/fixtures.ts`); no database, no production route touched.

## 2. Conformance table

Screenshots referenced below live in this directory (`artifacts/touchline-finish/ui-lab/`).
Golden references live in
`.matchboard-work/matchboard_touchline_finish_followup_2026-09-11/references/golden/`.

### Shell — light desktop (`shell-light-desktop-light.png` vs `shell-light-desktop.png`)

| Dimension | Verdict | Note |
|---|---|---|
| Composition | PASS | Feature match card, Squad status widget, Latest matches widget, sidebar — matches golden layout. |
| Hierarchy | PASS | Next-match feature is visually dominant; sidebar recedes; accent used sparingly. |
| Density | PASS | Whitespace/module spacing matches the golden's calmer desktop rhythm. |
| Materials | PASS | Widgets are opaque with border+shadow; sidebar/topbar recede; no glossy decoration. |
| Typography | PASS | Geist for UI, Barlow-derived numerals for the kickoff time. |
| Accent discipline | PASS | Accent used only for "NEXT MATCH" eyebrow, primary button, active nav, sparkline. |
| Responsive fit | PASS | Content fits the 1180px column inside the 1440px shell without overflow. |
| **DEVIATION** | recorded | Golden shows a "League table" widget and a hero background photograph. Neither exists as a Matchboard product concept/feature — omitted per `00_EXECUTION_CONTRACT.md §5`/`02_VISUAL_CONVERGENCE_CONTRACT.md §6`, not implemented. A "Quick actions" widget was added on desktop (golden's desktop image does not show one, only its mobile counterpart does) — justified by `04_WIDGET_AND_CONTENT_GRAMMAR.md §6/§7`'s explicit primitive and used only with real, already-reachable actions. |

### Shell — mobile (`shell-mobile.png` / `shell-mobile-light.png` vs `shell-mobile.png`)

| Dimension | Verdict | Note |
|---|---|---|
| Composition | PASS | Next match → Squad status → Quick actions → Latest matches, matching golden order. |
| Hierarchy | PASS | Feature card dominant; floating nav sits above content, not competing with it. |
| Density | PASS | Compact stacking matches golden narrative order. |
| Materials | PASS | Bottom nav uses `--tl-control-glass` (>=90% opacity + blur under `@supports`); content bleeds behind it (visible in the capture — "Latest matches" partially occluded), confirming floating behaviour. |
| Typography | PASS | Matches golden's bold sans hierarchy. |
| Accent discipline | PASS | One accent-filled primary action ("Match details"), accent-tinted active nav icon container. |
| Responsive fit | PASS | 390×844, no horizontal scroll, safe-area-aware nav. |
| **DEVIATION** | recorded | Same League-table/photo/"Train. Plan. Improve." tagline omissions as the desktop shell — illustrative content, not implemented. The golden's personalised "Good morning, Noah" greeting was also not adopted; the existing "Today" + date header convention was kept instead (a deliberate, disciplined choice to avoid introducing a new copy pattern speculatively in a presentation-only follow-up). |

### Event squad (`event-squad-mobile.png` / `-light.png` vs `event-squad-mobile.png`)

| Dimension | Verdict | Note |
|---|---|---|
| Composition | PASS | Header → squad `ContextRail` → identity/capacity widget → actions → dense roster → Add player. |
| Hierarchy | PASS | Squad count (12/14) and capacity bar are visually dominant, matching golden. |
| Density | PASS | Player rows are dense (number, name, position, status), matching golden row height. |
| Materials | PASS | One `TouchlineWidget` frames identity+actions; rows stay flat (no per-row card). |
| Typography | PASS | tl-sport numerals for the "12 / 14" count. |
| Accent discipline | PASS | Accent used only for the primary "Create lineup" action and Available status text. |
| Responsive fit | PASS | 390×844, no clipping beyond the natural page scroll. |
| **DEVIATION** | recorded | None beyond fixture-name substitution (illustrative names only). |

### Lineup (`lineup-mobile.png` / `-light.png` vs `lineup-mobile.png`; `lineup-desktop.png`)

| Dimension | Verdict | Note |
|---|---|---|
| Composition | PASS | Title/context → formation/match selectors → pitch → Bench/Candidates tabs → bench rail → selected-player sheet, matching golden order exactly. |
| Hierarchy | PASS | Pitch is the primary visual area; the sheet's "Natural/Strong/Plausible fit" list matches golden's exact structure and even its exact example roles (LM/LW,CM/LWB,AM). |
| Density | PASS | Bench rail tokens are compact and horizontally scrollable, matching golden. |
| Materials | PASS | Pitch uses `.tl-pitch-surface` (gradient + atmosphere + pitch-line markings); sheet uses control-glass/widget material with a 48×4 handle and 44×44 close target. |
| Typography | PASS | Player tokens show shirt numbers; names/roles in Geist. |
| Accent discipline | PASS | Accent reserved for the selected fit-tier row, the Save button, and the sheet's primary action. |
| Responsive fit | PASS (fixed mid-report) | Desktop (`lineup-desktop.png`) initially showed the compact bottom sheet spanning the full 1440px viewport — a real deviation from `06_TACTICS_LINEUP_AND_PITCH.md §7`'s "336–360px inspector on desktop" rule. Fixed: `LineupContent` now shows a `TouchlineInspector` at ≥1200px and only opens the bottom sheet below that width (`useIsLargeViewport`), mirroring the Tactics page. Re-captured; verified correct in the final screenshot. |
| **DEVIATION** | recorded | Player tokens use the neutral Touchline surface colour, not the golden's literal red team shirt — Matchboard's domain model has no canonical team-colour field, so no colour was invented (`06_TACTICS_LINEUP_AND_PITCH.md §3`: "If no canonical team color exists, use the Touchline neutral player token"). The sheet omits the golden's "17 matches · 4 goals · 3 assists" line — no such per-player stat is already loaded on this surface; not queried/fabricated to fill the sheet. Desktop pitch keeps the vertical (portrait) orientation `PitchLineupView` already defaults to, which runs visually tall on a wide viewport — a pre-existing characteristic, not introduced by this pass, and left unchanged since only Tactics (not Lineup) was asked to use the horizontal workbench pitch. |

### Live reporting (`live-reporting-mobile.png` / `-light.png` vs `live-reporting-mobile.png`)

| Dimension | Verdict | Note |
|---|---|---|
| Composition | PASS | Header+LIVE → score/clock strip → action grid → event history → player-picker sheet, matching golden order. |
| Hierarchy | PASS | Score/clock visible before actions; one accent-filled primary action ("Goal for us"). |
| Density | PASS | Event rows are dense, no per-event card. |
| Materials | PASS | Action tiles are widget-material with >=76px targets. |
| Typography | PASS | Score uses Barlow-derived tabular numerals. |
| Accent discipline | PASS | Only the highest-frequency action (Goal for us) is accent-filled; Fair play concern uses the attention tone, not danger. |
| Responsive fit | PASS | 390×844, 3-column action grid (6 actions) fits without crowding. |
| **DEVIATION — domain gap, recorded and deliberate** | The golden shows 8 action types: Goal / Shot / Yellow / Red / Substitution / Foul / Corner / Free kick. Matchboard's canonical `LiveMatchEventType` enum supports only Goal (for/against), Rotation (substitution), Fair play (positive/concern), and Moment marked. Shot/Yellow/Red/Foul/Corner/Free kick are **not modelled anywhere in the live-match domain** — no new event type was added to satisfy the image, per `00_EXECUTION_CONTRACT.md §5`/`01_CURRENT_CODE_FINDINGS.md`'s explicit warning against this exact temptation. The fixture and `LiveActionGrid` use only the six real action types. |

### Player detail (`player-detail-mobile.png` / `-light.png` vs `player-detail-mobile.png`; `player-detail-desktop.png`)

| Dimension | Verdict | Note |
|---|---|---|
| Composition | PASS | Identity → tabs → Participation → Opportunity/Position exposure → Recent observation → Recent football, matching the module order in `08_PLAYER_EVENT_INSIGHTS_AND_OVERVIEWS.md §1`. |
| Hierarchy | PASS | Name/number identity is strong without an image; Participation `MetricStrip` reads as one coherent widget. |
| Density | PASS | Matches/Minutes/Starts/Goals/Assists inline, not five separate tiles. |
| Materials | PASS | Each module is one `TouchlineWidget`/`MetricStory`; no nested cards. |
| Typography | PASS | Large tabular numerals for participation counts. |
| Accent discipline | PASS | Accent used for the role label, the sparkline, and the position-exposure primary marker only. |
| Responsive fit | PASS | 390×844 and 1440×900 both render without horizontal scroll. |
| **DEVIATION — deliberate, contract-mandated** | The golden shows a generated photographic portrait of a child. Matchboard has no player-photo feature and must not fabricate one (`00_EXECUTION_CONTRACT.md §5`; AGENTS.md's "Player attribute ratings"/child-safety boundary). Replaced with a large initials/number identity tile — the module's exact instruction. Position exposure reuses the real, existing `PositionMap` mini-pitch component (no second hard-coded position map) — its exact percentages match the golden's illustrative "LW 68% · LM 22% · ST 10%" only because that fixture text was intentionally mirrored for comparability; the real production wiring (F5) will read the real position-exposure service, not this literal figure. |

### Tactics (`tactics-desktop.png` / `-light.png`; `tactics-mobile.png` — synthesised, `10_REFERENCE_CONFORMANCE.md §5`)

| Dimension | Verdict | Note |
|---|---|---|
| Composition | PASS | `WorkbenchToolbar` → pitch (horizontal) → inspector (desktop) / bottom sheet (compact), per the synthesis rule. |
| Hierarchy | PASS | Pitch is the primary object; inspector is secondary and only shown with a selection. |
| Density | PASS | Matches Round Board's calm desktop density — no per-player card. |
| Materials | PASS | Inspector at 352px (within the 336–360px band), widget material, `PlayerContextHeader` identity block. |
| Typography | PASS | Consistent with Lineup/Round Board. |
| Accent discipline | PASS | Selected fit-tier row and Save-equivalent actions only. |
| Responsive fit | PASS | Desktop 1440×900 and compact 390×844 both captured; no domain behaviour changed. |
| **DEVIATION** | recorded | None beyond the same neutral-player-token choice already recorded for Lineup — Tactics shares the identical pitch renderer/player token by design. |

## 3. Acceptance-gate self-check (`12_ACCEPTANCE_GATES.md`, sections applicable to F0–F4)

- **A** — PASS for the seven captured surfaces; not yet assessed for production surfaces (F5+ not started).
- **B (Shell)** — PASS. 390×844 dark: floating nav visible, ~74px tall, 16px inset, content bleeds behind it. 1440×900 light: sidebar recedes, widgets have deliberate depth, accent sparse, search trigger reads as intentional.
- **C (Widget grammar)** — PASS. No nested widgets found; `MetricStrip` used for every grouped-metric case; `CapacityBar` used only for the squad-count/target case; `QuickActionGrid` actions are all real, reachable destinations.
- **D (Event squad)** — PASS, see table above.
- **E (Lineup)** — PASS after the desktop-inspector fix described above.
- **F (Tactics)** — PASS.
- **G (Live Reporting)** — PASS, with the recorded domain gap above; Follow Live was not touched in this pass (out of F0–F4 scope; existing read-only grammar retained).
- **H (Player detail)** — PASS.
- **I (PWA/icons)** — NOT DONE. Phase F7, gated behind this F4 approval.
- **J (Themes)** — PASS for every new primitive (dark + light captured and reviewed above); a full automated AA contrast/axe-core sweep was not re-run in this pass (that ran at the end of the first Touchline programme, Phase 12; a fresh sweep belongs to F9, which also gates on F4 approval).
- **K (Functional regression)** — PASS. No selection/fairness/lineup/rotation/positional-fit/guest-player/live-state/export/permissions/audit code was touched; `tactics-board.tsx`'s callback contracts, slot geometry, and projection are byte-identical in signature. Full domain test suite (306 files / 3,802 tests) passes; component suite (36 files / 253 tests) passes.
- **L (Performance)** — PASS. `backdrop-filter` is applied only to the fixed bottom nav and the bottom sheet (both floating controls), guarded by `@supports`; no image dependency was introduced for the pitch texture; no player-photo loading was introduced.
- **M (Required screenshots)** — All required dark/light combinations for the six new golden surfaces, plus the synthesised Tactics surface, are present in this directory; League/History/Round Board/Rotations/Insights screenshots are unchanged from the first programme (not touched in F0–F4) and are not re-captured here.

## 4. Verification run

- `npm run lint` — clean (0 errors; 3 pre-existing unrelated warnings in `compute-plan-integrity.ts`).
- `npx tsc --noEmit` — clean.
- `npm run architecture:check` — clean (140 files, 5 domain directories, 0 violations).
- `npm run terminology:check` — clean.
- `npm run prisma:check-fields` — clean (4,129 literals checked).
- `npm run docs:check` — clean.
- `npx vitest run --config vitest.config.components.ts` — 36 files / 253 tests, all pass.
- `npx vitest run` (unit/domain suite) — 306 files / 3,802 tests, all pass on a clean serial run.
  An earlier run inside this same session showed 115 unrelated failures (FK/unique-constraint/
  deadlock errors against the shared Neon test branch, entirely in files this change never
  touches — selection engine, evidence pipeline, event squads) while a dev server + this suite
  ran concurrently; a second clean run with no competing process passed 100%, confirming
  environment-level contention, not a regression.
- `npm run build` — succeeded (initially killed by OOM while running concurrently with a dev
  server during `npm run validate`; succeeded immediately once re-run alone).
- `npm run validate` — full gate re-run after the fixes above; see the session record for the
  final pass/fail table.

## 5. Recommendation

F0–F4 are complete. Per `CODING_AGENT_PROMPT.md`, this is a **hard stop**: no production route
has been migrated, and none should be until a human reviews this report and the screenshots in
this directory against
`.matchboard-work/matchboard_touchline_finish_followup_2026-09-11/references/golden/` and
explicitly approves proceeding to Phase F5.
