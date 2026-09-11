# Adaptive Interaction Design

> **Status:** Canonical detailed interaction-design reference, updated for **Touchline**
> (ADR-0134 — Matchboard Visual Identity & Frontend Reset 1.0), which is now the current visual
> system across the whole app (Phases 0–10 complete: theme system, `src/app/touchline.css`
> tokens, `src/components/touchline/` grammar, and the `.touchline` activation class hoisted to
> the shell root). `AGENTS.md` remains the highest repo-level authority; if this document and
> `AGENTS.md` ever diverge, that is a defect to fix, not a choice between two valid rules.
>
> Touchline supersedes the earlier **Product Surface 1.0** (ADR-0130) visual doctrine — palette,
> raw token values, typography display treatment, and the exact motion/radius scale below are
> Touchline's, not PS 1.0's. What ADR-0130 established that is **not** a colour/token specific —
> surface families, neutral result colour, the review vocabulary, the fixed evidence primitive
> set, and exact positional safety — is retained unchanged and is called out explicitly below.
> Architectural rationale and superseded prior decisions are recorded in **ADR-0124**,
> **ADR-0125** (reference-convergence — the `MatchPresentation` projection, the
> `OperationalTimeline`, the fixed evidence-story mappings), **ADR-0129** (exact positional
> semantics), **ADR-0130** (Product Surface 1.0 — superseded for visual specifics, retained for
> the interaction/domain doctrine named above), and **ADR-0134** (Touchline — the current
> authority for palette, tokens, typography, and motion).

## 0. Touchline (ADR-0134)

The current visual system. Canonical detailed spec:
`.matchboard-work/matchboard_visual_identity_frontend_reset_2026-09-10/` (gitignored working
bundle).

### 0.1 Theme

Three appearance states: `system` (default, follows `prefers-color-scheme`), `light`, `dark`.
An explicit choice stamps `data-theme="light" | "dark"` on `<html>`; `system` stamps nothing and
resolves purely from the media query. Storage key `matchboard-theme`
(`src/lib/theme/`); a pre-hydration inline script (`THEME_INIT_SCRIPT`) applies the stored choice
to `<html>` before first paint so there is no flash through the wrong appearance. **Light is a
first-class production theme, not a fallback** — dark remains the reference appearance the
design was authored against, but both are maintained to the same bar. A coach controls this via
the Appearance control on Settings; it is a personal per-device display preference only.

### 0.2 Tokens and activation

Raw palette and scale live in `src/app/touchline.css` as `--tl-*` custom properties, and are
activated on a subtree by the `.touchline` class, which remaps them onto the "working" token
names every component actually consumes (`--background`, `--foreground`, `--surface-base`/
`-raised`/`-strong`/`-hover`/`-muted`/`-overlay`, `--border-soft`/`-strong`, `--text-soft`/
`-muted`/`-disabled`, `--accent`/`-strong`/`-subtle`, `--live`/`-subtle`, `--danger`/`-subtle`,
`--warning`/`-subtle`, `--info`/`-subtle`, `--success`/`-subtle`, `--dev`/`-subtle`, `--focus`)
and also exposes Touchline-only names (`--tl-c-*`) for components that want the raw scale
directly. `.touchline` is applied once, at the app shell root (`<body>`, `src/app/layout.tsx`) —
every route renders inside its scope; there is no remaining unmigrated surface, and
`src/app/globals.css`'s old bare-`:root` colour palette and compatibility aliases have been
removed (Phase 10) since nothing renders outside `.touchline` anymore. `src/app/globals.css`
still owns the genuinely shared, non-visual structural scale (radius/motion/spacing/layout
fallbacks, the typography-scale custom properties in §5) that both the retired PS 1.0 system and
Touchline size/space/round themselves against; the exact Touchline-authored scale a component
should reach for is `--tl-*`, described below.

**Palette** — dark (primary/reference) and light (first-class) are both fully defined:

| Token | Dark | Light |
|-------|------|-------|
| `--tl-canvas` / `--tl-canvas-raised` | `#090b0f` / `#0d1117` | `#f3f5f1` / `#ecefe9` |
| `--tl-surface` / `-strong` / `-selected` / `-hover` | `#11161d` / `#171e27` / `#1a222c` / `#151b23` | `#ffffff` / `#e6eae4` / `#e2e7df` / `#edf0eb` |
| `--tl-foreground` | `#f5f7f2` | `#101316` |
| `--tl-text-soft` / `-muted` / `-disabled` | `#a5afbb` / `#7f8997` / `#596270` | `#59636e` / `#616973` / `#9aa1a8` |
| `--tl-border-soft` / `-strong` | hairlines at 10%/17% foreground alpha (both themes) | same |
| `--tl-accent` / `-strong` | `#c7f54a` / `#d8ff73` (luminous lime) | `#4f6c00` / `#486100` (deep olive) |
| `--tl-live` | `#ff5c5c` | `#c43d3d` |
| `--tl-danger` | `#e07068` | `#a92f2a` |
| `--tl-attention` (→ `--warning`) | `#e4b85f` | `#8b5e09` |
| `--tl-info` | `#78a9ff` | `#2f64b2` |
| `--tl-positive` (→ `--success`) | `#71c58c` | `#267a42` |
| `--tl-evidence` (→ `--dev`) | `#a88aff` | `#7150b8` |

