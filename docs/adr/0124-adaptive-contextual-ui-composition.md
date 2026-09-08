# ADR-0124: Adaptive Contextual UI Composition

## Status

Accepted

## Context

Matchboard is a coach-facing football operations cockpit deployed as a hosted web app and an
installable PWA (ADR-0123). Its shell already renders three viewport tiers — sidebar (≥840px),
navigation rail (600–839px), bottom mobile nav (<600px) — with shared active-state logic
(`src/components/shell/nav-active.ts`) and PWA safe-area handling.

Repository guidance up to this point treated "responsive" primarily as *layout survival*: the
same desktop composition, reflowed and stacked, made to fit a narrow viewport without breaking.
Several mutable documents also carried framing that is now stale or actively contradictory:

- `features/matchboard.feature`'s "Football Manager style shell is mandatory" rule still
  described a four-area left navigation (`Manager` / `Match Week` / `Squad` / `System`) and a
  top context bar showing `match round status` — both superseded by the five-item
  Today/League/Events/Players/More IA (`ux-branding-language-ui` Phase 2.4) and by ADR-0101's
  match-lifecycle vocabulary.
- The same feature file, `docs/product/navigation-model.md`, `docs/product/manager-workflow.md`,
  and `docs/product/content-style-guide.md` still referenced a coach-operated **Finalise round /
  Finalise match** action removed by ADR-0109, and an `Assistant → Fixtures → …` central flow
  using superseded nav names.
- `docs/product/navigation-model.md` asserted "The app uses exactly these visible status labels:
  Not generated, Draft, Blocked, Ready, Finalized" as the *primary* per-match label, which
  ADR-0101 already demoted to internal/secondary vocabulary behind the match-lifecycle status.
- `docs/product/navigation-model.md` described Players as "table-first" with no compact
  counterpart rule.
- `globals.css` typography utilities included routine ~10px (`0.625rem`) UI text; no compact
  typography scale, sticky-action, or compact-context-strip pattern was codified.

A maintainer-approved implementation bundle
(`.matchboard-work/matchboard-ux-ui-programme/`) makes the product/interaction decisions for the
next programme. This ADR records the durable architectural decision so future sessions discover
it from normal repository documentation, not from a gitignored working bundle.

## Decision

### 1. Adaptive composition, not responsive stacking

The governing rule is:

> **Same domain state. Different composition for the user's context.**

The same canonical domain state must be true at every viewport. What adapts is the *amount* of
visible information, its *order*, its *density*, the *interaction method*, and the *supporting
context shown alongside it* — never the underlying facts, and never by simply stacking the
desktop layout. Compact UI is a purpose-built composition of the same state, not desktop UI
reflowed.

The operational sequence every primary surface optimises for is: **Scan → Understand → Decide →
Act → Confirm.** If a coach must reconstruct context before acting, the screen hierarchy is
wrong.

### 2. Breakpoint architecture is retained and load-bearing

The existing Matchboard breakpoints (`globals.css` `@theme`) are kept as-is and are not to be
replaced with framework defaults:

| Tier | Range | Composition intent |
|------|-------|--------------------|
| Compact | `<600px` | phones, touch, installed PWA — one primary object/task at a time, bottom nav |
| Medium | `600–839px` | tablet portrait / split-screen — navigation rail, one main surface + supporting context |
| Expanded | `840–1199px` | tablet landscape / normal desktop — sidebar, comparison tables and two-column workspaces permitted |
| Large | `1200–1599px` | workbench — primary work area + persistent secondary context/inspector |
| XLarge | `≥1600px` | wide workbench — width used for meaningful context/comparison, not stretched content |

### 3. Compact rules (`<600px`)

- one main operational object or task at a time;
- bottom primary navigation; single-column primary content;
- no page-level horizontal scrolling between 360–430px;
- team/season/round/event context remains visible or recoverable (a compact context strip, e.g.
  `Autumn 2026 · Round 7`), not hidden merely because width is small;
- no hover-only action; no drag-only workflow;
- interactive targets ~44×44 CSS px where practical;
- no routine 9px primary UI text — reduce information *density*, not font size;
- content and sticky actions clear the fixed bottom nav and `env(safe-area-inset-*)`;
- the primary action of a context can never be hidden by fixed nav.

### 4. Visual hierarchy

Reduce card chrome. A card represents a coherent interactive object (a match, an event, a next
action, a decision, an evidence story) — not every metric or text fragment. Prefer whitespace,
section spacing, typography, alignment, thin dividers, and grouped rows. Each operational
context has exactly one visually dominant action. Status must never depend on colour alone.

The current dark appearance is retained. This programme does not introduce a light/outdoor mode.

### 5. Canonical match visual grammar

There is **one** canonical match representation, evolved from the existing canonical component
(`MatchLifecycleBadge` and the shared match-row/card presentation), not competing per-surface
match components. It is used across Today, League/Fixtures, Events, match-detail entry points,
Follow Live entry points, history/results, and player-participation contexts.

| State | Priority order |
|-------|----------------|
| Scheduled | teams/opponent → kick-off time/date → lifecycle state → planning condition/action |
| Live | teams → score → `LIVE` + match clock → relevant action / read-only state |
| Final | teams → final score → `FT` / result → W/D/L text where appropriate |

Truthfulness rules (unchanged domain semantics, ADR-0101/ADR-0109): a placeholder is never shown
as a final score; **planning closed is not Done**; internal finalized planning is not match
completion; cancelled stays visibly cancelled; lifecycle is derived via
`deriveMatchLifecycleStatus()`; result colour is secondary reinforcement only.

