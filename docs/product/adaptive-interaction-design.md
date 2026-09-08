# Adaptive Interaction Design

> **Status:** Canonical detailed interaction-design reference. `AGENTS.md` remains the highest
> repo-level authority; if this document and `AGENTS.md` ever diverge, that is a defect to fix,
> not a choice between two valid rules. Architectural rationale and superseded prior decisions
> are recorded in **ADR-0124** and **ADR-0125** (reference-convergence precision pass — the
> `MatchPresentation` projection and its three variants, the `OperationalTimeline`, the
> seventh evidence primitive `PairedOutcomeBar`, and the fixed evidence-story mappings).

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

| Role | Size |
|------|------|
| primary score/value | 24–32px |
| page title | 20–24px |
| object/row title | 15–17px |
| body/input | 14–16px (mobile input ≥16px where needed to avoid iOS zoom) |
| secondary/meta | 12–13px |
| exceptional micro-label | ≥11px |

Remove routine 9px UI text. Reduce excessive uppercase tracking; use uppercase only for short
orientation/status metadata. Use tabular numerals for score/time/minutes. Never shrink text
merely to preserve desktop density.

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

### Exactly three variants (`src/components/ui/match-presentation.tsx`)

| Variant | Use | Shape |
|---------|-----|-------|
| `MatchScoreRow` | League/Fixtures, the Today operational timeline, event-day timelines, results/history | dense, **divider-based, no card border**; two team lines each with its value in a stable right-aligned lane; one status line; at most one secondary attention |
| `MatchCard` | Today next-action hero, Round Board / event selected-match summary | one bordered card (~12px radius); `DATE · TIME` eyebrow above teams; one dominant action slot; one attention sentence |
| `MatchHeader` | match-specific pages (detail, Follow Live, Live Reporting) | state readable before page controls; compact stacks home/away with per-line value; expanded shows one inline `home  N : M  away` line |

### Rules

- **Football order is always home then away.** Never reorder to put Matchboard's own team first.
  Mark the own team only subtly (accent weight on its name). No team logo — Matchboard has no
  canonical logo asset; do not require or invent one.
- **Score and kickoff time share one stable right-aligned value lane** (fixed width, tabular
  numerals) so a vertical list of matches aligns and scans.
- Scheduled → kickoff time in the value lane; date subordinate (under the away team); planning
  attention on the status line (`Planning open · 2 decisions`). Live → score in the value lane;
  `LIVE · <clock>`; no mutating controls in a list row. Final → final score; `FT` + optional
  `WON`/`DRAW`/`LOST`; `FT · Report incomplete` when the report is not complete. Cancelled → em
  dash in both value lanes; `CANCELLED`; never `0-0`.
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
(`src/components/ui/operational-timeline.tsx`) — used on **Today** and **Event detail**
(event-day flow). It is a structure for football work, not a calendar product, a task manager,
or a general inbox.

### Compact anatomy (`<600px`)

- page horizontal padding 16px; time column 48–52px; gap time→rail 8px; rail width 2px; node
  diameter 8–10px; gap rail→content 12px; item vertical padding 10–12px; section gap 20–24px.
- The rail is structural — do not wrap every item in a large floating card.

### Item types

- **Match item** — renders `MatchScoreRow` in the content area; the timeline owns time
  position, the match component owns teams/score/state/action.
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
2. dominant **Next Action** object (renders `MatchCard` when the next action is a match);
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

## 13. Data-visualization grammar

Do not start by choosing a chart library. Every visualization answers a concrete question. Model:

`value → context → pattern → interpretation`

Small primitive set only — **seven** primitives (ADR-0125 added `PairedOutcomeBar`):