Football outcome rule (carried forward from ADR-0130, still absolute): a win is never rendered
with `--success`/green and a loss is never rendered with `--danger`/an error colour — a result is
neutral, and outcome text (`Won`/`Drawn`/`Lost`, `FT`) carries the meaning. `--live` is its own
distinct hue in both themes, never `--danger` reused for "in progress."

**Accent discipline**: `--accent` is used sparsely — own-team identity, the active nav item, a
focus ring, a primary interactive affordance — never as a decorative fill, and never repurposed
as a result colour.

### 0.3 Typography

Geist Sans (`--tl-font-ui`) is the UI/body/navigation/name typeface throughout, in both themes.
**Barlow Condensed** (`--tl-font-sport`, loaded at weights 600/700 only) is reserved exclusively
for the small set of sports/numeric display roles via the `.tl-*` classes in `touchline.css` —
`.tl-score-hero`, `.tl-score-list`, `.tl-clock`, `.tl-round-marker`, `.tl-evidence-number` — a
match score, a prominent live clock, a large kickoff time, a week/round marker, or one major
evidence number. It must never be used for body copy, navigation, or team/player names; the
compact typography scale in §5 (Geist, `--text-*` tokens) is unchanged and is what those contexts
use.

### 0.4 Scale (radius / motion / spacing)

Touchline's own scale, layered over the shared structural fallback in `globals.css`:

| Radius | Value | Use |
|--------|-------|-----|
| `--tl-radius-status` | 6px | status chips, micro badges |
| `--tl-radius-control` | 8px | buttons, inputs, controls |
| `--tl-radius-object` | 10px | a coherent interactive object (row, card) |
| `--tl-radius-feature` | 12px | a featured/hero object |
| `--tl-radius-overlay` | 16px | modal / sheet / drawer |

| Motion | Value | Use |
|--------|-------|-----|
| `--tl-motion-micro` | 120ms | state/hover micro-feedback |
| `--tl-motion-state` | 160ms | control state change |
| `--tl-motion-content` | 200ms | local panel/row content change |
| `--tl-motion-panel` | 260ms | sheet/drawer open-close |
| `--tl-motion-route-max` | 320ms | ceiling for a route/page-level transition |

Easing is one curve throughout: `--tl-motion-ease: cubic-bezier(0.2, 0.8, 0.2, 1)`.

Spacing scale (4px rhythm, unchanged from the retained structural fallback, plus one added major
step): `--tl-space-1…16` = 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px — the last (64px) is for a
major desktop-only gap that PS 1.0's scale did not need.

### 0.5 Canvas atmosphere

One faint top-right accent-hued radial and one broad lower-left cool-hued wash, painted on a
fixed `::before` pseudo-element (`.touchline-canvas`) behind the real content — never a
`background-image` on the canvas element itself, which would make automated contrast tooling
treat the page background as indeterminate. No repeating pitch-line geometry, no per-card glow,
no ordinary-card gradients. Applied once, at `<body>` (`touchline touchline-canvas` classes on
the root layout).

### 0.6 Grammar owners

`src/components/touchline/` is the one place each Touchline grammar family is implemented:
scorebook (`ScorebookMatchRow`, `ScorebookRoundSection`), match (`MatchScoreHeader`,
`LiveScoreStrip`, `OperationalMatchCard`), timeline (`TouchlineTimeline`), evidence
(`EvidenceStory` + `PhaseDistribution` / `OutcomePair` / …), workbench (`WorkbenchToolbar`,
`RosterColumn`, `RosterRow`, `TouchlineInspector`, `WorkbenchSummaryStrip`, `BenchRail`,
`PositionFitList`, `PlayerContextHeader`), navigation (`TouchlineSidebar` / `TouchlineRail` /
`TouchlineBottomNav`, `TouchlineBrandTile`), `TouchlineContextRail`, `TouchlineBottomSheet`,
widget (`TouchlineWidget`, `WidgetHeader`, `MetricStrip`, `CapacityBar`, `QuickActionGrid` —
Touchline Finish follow-up, ADR-0135, §0.9), pitch (`PitchPlayerToken`, `PitchEmptySlot` — same
follow-up), live (`LiveActionGrid` — same follow-up). The canonical `MatchPresentation` (§6,
ADR-0125) remains the sole owner of home/away, score orientation, own-team side, lifecycle,
outcome, clock, cancellation, and planning/report attention — these presentation components
consume it, they do not re-derive match truth.

### 0.7 Migration status

Phases 0–10 are complete: theme system, token set, `/dev/ui-lab` preview harness, the full
component grammar, and — as of Phase 10 — `.touchline` activated at the true shell root (every
route renders inside its scope) with PS 1.0's old bare-`:root` palette and compatibility aliases
deleted from `globals.css`. Phase 11 (this document, public user docs, screenshot regeneration)
and Phase 12 (full verification sweep) are the closing phases of the programme. See ADR-0134 for
the complete phase-by-phase history.