### 6. Screen composition specifics

- **Today** leads with the dominant Next Action object, then a chronological now/next/later
  operational flow, then quieter secondary coaching context, then distant/upcoming context. It
  must not lead with a detached grid of metrics. Counts such as `2 decisions` attach to the
  round/match/event that contains them.
- **League/Fixtures** groups by round/date; past rounds are compact and result-oriented,
  current/upcoming rounds more open and planning-oriented; unresolved conditions attach to the
  affected match/round; scheduled/live/final/report-incomplete/cancelled are distinguishable
  without opening match detail. No finalize action is reintroduced.
- **Round Board** retains its multi-match workbench on expanded/large. Compact shows **one match
  at a time** with a keyboard-accessible, touch-safe compact match selector; the selected match
  is URL-backed (`?match=<id>`) and survives refresh/back. Player movement has a tap path
  (`Player → Move → target match`); dragging may remain on desktop but is never required. All
  mutations call existing canonical server/domain operations — no client-only validation
  shortcuts. Blocked / Decision required stay prominent; deeper explanation may use disclosure.
- **Events** are presented as something happening at a time: chronological compact list grouped
  by month/date; event detail presents an event-day match timeline using the canonical match
  grammar. Event squad / evidence semantics are unchanged.
- **Players** may keep a desktop comparison table where comparison is useful. Compact renders a
  purpose-built player summary (name, core-team/base-group context, current attention state,
  concise recent participation, role/position context only where canonical data already exists,
  clear entry to detail) — never a generic card containing every desktop column. Omitted detail
  stays reachable on player detail. No player score, ranking, or judgement logic is invented.
- **Live reporting / Follow Live**: shell, match grammar, typography, safe-area and touch rules
  apply; live reporting stays mutable, Follow Live stays read-only, and these interaction
  patterns are not merged.

### 7. Evidence / data-visualization grammar

A small primitive set only — `TrendSpark`, `DistributionBar`, `PeriodBars`, `RangeBand` (only
with a real canonical baseline), `DeltaMetric`, `MetricStory` — built with native SVG/CSS/React.
No large chart dependency is added for this work. Every visualization has a concrete question, a
text equivalent, and visible sample/evidence context, works at 360px, and exposes accessible
names/descriptions. No radar/spider charts, no overall player score, no player ranking, no
red/green good-bad encoding, no causation claims from correlation.

### 8. Testing strategy

The existing browser-acceptance strategy is *extended*, not multiplied across every viewport. A
bounded critical **compact mobile** flow suite is added in two engines:

- Chromium at ~390×844;
- WebKit at an iPhone-like compact viewport.

If CI installs only Chromium, the relevant browser-test job installs WebKit **only** for that
bounded project. Changed primary surfaces are verified at representative widths (360/390/430/768/
1024/1280/1440/≥1600). A small set of visual-regression baselines is added for stable primary
surfaces (Today compact, League compact, Round Board compact, Event detail compact, Players
compact, one desktop surface, one evidence visualization) with deterministic seeded data and
masked dynamic clocks. Tests are not weakened to make the programme pass.

### 9. PWA compatibility

ADR-0123's public manifest/icons, `viewport-fit=cover`, `env(safe-area-inset-*)` handling,
standalone-display metadata, and `InstallPwaCard` are preserved and extended. Compact shell
changes are verified in both a normal browser and an installed standalone context.

### 10. Durable documentation authority

`AGENTS.md` carries the concise normative rules (a new "Adaptive interaction design" section).
`docs/product/adaptive-interaction-design.md` is the canonical detailed interaction-design
reference. If the two ever diverge, that divergence is a defect to fix, not a choice between two
valid rules — `AGENTS.md` wins. Mutable product docs that conflicted with the above have been
rewritten, not annotated with exceptions.

## Superseded / amended prior decisions

- **Supersedes** the `features/matchboard.feature` "Football Manager style shell is mandatory"
  rule's four-area navigation (`Manager` / `Match Week` / `Squad` / `System`) and its
  "top context bar shows … match round status" scenario, and the "Round Board actions must
  include … Finalise …" scenario. The five-item IA and derived-lifecycle model replace them.
- **Amends** ADR-0101 (match lifecycle status) usage: the canonical match grammar in §5 is the
  single presentation of that lifecycle across all surfaces.
- **Builds on** ADR-0109 (derived coach workflow lifecycle): no finalize/finalise action is
  reintroduced by any UI in this programme.
- **Builds on** ADR-0123 (PWA installability): safe-area / standalone behaviour is preserved and
  extended, not rebuilt.
- Earlier "responsive = stack the desktop layout" framing in mutable docs and code comments is
  retired. Historical ADRs are left unedited; this ADR is the current rule.

## Consequences

- A new canonical product document and an `AGENTS.md` section become the durable source; the
  working bundle can be deleted after the programme without losing the direction.
- One match grammar reduces per-surface drift and screenshot churn.
- Compact Round Board gains a URL-backed `?match=<id>` selected-match parameter (additive, no
  schema change, no new route tree).
- CI gains one bounded WebKit browser-test project.
- Public docs (`content/docs/**`) and their screenshots must be regenerated for changed primary
  surfaces via the existing pipeline.
- No domain, selection, fairness, evidence, lifecycle, auth, tenancy, or persistence semantics
  change. No separate mobile app or mobile route tree is introduced.
