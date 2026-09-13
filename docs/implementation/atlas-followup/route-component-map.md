# Route/Component Map — Atlas Follow-up Phase F0

Audit performed against `main` prior to any Atlas Follow-up implementation work. Covers Round
Board assignment-command reuse, Player Overview/Detail current composition, and the Team
kit-colour storage decision.

## 1. Round Board

**File**: `src/components/round/round-board.tsx` (1,269 lines) + `src/app/(app)/rounds/[matchRoundId]/page.tsx`.

### Current interaction model

- **Native HTML5 drag-and-drop** (not `dnd-kit`) is the current primary interaction on desktop.
- Touch-drag state (`touchDragPlayerId`, `touchDropTarget`) exists, suggesting a partial touch
  accommodation was already attempted — this is not confirmed to be a full "match-first mobile"
  redesign; it needs a full read of the touch-drag code paths at implementation time to determine
  whether it's a real accelerator or the only current mobile path (if the latter, it is exactly
  the "mobile depends on drag" anti-pattern the contract forbids and must be replaced, not kept
  as a fallback).
- **A compact-viewport mode already exists**: `isCompactViewport = useMediaQuery("(max-width:
  839px)")` (line 478), with `selectedMatchId` driving a **single URL-backed match view** at
  compact widths (`isCompactViewport && matches.length > 1` branches at lines 896–1196). This is
  real prior art directly aligned with the contract's "mobile is match-first... selected match is
  URL-backed" requirement (§7) — Phase F6 should **extend and restyle this existing mechanism**,
  not replace it with a new one from scratch.

### Canonical assignment command (the thing every interaction mode must share)

`src/app/(app)/rounds/[matchRoundId]/draft-selection-actions.ts` exports the full mutation set
already used by the current drag-and-drop handlers:

- `addPlayerToMatchAction(formData)`
- `removePlayerFromMatchAction(formData)`
- `changePlayerRoleAction(formData)`
- `movePlayerWithinRoundAction(formData)`

`round-board.tsx`'s drag-drop `onDrop` handler already calls `addPlayerToMatchAction` directly
(confirmed at lines 522 and 629). **This is good news for the bundle's §6 "behavioural command
reuse" requirement**: there is already exactly one canonical mutation surface. A new
click-to-assign flow, a `PlayerAssignmentSheet` (mobile), and an `AllocationMatrix` (desktop
secondary mode) all need to call these same four actions with `FormData` built from their own UI
state — no new server action needs inventing, and no risk of a second, diverging mutation path.

Round-level orchestration (`regenerateRoundAction`, `clearRoundDraftAction`, etc.) lives in the
sibling `src/app/(app)/rounds/[matchRoundId]/actions.ts` and is already wired to the existing
"Auto populate"/"Regenerate" affordances — unaffected by this bundle beyond restyling.

### Plan-integrity / attention source

`computeRoundPlanIntegrity()` (`src/lib/selection/compute-plan-integrity.ts`) is the existing,
canonical source for Blocked/Decision-required/Planning-note signals — this is what the new
`RoundStatusStrip`/`RoundAttentionList` view models must read, not a re-derived signal set.

### What needs to change vs. what can be reused

| Reuse as-is | Needs new UI, same underlying data/actions |
|---|---|
| `addPlayerToMatchAction`/`removePlayerFromMatchAction`/`changePlayerRoleAction`/`movePlayerWithinRoundAction` | `RoundBoardViewModel` builder (contract `08_...md §3`) — currently no explicit typed view model exists; `round-board.tsx` computes lane/attention data inline from props |
| `computeRoundPlanIntegrity()` | `RoundStatusStrip`, `RoundAttentionList`, `PlayerAssignmentInspector`, `PlayerAssignmentSheet`, `AllocationMatrix` — none of these components exist yet |
| The compact-viewport single-match URL pattern | Full match-first mobile decomposition (Overview/Matches local modes per contract §7) — today's compact mode shows one match, not the three-mode (Overview/Matches/Players) structure the contract wants |
| Auto Populate / Regenerate / Save wiring | Desktop lane visual redesign (dense rows, no per-player card wrapper, `TeamKitMark` identity) |

## 2. Player Overview & Player Detail

### Player Overview — current structure

**File**: `src/components/players/players-page-client.tsx` + `src/app/(app)/o/[orgSlug]/players/page.tsx`.

Three existing modes (query-param/URL-backed, confirmed via `mode === "season" | "attention" |
"groups"`), matching AGENTS.md's documented "Players page modes":

| Current mode | Contract's target mode | Mapping |
|---|---|---|
| `season` (Season overview) | `Overview` | Direct rename/restyle — same underlying data (`getPlayersSeasonOverview()` per AGENTS.md), different visual composition (dense roster + selected-player inspector instead of a flat table) |
| `attention` (Current round attention) | `Current round` | Direct rename/restyle — same underlying `computeRoundPlanIntegrity()`-derived data, per AGENTS.md's own existing rule ("must reuse canonical live plan-integrity state only") |
| `groups` (Manage base groups) | **`Development`** | **Not a rename — a different concept.** See open decision below. |