The Touchline Finish & Visual Convergence follow-up (§0.9, ADR-0135) is a separate,
subsequent effort: its Phases F0–F4 (token/material convergence, the widget/pitch/glass
component set, the pitch-renderer refactor, and an extended `/dev/ui-lab` gate) are complete;
F5–F9 (production migration, brand-asset regeneration, cleanup, full re-verification) are gated
on human approval of that F4 UI Lab and have not started.

### 0.8 What's retained unchanged (ADR-0124 / ADR-0125 / ADR-0129 / ADR-0130)

These are interaction/domain rules, not colour or token specifics, and Touchline changes none of
them:

- same canonical domain state at every viewport; one canonical `MatchPresentation` and one
  `OperationalTimeline` as sole owners of their concepts; the five breakpoint tokens;
- WCAG AA / visible focus / ~44px touch targets / no colour-only state; no drag-only workflow;
  installed-PWA and safe-area handling; temporal Today/Events composition;
- **Surface families** — five: temporal flow; match/result scan; planning workspace;
  evidence/story; reference/configuration. Scan lists use one parent surface (or the canvas)
  with dividers and **no card per row**. Cards are reserved for: the dominant next-action object;
  a selected match/decision; an evidence story; a modal/sheet; one coherent interactive object
  when a row is insufficient. No nested bordered cards; no routine desktop shadows.
- **Result colour is neutral** (§0.2 above; carried forward from ADR-0130 as an absolute rule).
- **Review vocabulary** (ADR-0131) — five distinct concepts: **Check** (inspect generated work;
  the `Populate → Check → Adjust` step), **Attention** (current reality needing action, incl. a
  due Decision review — never an error), **Reflect** (post-play observation), **Peer review**
  (`ReviewRequest`; product title "Peer reviews", route `/reviews` unchanged), **Decision
  review** (`DecisionReview`; reconsider a durable coaching decision on a 42-day cadence).
- **Exact positional safety** (ADR-0129) — automatic lineup/rotation/repair/coverage planning
  resolves each formation slot to an exact role (role type + grid lane) and only treats a
  player as an automatic candidate when their declared positions make them Natural/Strong/
  Plausible for that exact role. Fairness and evidence re-order eligible candidates within a
  tier; they never create eligibility. A slot with no safe fit is left unresolved and shown as
  a gap — never filled with a Developmental or Unsupported player. The formation editor shows
  each slot's derived exact role; a FREE slot shows "Manual-only for automatic planning".

### 0.9 Touchline Finish & Visual Convergence follow-up (ADR-0135)

A second, richer set of golden references proved Touchline needed evolving on five points —
implemented as of this section's writing for `/dev/ui-lab` only (F0–F4); production migration
(F5+) is a separately gated follow-on. See ADR-0135 for the full account.

- **Widgets are now first-class**, refining (not reversing) §0.8's "no card per row" rule: a
  `TouchlineWidget` (`src/components/touchline/widget/`) is justified only when it answers one
  question or supports one action cluster — `WidgetHeader`, `MetricStrip`, `CapacityBar`,
  `QuickActionGrid` are its composition primitives. Workbenches (Round Board, Lineup, Tactics,
  Rotations, Live Reporting) stay workbenches; widgets are used sparingly there.
- **The compact bottom nav is genuinely translucent**, superseding §0.6's implicit "opaque"
  baseline: `.tl-bottom-nav` now uses a `>=90%`-opaque `--tl-control-glass` background with
  `backdrop-filter` layered on top only inside an `@supports` guard — the opacity level is
  itself both the AA-contrast fallback and the enhanced material, so nothing was traded away to
  get translucency. `TouchlineBottomSheet` uses the same material at `tone="context"`.
  `backdrop-filter` is reserved for floating controls (nav, sheet) — never applied to a
  scrolling content surface.
  ↳ Superseded example (do not reinstate): the nav was previously fully opaque
  (`--tl-canvas-raised`, no blur) specifically to sidestep an unverified worry about automated
  contrast checking against a translucent `position: fixed` element. The `>=90%` floor resolves
  that without giving up the intended material.
- **Pitch has its own token system** — `--tl-pitch` / `-deep` / `-line` / `-border` /
  `-selected` / `-atmosphere`, applied via `.tl-pitch-surface`
  (`src/components/formations/tactics-board.tsx`) — never generic surface/border tokens.
- **Lineup/tactics render players with `PitchPlayerToken`/`PitchEmptySlot`**
  (`src/components/touchline/pitch/`), not saturated role-coloured rectangles.
  ↳ Superseded example (do not reinstate): `tactics-board.tsx`'s `ROLE_COLORS` previously used
  Tailwind-500 saturated fills per role type (amber/sky/teal/emerald/orange/red/zinc) for the
  formation builder AND for lineup/tactics player representation. The formation builder keeps a
  *restrained* border/text-only role mapping; lineup/tactics/selection-preview no longer use
  `ROLE_COLORS` at all.