| Primitive | Question |
|-----------|----------|
| `TrendSpark` | is this changing over recent periods? |
| `DistributionBar` | how is exposure split across categories? |
| `PeriodBars` | when in the match/sequence does a pattern occur? |
| `PairedOutcomeBar` | what two factual outcome measures occurred together (e.g. goals for vs against while a combination was on the field)? *(two rows, same scale, direct numeric labels, neutral tokens — no ranking, no red/green good-bad)* |
| `RangeBand` | is a value inside/outside a meaningful historical range? *(only with a real canonical baseline — never an invented "ideal")* |
| `DeltaMetric` | how does the current period compare with a relevant previous/baseline period? *(neutral direction language unless the domain meaning is inherently directional)* |
| `MetricStory` | reusable: label + primary value + comparator/context + one small visualization + one short factual interpretation + optional detail link |

Every visualization: has a text equivalent; avoids colour-only meaning; works at 360px; stays
understandable at zoom; exposes accessible names/descriptions; shows sample/evidence context;
has an explicit insufficient-evidence state driven by the engine's own confidence/sample rules
(`Not enough evidence yet` / `Observed in 1 match`), never an invented UI threshold.

Prefer native SVG/CSS/React. Do not add a large chart library solely for this work. An eighth
primitive needs an ADR amendment.

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

Three timing classes only: immediate feedback 80–120ms; normal UI transition 140–180ms;
sheet/dialog ≤240ms with the existing system easing curve. Never animate a score continuously,
a timeline rail drawing itself, charts on every scroll into view, or an attention state with a
perpetual pulse.

## 16a. Visual grammar precision (ADR-0125 / bundle 06)

- **Spacing** on a 4px rhythm: 4 micro / 8 related-inline / 12 compact-internal / 16 standard
  compact padding / 20 section-internal / 24 section gap / 32 major section / 40–48 major desktop
  only. Avoid arbitrary 13/17/22px unless an existing shared token requires it.
- **Page padding**: compact 16px; medium 20–24px; expanded 24–32px; wide workbench uses width
  for panels, not ever-growing page padding.
- **Corners**: small controls/chips ~6–8px; standard interactive object ~12px; sheet/dialog
  ~16–20px. No pill radius on ordinary cards/rows.
- **Dividers over cards**: primary list separation uses thin dividers or spacing. Reserve
  bordered cards for the dominant Next Action, a self-contained evidence story, sheet/dialog
  sections, and important grouped interactive objects — not every match/player/metric/timeline
  row.
- **Shadows**: minimal/none for normal content; reserved for floating nav, sheets/dialogs, and
  sticky overlays.
- **Typography**: score/value 24–32px semibold tabular; team/object name 15–17px compact
  medium/semibold normal-case; status/orientation 11–13px, uppercase only for very short labels
  (`LIVE`, `FT`, `NEXT`); body 14–16px, line-height 1.35–1.5. No 9px primary UI text.
- **Icons** only where they speed recognition (nav icon+label, overflow/action). Status text
  generally needs no icon; timeline nodes are structural markers, not decorative icons; evidence
  charts carry no decorative sports icons. Compact icon size 18–22px.
- **Touch**: ~44×44px minimum; compact match-selector strip items ≥44px; the compact row itself
  can be the primary tap target; never make a small inline text link the only primary action.
- **Density modes** — do not mix in one section: *operational focus* (Today hero, selected
  match, live) = more whitespace, one dominant action, larger value; *scan density* (League
  rows, event lists, player lists) = compact rhythm, aligned value lanes, dividers; *analysis
  density* (evidence detail / desktop workbench) = more data, still grouped by questions/stories.
- Use existing Matchboard colour tokens only. Do not copy reference-app colours.

## 17. Explicit anti-patterns

- responsive = the desktop layout stacked vertically;
- a detached metric grid ahead of the Today Next Action;
- replacing the Today/event chronology with dashboard cards on desktop; an empty timeline rail
  when nothing is scheduled;
- a card for every metric or text fragment; a card border on every `MatchScoreRow`;
- routine 9px primary UI text; shrinking text to preserve desktop density;
- competing per-surface match components; a match row that does not render from
  `MatchPresentation`;
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
- reintroducing a coach-operated Finalise round / Finalise match action.
