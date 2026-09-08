# Adaptive Interaction Design

> **Status:** Canonical detailed interaction-design reference. `AGENTS.md` remains the highest
> repo-level authority; if this document and `AGENTS.md` ever diverge, that is a defect to fix,
> not a choice between two valid rules. Architectural rationale and superseded prior decisions
> are recorded in **ADR-0124**.

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

## 6. Canonical match visual grammar

A match must read as football before it reads as a database record. There is **one** canonical
match representation, evolved from the existing canonical component, used across Today,
League/Fixtures, Events, match-detail entry points, Follow Live entry points, history/results,
and player-participation contexts. Do not create competing per-surface match components.

### Scheduled
1. teams/opponent
2. kick-off time/date
3. lifecycle state
4. planning condition/action

```
Slemmestad Hvit    17:30    ROS
SAT 12 SEP · PLANNING OPEN
```

### Live
1. teams
2. score
3. `LIVE` marker + match clock
4. relevant action / read-only state

```
Slemmestad Rød     2 : 1     Heggedal
LIVE · 37′
```

### Final
1. teams
2. final score
3. `FT` / result state
4. W/D/L text where appropriate

```
Slemmestad Rød     3 : 2     Heggedal
FT · WON
```

### Truthfulness rules (domain semantics unchanged — ADR-0101, ADR-0109)

- never show a placeholder as if it is a final score;
- **planning closed is not Done**;
- internal finalized planning is not match completion;
- cancelled stays visibly cancelled;
- lifecycle is derived via `deriveMatchLifecycleStatus()`;
- result colour is secondary reinforcement only.

## 7. Today

Today is the operational front door, not a generic dashboard. Within the first useful viewport
it answers: what matters now or next, what needs action, which object to open.

### Compact composition order

1. page title + compact context/date orientation;
2. dominant **Next Action** object;
3. operational timeline — now / next / later, chronological;
4. secondary coaching context (visually quieter);
5. distant / upcoming information.

Do not lead with a grid of detached metrics. Counts such as `2 decisions` appear on the
round/match/event that contains those decisions, not as a standalone tile. Desktop may show
richer supporting context, but Next Action stays dominant. Existing Today/command-centre domain
truth (`getAssistantCommandCentre()`) is preserved.

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
3. event-day match timeline (canonical match grammar);
4. squads;
5. players / helpers / notes and secondary administration.

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

## 12. Live reporting and Follow Live

This programme does not rewrite live-reporting domain behaviour. Apply the shared shell,
canonical match grammar, typography, safe-area, and touch rules. Preserve: live reporting is
mutable, Follow Live is read-only, score/clock/on-field state derives from canonical live state,
refresh does not change truth. Do not merge read-only and mutating interaction patterns.

## 13. Data-visualization grammar

Do not start by choosing a chart library. Every visualization answers a concrete question. Model:

`value → context → pattern → interpretation`

Small primitive set only:

| Primitive | Question |
|-----------|----------|
| `TrendSpark` | is this changing over recent periods? |
| `DistributionBar` | how is exposure split across categories? |
| `PeriodBars` | when in the match/sequence does a pattern occur? |
| `RangeBand` | is a value inside/outside a meaningful historical range? *(only with a real canonical baseline — never an invented "ideal")* |
| `DeltaMetric` | how does the current period compare with a relevant previous/baseline period? *(neutral direction language unless the domain meaning is inherently directional)* |
| `MetricStory` | reusable: label + primary value + comparator/context + one small visualization + one short factual interpretation + optional detail link |

Every visualization: has a text equivalent; avoids colour-only meaning; works at 360px; stays
understandable at zoom; exposes accessible names/descriptions; shows sample/evidence context.

Prefer native SVG/CSS/React. Do not add a large chart library solely for this work.

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

## 17. Explicit anti-patterns

- responsive = the desktop layout stacked vertically;
- a detached metric grid ahead of the Today Next Action;
- a card for every metric or text fragment;
- routine 9px primary UI text; shrinking text to preserve desktop density;
- competing per-surface match components;
- showing a placeholder as a final score; treating planning-closed/finalized-planning as match
  completion;
- drag-only player movement; hover-only actions;
- a compact Players view that is a dump of every desktop column;
- radar/spider player charts, an overall player score, player rankings, red/green good-bad
  colour scales, causal wording from correlation;
- a separate mobile app or a separate mobile route tree;
- UI-local copies of domain rules or client-only validation shortcuts;
- reintroducing a coach-operated Finalise round / Finalise match action.