- **Golden reference images are composition authority only** — never a licence to add a player
  photo, a league table, a drill/training feature, a new live-event type, or any other product
  concept a reference image merely happens to illustrate. `LiveActionGrid`
  (`src/components/touchline/live/`) is a clean example: it defines no action type itself and is
  fed only the six action types Matchboard's `LiveMatchEventType` actually models, not the
  golden reference's illustrative eight.

## 1. Governing principle

> **Same domain state. Different composition for the user's context.**

The same canonical domain state is true at every viewport. What adapts across viewports is the
amount of visible information, its order, its density, the interaction method, and the supporting
context shown alongside it. The underlying facts never change, and compact UI is never the
desktop layout stacked vertically — it is a purpose-built composition of the same state.

Every primary surface optimises for this sequence:

**Scan → Understand → Decide → Act → Confirm**

If a coach has to reconstruct context before they can act, the screen hierarchy is wrong.

## 2. Reference-product roles (principles only, no copied code/assets/branding)

| Reference | Use it for | Applies mainly to |
|-----------|------------|-------------------|
| Structured / chronological planners | chronology, temporal flow, progressive disclosure, now/next/later, event-day sequencing | Today, Events, matchday flow |
| NBA-style score apps | match as a first-class visual object, symmetric team presentation, score/time hierarchy, scheduled/live/final differentiation, dense fast scanning | Today match items, League, event matches, Follow Live headers, results/history |
| Gentler-Streak / data-story apps | contextual metrics, small data stories, trend and comparison, concise interpretation, decision *support* without pretending the software decides | Insights, evidence, factual player/team trends |

Decision rule: time-driven work → chronological principle; match/result scanning → scoreboard
principle; evidence/pattern understanding → data-story principle.

## 3. Breakpoint composition model

Breakpoint tokens live in `src/app/globals.css` `@theme` and are deliberately distinct from
Tailwind defaults. Do not replace them with framework defaults.

| Tier | Range | Nav | Composition intent |
|------|-------|-----|--------------------|
| Compact | `<600px` | fixed bottom nav | one main operational object/task at a time; single column; reduce density, not font size |
| Medium | `600–839px` | navigation rail | one main surface + supporting context; two columns only where both stay useful; no desktop-wide comparison tables forced onto touch |
| Expanded | `840–1199px` | sidebar | comparison tables and two-column workspaces permitted; more simultaneous planning context |
| Large | `1200–1599px` | sidebar | primary work area + persistent secondary context/inspector; Round Board may show several matches |
| XLarge | `≥1600px` | sidebar | width used for meaningful context/comparison/inspectors, not stretched content; text-heavy areas stay bounded |

### Compact rules (`<600px`)

- one main operational object or task at a time;
- bottom primary navigation; single-column primary content;
- no page-level horizontal scrolling between 360–430px;
- context stays visible or recoverable — show a compact contextual row where relevant
  (`Autumn 2026 · Round 7`, `G2015 · Autumn 2026`); the exact context is route-specific;
- bottom sheets / compact panels for secondary actions;
- no hover-only action; no drag-only workflow;
- interactive targets ~44×44 CSS px where practical;
- input text ≥16px where required to avoid iOS zoom;
- content and sticky actions clear the fixed bottom nav and `env(safe-area-inset-*)`;
- the primary action of a context can never be hidden by fixed nav;
- respect safe areas and installed-PWA standalone display (ADR-0123).

## 4. Screen hierarchy

Reduce card chrome. Use a card only when its content is a coherent interactive object:

- a match;
- an event;
- a next action;
- a decision;
- an evidence story.

Do not create a card for every metric or text fragment. Prefer whitespace, section spacing,
typography, alignment, thin dividers, and grouped rows.

Each operational context has exactly one visually dominant action. Status must never rely on
colour alone. Draft state and finalised history must never look visually interchangeable.

## 5. Typography (compact scale)

| Token | Role | Size |
|-------|------|------|
| `--text-score-header` | match-header score | 34/40 |
| `--text-value` | dense list score/value | 22/24 |
| `--text-title` | page title | 22/24 |
| `--text-section` | section title | 17/18 |
| `--text-row-title` | object/row title | 15/16 |
| `--text-body` | body/input | 15 (mobile input ≥16px where needed to avoid iOS zoom) |
| `--text-meta` | secondary/meta | 12–13 |
| `--text-micro` | exceptional micro-label | ≥11 (floor — reduce density, not font size) |

Remove routine 9px UI text. Reduce excessive uppercase tracking; use uppercase only for short
orientation/status metadata. Geist Sans for UI; Geist Mono only for real code/technical values;
Barlow Condensed only via the `.tl-*` display classes in §0.3 — never for this scale. Use tabular
numerals for score/time/minutes/comparisons. Never shrink text merely to preserve desktop
density.

## 6. Canonical match visual grammar (ADR-0125)

A match must read as football before it reads as a database record.

### One projection

`MatchPresentation` (`src/lib/matches/match-presentation.ts`) is the one normalized display
contract. `buildMatchPresentation()` converts a surface's canonical facts — including
our-team-relative goals and `deriveMatchLifecycleStatus()` output — into home/away-oriented
display fields once. Surfaces render from this projection; they do not re-derive match truth in
React.