**Open decision requiring explicit confirmation before Phase F5** (per
`00_AUTHORITY_AND_EXECUTION_CONTRACT.md` §5, this is exactly a "smallest decision required" to
surface, not silently resolve): the bundle's third Player Overview mode, `Development`, is
defined as a coaching-work overview (active development focus, latest observation, position
profile summary, decision review state) — it has **no relationship** to the current `groups`
mode's job (stable core-team/base-group registry administration, per AGENTS.md: *"Base-group
management remains separate from weekly planning and seasonal review"*). The bundle does not say
where base-group management should live once `Development` takes the third tab slot. Recommended
resolution to propose at Phase F5: keep "Manage base groups" reachable as a secondary/admin
destination (e.g. from Team settings or a "Manage groups" link within Players, matching the
existing pattern where secondary admin surfaces live under More/Team configuration rather than a
primary tab) rather than removing the capability. This is a UX decision, not a data-availability
problem — the underlying base-group data/actions are unaffected either way.

### Player Detail — current structure

**File**: `src/app/(app)/o/[orgSlug]/players/[playerId]/page.tsx` (single server component) +
14 panel components rendered in one sequential stack: `PlayerEvidenceStoriesPanel`,
`PlayerCoachContextPanel`, `PlayerSquadContextPanel`, `PlayerReadinessPanel`,
`PlayerDevelopmentThreadsPanel`, `PlayerQuickObservationsPanel`, `PlayerDetailsPanel`,
`PlayerReportSummaryPanel`, `PlayerCurrentInvolvementPanel`, `PlayerAvailabilityPanel`,
`PlayerAttributesPanel`, `PlayerOutfieldRoleSuitabilityPanel`, `AssessmentHistoryPanel`, plus
`PlayerPositionProfile` (the current position card, audited separately in the pitch inventory).

**Confirmed: this is genuinely "one long page"** — no tabs, no URL-backed sub-navigation exists
today. This directly matches the bundle README's supersession note ("Remove or update
documentation that says... Player Detail is one long page") and confirms Phase F4/F8 is a real
restructuring, not a cosmetic pass. The good news: the underlying data each panel already reads
(evidence, readiness, development threads, observations, availability, attributes, role
suitability, report summary, involvement) is a near-complete superset of what the contract's four
tabs (Overview/Matches/Development/Evidence) need — this is a **recomposition** of existing,
working data sources into new `Player*ViewModel` builders and new tab-scoped components, not a
build-from-zero data project. Exact panel→tab mapping is implementation detail for Phase F4, not
decided here.

### Opportunity definition — must reuse, not reinvent

Per contract §5 ("Current round mode... use the same opportunity definitions as Round Board. Do
not invent a separate 'missing opportunity' rule"): the canonical signal is
`AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` from `computeRoundPlanIntegrity()` — the exact
same function Round Board's attention list reads (§1 above). The `attention` mode of the current
Player Overview already claims to use this per AGENTS.md; verify this remains true when rebuilding
the view model rather than introducing a parallel definition inside a new Players-specific
service.

### Presentation-builder precedent

`src/lib/touchline/presentation/` already exists (ADR-0136 Atlas programme — `season-view-model.ts`
and siblings, per AGENTS.md's "Season page layout" section mentioning `buildSeasonViewModel()`).
This is the established location and naming convention for the new
`buildPlayersOverviewViewModel()`/`buildPlayerIdentityViewModel()`/etc. builders the bundle's
`08_VIEW_MODELS_AND_COMPONENT_CONTRACTS.md §2` calls for — extend this directory, do not create a
competing one.

## 3. Team Kit Colour Storage Decision

Searched `prisma/schema.prisma`'s `Team` model in full: **no existing colour/kit/hue/accent/shield
field of any kind exists.**

**Decision: a new nullable `kitColor String?` field is required on `Team`.**

- Add via a standard additive Prisma migration (ADR-0105 expand/contract: this is a pure
  additive/optional field with no removal/rename, so it is safe to ship in one PR with no special
  sequencing).
- Validate against a fixed product palette (contract §3: "Validate it against the product
  palette") — a small enum-like string union, enforced at the server-action layer (matching every
  other validated free-text-adjacent field in this codebase, e.g. `playerPositionValues`), not a
  DB-level Postgres enum (keeps the palette easy to extend without a migration).
- Expose in Team settings/configuration: `src/app/(app)/o/[orgSlug]/teams/[teamId]/configuration/page.tsx`
  is the existing, correct location (AGENTS.md: *"`/o/{orgSlug}/teams/[teamId]/configuration` is
  the team workspace for squad settings and rules"*) — add the Kit colour selector there as a new
  field alongside the existing squad-size/support-priority settings, not a new page.
- No blob/image storage, no per-colour asset files — `TeamKitMark` renders the colour as SVG fill
  dynamically (contract §4).

## 4. Summary of biggest risks for later phases

1. **Player Overview's third mode is not a rename** — needs an explicit decision on where base-group
   management moves (flagged above; does not block F0/F1/F2, but should be resolved before F5's
   human gate so the gate isn't reviewing a screen with a missing capability).
2. **Player Detail is a genuine restructuring**, not a redesign of an existing tab system — budget
   Phase F4 accordingly; the data layer is largely reusable, the composition layer is not.
3. **Round Board's touch-drag code needs a closer read at implementation time** to confirm whether
   it already provides a non-drag-dependent mobile path or whether it is itself drag-only and must
   be replaced by the new tap-to-assign sheet.
4. Kit colour is fully net-new (schema + UI) — no ambiguity, straightforward additive work.