Fields: `homeTeam`, `awayTeam`, `ownTeamSide` (`"home" | "away" | null`), `kickoffDate`,
`kickoffTime`, `lifecycle`, `score` (`{home, away}` oriented, or `null`), `clockLabel`,
`resultOutcomeForOwnTeam`, `outcomeLabel`, `planningAttention`, `reportAttention`,
`cancelledReason`.

### Match render variants (`src/components/ui/match-presentation.tsx`, Touchline: `src/components/touchline/`)

ADR-0130 reopened the earlier "exactly three variants" rule; the list below is the current set,
not permanent doctrine. A new variant needs a specification change. Touchline's scorebook/match
grammar owners (§0.6) render the same variants with Touchline's visual language.

| Variant | Use | Shape |
|---------|-----|-------|
| `MatchRow` (alias `MatchScoreRow`; Touchline: `ScorebookMatchRow`) | League/Fixtures, the Today operational timeline, event-day timelines, results/history | dense, **divider-based, no card border**; two team lines each with its value in a stable right-aligned lane; one status line; at most one secondary attention |
| `MatchCard` (Touchline: `OperationalMatchCard`) | Today next-action hero, Round Board / event selected-match summary | one bordered card (`--tl-radius-object`); `DATE · TIME` eyebrow above teams; one dominant action slot; one attention sentence |
| `MatchHeader` (Touchline: `MatchScoreHeader`) | match-specific pages (detail, Follow Live, Live Reporting) | state readable before page controls; score uses `--text-score-header`/`.tl-score-hero`; compact stacks home/away with per-line value; expanded shows one inline `home  N : M  away` line |
| `MatchLiveStrip` (Touchline: `LiveScoreStrip`) | a compact live status strip where a full header is too much | teams + score + `LIVE · <clock>`, no mutating controls |

### Rules

- **Football order is always home then away.** Never reorder to put Matchboard's own team first.
  Mark the own team only subtly (accent weight on its name). No team logo — Matchboard has no
  canonical logo asset; do not require or invent one.
- **Score and kickoff time share one stable right-aligned value lane** (fixed width, tabular
  numerals) so a vertical list of matches aligns and scans.
- Scheduled → kickoff time in the value lane; date subordinate (under the away team); planning
  attention on the status line (`Planning open · 2 decisions`). Live → score in the value lane;
  `LIVE · <clock>` (`--live`, not `--danger`); no mutating controls in a list row. Final → final
  score; `FT` + optional `Won`/`Drawn`/`Lost`; `FT · Report incomplete` when the report is not
  complete. Cancelled → em dash in both value lanes; `CANCELLED`; never `0-0`. Result colour is
  neutral — a win is never green, a loss is never a danger colour; the outcome word carries the
  meaning.
- Long names: allow up to two lines for a team name; never shrink a team name below the standard
  row-title size; the value lane never collapses below its minimum; never ellipsize to the point
  two opponents are ambiguous.
- Attach attention (`2 decisions`, `Report incomplete`, `Planning blocked`) to the match itself,
  not to a separate dashboard counter when the match is visible.

### Truthfulness rules (domain semantics unchanged — ADR-0101, ADR-0109)

- never show a placeholder as if it is a final score;
- **planning closed is not Done**;
- internal finalized planning is not match completion;
- cancelled stays visibly cancelled;
- lifecycle is derived via `deriveMatchLifecycleStatus()`;
- result colour is secondary reinforcement only.

## 6a. Operational Timeline (ADR-0125)

One canonical timeline system — `OperationalTimeline` + `TimelineItem`
(`src/components/ui/operational-timeline.tsx`; Touchline: `TouchlineTimeline`) — used on
**Today** and **Event detail** (event-day flow). It is a structure for football work, not a
calendar product, a task manager, or a general inbox.

### Compact anatomy (`<600px`)

- page horizontal padding 16px; time column 48–52px; gap time→rail 8px; rail width 2px; node
  diameter 8–10px; gap rail→content 12px; item vertical padding 10–12px; section gap 20–24px.
- The rail is structural — do not wrap every item in a large floating card.

### Item types

- **Match item** — renders `MatchScoreRow`/`ScorebookMatchRow` in the content area; the timeline
  owns time position, the match component owns teams/score/state/action.
- **Event item** — event name, start/end, readiness/action state.
- **Follow-up item** — post-match report or another canonical required follow-up. Stays
  prominent after the match ends until the work is complete; **never auto-collapsed**.
- **Planning-action item** — only when the action cannot attach to a visible match/round/event.

### Temporal states

| State | Node | Treatment |
|-------|------|-----------|
| Current / live | filled / strong | strongest contrast; visible `LIVE`/current label; primary action available; **no perpetual pulse** |
| Next | hollow / normal | high contrast; no heavy border; its action can be the page's dominant action when nothing is current |
| Later | normal | lower priority, still readable |
| Earlier / completed | muted | quieter; on compact Today show at most the two most recent inline, collapse the rest behind `Earlier today (N)` |
| Past incomplete follow-up | attention | high priority; never auto-collapsed |

Untimed work is never given a fake clock time and never inserts `--:--` into the axis — attach
it under its owning timed object, or in a `Needs attention` block immediately before `Later`.

### Desktop (`≥840px`)

Timeline stays chronological; time column 64–72px; content can span a wider match row; secondary
context can occupy a right-side column. Do not replace the timeline with unrelated dashboard
cards because width is available.

## 7. Today

Today is the operational front door, not a generic dashboard. Within the first useful viewport
it answers: what matters now or next, what needs action, which object to open.

### Compact composition order

1. page title + compact context/date orientation;
2. dominant **Next Action** object (renders `MatchCard`/`OperationalMatchCard` when the next
   action is a match);
3. `OperationalTimeline` — now / next / later / earlier, chronological, one rail;
4. secondary coaching context (visually quieter);
5. distant / upcoming information;
6. the "At a glance" metric-tile row stays **below** the operational flow — never ahead of Next
   Action.

Do not lead with a grid of detached metrics. Counts such as `2 decisions` appear on the
round/match/event that contains those decisions, not as a standalone tile. When there are no
current-day matches or events, do not show an empty rail — show a short `Nothing scheduled
today` + the next dated item, then weekly context. Desktop may show richer supporting context,
but Next Action stays dominant. Existing Today/command-centre domain truth
(`getAssistantCommandCentre()`) is preserved.

## 8. League / Fixtures

Goal: rapid round and match scanning.

- group by round/date;
- past rounds compact and result-oriented; current/upcoming rounds more open and
  planning-oriented;
- unresolved conditions attach to the affected match/round;
- scoreboard-style rows rather than large repeated cards where several matches are scanned;
- scheduled / live / final / report-incomplete / cancelled are distinguishable without opening
  match detail;
- expanded may use a denser timeline/table-like composition but keeps the canonical match
  grammar;
- **no finalize action is reintroduced.**

## 9. Round Board (highest-complexity adaptive surface)

### Expanded / large
Retain the multi-match workbench: simultaneous squads/matches, available players/decisions,
integrity/evidence support, pointer-efficient direct manipulation where useful. Do not reduce
desktop capability to phone constraints.

### Compact — one match at a time
1. round context;
2. compact match selector when multiple matches exist;
3. selected match summary;
4. squad;
5. relevant plan-integrity / evidence context;
6. actions.

The selected match is **URL-backed** (`?match=<id>`) and survives refresh/back. The compact
match selector may be a local horizontal tab/segmented strip if it is keyboard accessible,
touch-safe, and causes no page-level overflow. Blocked and Decision Required stay prominent;
deeper planning/evidence explanation may use disclosure.

### Player movement
- desktop drag may remain;
- compact provides a tap path: `Player → Move → target match`;
- no duplicate assignment;
- reuse the current canonical mutation/validation — no client-only validation shortcut;
- show resulting impact; preserve override/safety requirements;
- Undo only where the mutation is safely reversible under existing domain rules.

## 10. Events

An event is primarily something happening at a time, not an administration record.

### Compact event list
chronological, grouped by month/date; event name; time/range; event type where useful;
squad/readiness summary; action state. Do not lead with count columns.

### Event detail
1. event identity / date / context;
2. readiness / next action;
3. **event-day match timeline** — `OperationalTimeline` with `MatchScoreRow` match items, above
   squad/helper administration;
4. squads;
5. players / helpers / notes and secondary administration.

Squad/helper/pool administration follows the temporal flow (or a secondary tab) unless it
blocks the event. Do not place administrative counters above the match chronology.
Event/league evidence parity and existing event-squad behaviour are preserved.

## 11. Players

Desktop may keep a comparison table where comparison is useful. Compact must **not** render a
generic table card containing every desktop column. Build a dedicated compact player summary:

- player name;
- core team / base-group context;
- current availability / attention state where relevant;
- concise recent opportunity/participation summary;
- concise role/position context only where canonical data already exists;
- clear entry to player detail.

Omitted detail stays reachable on player detail/profile. Do not invent scoring or judgement
logic to fill the design. No player score, no ranking, no negative labels.

### Player detail compact — lead order (ADR-0125)

1. identity + team/base-group context;
2. current availability / attention;
3. recent-opportunity `MetricStory` (`TrendSpark`);
4. position-exposure `MetricStory` (`DistributionBar`);
5. recent matches;
6. observations / evidence;
7. secondary attributes / administration.

Do not lead with a large overall rating or player score.

## 12. Live reporting and Follow Live

This programme does not rewrite live-reporting domain behaviour. Apply the shared shell,
canonical match grammar, typography, safe-area, and touch rules. Preserve: live reporting is
mutable, Follow Live is read-only, score/clock/on-field state derives from canonical live state,
refresh does not change truth. Do not merge read-only and mutating interaction patterns.

- **Follow Live** and **League match detail** use the full `MatchHeader`/`MatchScoreHeader`
  variant for the match identity.
- **Live Reporting** keeps a compact **one-row** sticky scoreboard — a deliberate
  operational-focus density exception so the live action buttons stay above the fold — but it
  follows canonical football home→away order and marks the own team by a subtle name accent, not
  a score colour.
- The Today operational timeline shows a scoreline + W/D/L for a played match once a post-match
  report exists; a live match with no report row shows state + the "Follow live" action (there
  is no server-side live-score aggregation to read here).

## 13. Data-visualization grammar

Do not start by choosing a chart library. Every visualization answers a concrete question. Model:

`value → context → pattern → interpretation`

Small primitive set only. ADR-0130 removed the "fixed set of seven forever" rule; the approved
set is **nine** (this list is not permanent future doctrine, and no further primitive may be
added without a specification change) — this set and its rules carry forward unchanged under
Touchline, styled with Touchline's tokens:

| Primitive | Question | Status |
|-----------|----------|--------|
| `TrendSpark` | is this changing over recent periods? | implemented |
| `DistributionBar` | how is exposure split across categories? | implemented |
| `PeriodBars` | when in the match/sequence does a pattern occur? | implemented |
| `PairedOutcomeBar` | what two factual outcome measures occurred together (e.g. goals for vs against while a combination was on the field)? *(two rows, same scale, direct numeric labels, neutral tokens — no ranking, no red/green good-bad)* | implemented |
| `RangeBand` | is a value inside/outside a meaningful historical range? *(only with a real canonical baseline — never an invented "ideal")* | implemented |
| `DeltaMetric` | how does the current period compare with a relevant previous/baseline period? *(neutral direction language unless the domain meaning is inherently directional)* | implemented |
| `MetricStory` | reusable wrapper: label + primary value + comparator/context + one small visualization + one short factual interpretation + optional detail link | implemented |
| `DotComparison` | how do a few discrete factual measures compare on one neutral scale? | spec-approved (ADR-0130), add when first needed — no further ADR required |
| `SequenceStrip` | what ordered sequence of states/events occurred? | spec-approved (ADR-0130), add when first needed — no further ADR required |

Every visualization: has a text equivalent; avoids colour-only meaning; works at 360px; stays
understandable at zoom; exposes accessible names/descriptions; shows sample/evidence context;
has an explicit insufficient-evidence state driven by the engine's own confidence/sample rules
(`Not enough evidence yet` / `Observed in 1 match`), never an invented UI threshold; avoids
causal/ranking claims and red/green good-bad encoding.

Prefer native SVG/CSS/React. Do not add a large chart library solely for this work. A tenth
primitive needs a specification change.

### Fixed evidence-story → primitive mappings (ADR-0125)

Implementation must use these; it must not substitute another chart because a component is
convenient. If canonical data is unavailable, omit the story and record the missing source — do
not invent a metric.

| Story | Question | Primitive(s) |
|-------|----------|--------------|
| Player recent opportunity | Has this player had regular recent match opportunity? | `MetricStory` + `TrendSpark` (last 5 eligible rounds primary; up to 10 for the spark; previous-5 comparator when ≥3 exist) |
| Player position exposure | Which positions has this player actually experienced? | `MetricStory` + `DistributionBar` (canonical position names, football order) |
| Team match-phase pattern | In which parts of matches has this pattern appeared? | `MetricStory` + `PeriodBars` (engine-native phase bins) |
| On-field combination pattern | What has happened when this combination was on the field together? | `MetricStory` + `PairedOutcomeBar` (+ always show sample/exposure context) |
| Planned rotation evidence | Does the planned rotation resemble a historical pattern worth checking? | `MetricStory`; `DeltaMetric` only when the engine supplies a comparator, else a factual story with no chart |
| Position-pattern evidence | Has this positional arrangement produced a repeatable pattern independent of player identity? | `MetricStory` + a supported small visual; wording must distinguish position pattern from named-player combination pattern |

Interpretation vocabulary is neutral and correlational: `appeared`, `observed`, `more frequent
in this sample`. Never `good`/`bad`/`behind`/`ahead`, never a ranking, never a causal claim from
a correlation.

## 14. Forms and overlays

Compact forms: one column; progressive disclosure for advanced fields; visible labels; input
font large enough for iOS; stable primary action; field-local actionable errors. One primary
vertical scroll container per page; nested vertical scroll only for bounded overlays/sheets or
intentionally bounded data regions.

## 15. Loading, empty, error states

Every changed primary surface has: a useful empty state; a loading state that preserves layout;
an actionable error state where possible; no full-page spinner unless unavoidable; no layout
jump that unexpectedly moves the primary action. Loading/error/empty states retain primary
navigation.

## 16. Motion

Use motion only to explain insertion/removal, state transition, panel open/close, or
movement/reorder. No decorative animation programme. Respect `prefers-reduced-motion`.

Touchline's timing scale (§0.4): `--tl-motion-micro 120ms` (state/hover micro-feedback);
`--tl-motion-state 160ms` (control state change); `--tl-motion-content 200ms` (local
panel/row content change); `--tl-motion-panel 260ms` (sheet/drawer open-close);
`--tl-motion-route-max 320ms` (ceiling for a route/page-level transition). One easing curve:
`--tl-motion-ease cubic-bezier(0.2, 0.8, 0.2, 1)`. Never animate a score continuously, a timeline
rail drawing itself, charts on every scroll into view, or an attention state with a perpetual
pulse. No celebratory score animation, no list-entrance cascade.

## 16a. Visual grammar precision (ADR-0125 / bundle 06, recalibrated to Touchline's exact scale — ADR-0134)

- **Spacing** on a 4px rhythm: 4 micro / 8 related-inline / 12 compact-internal / 16 standard
  compact padding / 20 section-internal / 24 section gap / 32 major section / 40–48 major desktop
  / 64 major-desktop-only gap (`--tl-space-1…16`, §0.4). Avoid arbitrary 13/17/22px unless an
  existing shared token requires it.
- **Page padding**: compact 16px; medium 20–24px; expanded 24–32px; wide workbench uses width
  for panels, not ever-growing page padding.
- **Corners** (`--tl-radius-*`, §0.4): status chips/micro badges 6px; buttons/inputs/controls
  8px; a coherent interactive object (row, card) 10px; a featured/hero object 12px; sheet/dialog/
  drawer 16px. No pill radius on ordinary cards/rows.
- **Dividers over cards**: primary list separation uses thin dividers or spacing. Reserve
  bordered cards for the dominant Next Action, a self-contained evidence story, sheet/dialog
  sections, and important grouped interactive objects — not every match/player/metric/timeline
  row.
- **Shadows**: minimal/none for normal content; reserved for floating nav
  (`--tl-shadow-control`), sheets/dialogs, and sticky overlays (`--tl-shadow-overlay`).
- **Typography**: use the `--text-*` tokens in §5 (`--text-score-header` 34/40, `--text-value`
  22/24 for dense list scores, `--text-row-title` 15/16 for names, `--text-micro` ≥11 floor) for
  ordinary UI text; use the `.tl-*` display classes (§0.3) only for score/clock/round-marker/major
  evidence number. Tabular numerals for scores/clocks. Uppercase only for very short labels
  (`LIVE`, `FT`, `NEXT`). No 9px primary UI text.
- **Icons** only where they speed recognition (nav icon+label, overflow/action). Status text
  generally needs no icon; timeline nodes are structural markers, not decorative icons; evidence
  charts carry no decorative sports icons. Compact icon size 18–22px.
- **Touch**: ~44×44px minimum; compact match-selector strip items ≥44px; the compact row itself
  can be the primary tap target; never make a small inline text link the only primary action.
- **Density modes** — do not mix in one section: *operational focus* (Today hero, selected
  match, live) = more whitespace, one dominant action, larger value; *scan density* (League
  rows, event lists, player lists) = compact rhythm, aligned value lanes, dividers; *analysis
  density* (evidence detail / desktop workbench) = more data, still grouped by questions/stories.
- Use existing Matchboard colour tokens only (`--tl-*` / the working names they remap to in
  §0.2). Do not copy reference-app colours; do not hardcode a hex value in a component.

## 17. Explicit anti-patterns

- responsive = the desktop layout stacked vertically;
- a detached metric grid ahead of the Today Next Action;
- replacing the Today/event chronology with dashboard cards on desktop; an empty timeline rail
  when nothing is scheduled;
- a card for every metric or text fragment; a card border on every `MatchRow`; a card per row in
  a scan list; nested bordered cards;
- routine 9px primary UI text; shrinking text to preserve desktop density;
- a repeating pitch-line background texture, ordinary-card gradients, or glows (Touchline's own
  canvas atmosphere is deliberately one faint fixed radial pairing, nothing per-card);
- a win shown in green or a loss shown in a danger/error colour; `--live` rendered as
  `--danger`; colour as the only signal for a result or status;
- competing per-surface match components; a match row that does not render from
  `MatchPresentation`;
- styling every Rules / Settings item as its own card;
- broad-role automatic position eligibility (e.g. treating any "midfielder" as a candidate for a
  winger slot); fairness or evidence used to make an ineligible player eligible; an automatic
  planner filling a no-safe-fit slot with a Developmental/Unsupported player;
- using "Review" for plan inspection (it is **Check**); mixing Peer review and Decision review;
- reordering football home/away to put Matchboard's own team first; inventing a team logo;
- an unaligned match score/time value lane;
- showing a placeholder as a final score; treating planning-closed/finalized-planning as match
  completion;
- drag-only player movement; hover-only actions;
- a compact Players view that is a dump of every desktop column;
- radar/spider player charts, an overall player score, player rankings, red/green good-bad
  colour scales, causal wording from correlation; a wall of equal raw-metric cards on an
  evidence surface;
- a separate mobile app or a separate mobile route tree;
- UI-local copies of domain rules or client-only validation shortcuts;
- reintroducing a coach-operated Finalise round / Finalise match action;
- hardcoding a raw hex colour or an undefined Tailwind utility class in a component instead of
  the `.touchline`-remapped token names (§0.2) — the exact bug class Phase 10 found and fixed
  across the app.
