# Gate A W3 — Action Ownership

Per `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`'s mandatory decision rule: every action states its
origin object/screen, purpose, host, editing representation, canonical server/domain owner
**verified from current source**, pending/success/rejection/conflict feedback, context
restoration, and navigation classification + rationale. Default is `SAME_VIEW`; this wave only
ever uses `SAME_VIEW` or `CONTEXT_SHEET`/`CONTEXT_INSPECTOR` — no `SEPARATE_WORKSPACE`, no
`NEW_PAGE`.

## A03 — decision anatomy (all four scenarios)

| Field | Value |
|---|---|
| Origin object/screen | A fictional League match (`match-w3-01`) and its round, standing in for a Round Board/Today decision card |
| Action purpose | Present situation → permitted/unavailable action → consequence → inspectable reason (A-F3 decision anatomy), never a KPI grid |
| Host | `SAME_VIEW` — an inline toggle on the same page, never a dialog or route change |
| Editing representation | None — A03 is read-only. The "permitted action" button (S1) and "Review plan" button (S2) only toggle an inline disclosure panel open; they perform no mutation |
| Canonical server/domain owner | None invoked — this candidate deliberately does not call any domain service. Verified in source: `isMatchPlanningEditable`/`isPlanningBoundaryClosed` (`src/lib/selection/planning-boundary.ts`) is the real owner of the planning-open/closed fact this fixture illustrates |
| Pending/success/rejection/conflict feedback | N/A — no mutation exists to have these states |
| Context restoration | N/A — no dialog opens, nothing to restore |
| Navigation classification + rationale | `SAME_VIEW`. Rationale: A03 demonstrates decision grammar, not an editor; the actual edit action it points to (assigning the pending starter) is A07's job, explicitly deferred via copy text on S1, never performed here |

## A07 — Match Details edit lineup (all six scenarios)

| Field | Value |
|---|---|
| Origin object/screen | Match Details BEFORE, Lineup tab, for `match-w3-01` |
| Action purpose | Edit a lineup slot assignment (fill the unfilled RCM slot with the pending starter) without leaving Match Details |
| Host | `CONTEXT_INSPECTOR` (desktop, `aria-modal="false"`) / `CONTEXT_SHEET` (mobile, `TouchlineBottomSheet`, `aria-modal="true"`) — `useMediaQuery("(min-width: 600px)")` picks exactly one, same pattern as A01's `LineupContextualInspector`/sheet pair and Round Board's `PlayerAssignmentInspector`/`Sheet` |
| Editing representation | Select the one eligible already-squad candidate for the slot → diff preview (`"RCM: Empty → Tobias — draft, not yet saved"`) → `Confirm assignment` → `PENDING` (fixture-simulation gate, advanced by an explicit "Continue fixture simulation →" control, never a real timer) → resolved outcome |
| Canonical server/domain owner | **Not invoked.** Verified in source as the real future owner: `src/app/(app)/matches/lineup-actions.ts`'s `assignPlayerToSlot`, gated by `requirePlanningEditable`/`isMatchPlanningEditable`. This UI Lab candidate's `predeclaredOutcome` constants stand in for what that service would eventually return — they are not derived from any local permission algorithm |
| Pending/success/rejection/conflict feedback | `PENDING` ("Saving… (fixture simulation)"), `SUCCESS` ("Saved (simulated)" + pitch re-renders Tobias at RCM from the real `useFixtureOperation.authoritative` state), `PERMISSION_DENIED` (reason text, pitch unchanged, draft preserved), `CONFLICT` (expected/current revision + summary, pitch unchanged, draft preserved, "Discard draft" offered), `PLANNING_CLOSED` (reason text, no save possible, draft preserved) |
| Context restoration | Match identity, team/opponent/kickoff, and the "BEFORE · Lineup tab" label stay visible throughout every state (open/draft/pending/resolved) — the trigger button and pitch never unmount. Closing (X, Escape, or the dirty-draft guard's confirmed discard) restores focus to the "Edit lineup" trigger |
| Navigation classification + rationale | `CONTEXT_INSPECTOR`/`CONTEXT_SHEET`. Rationale: XR-I01 — `Edit Lineup` is a same-object edit; a contextual inspector/sheet is the approved exception to inline-only editing when the task benefits from focused space, not a route change |

## A09 — Today quick action (all six scenarios)

| Field | Value |
|---|---|
| Origin object/screen | Today, for the same `match-w3-01` fixture — standing in for Today's actual same-day matchday surface |
| Action purpose | Add an eligible player to the match from Today, without a trip through Match Details — for S1–S5 a normal **planned-selection** addition; for S6 the **separate** operational `MATCH_DAY_ADDITION` path |
| Host | `CONTEXT_INSPECTOR` (desktop) / `CONTEXT_SHEET` (mobile), same `useMediaQuery` picker as A07, body shared via `TodayQuickActionBody` |
| Editing representation | Select the candidate (when eligible) → diff preview (count "8/9 → 9/9 — draft, not yet saved", or S6's separate operational-roster line) → `Confirm` (the scenario's `actionLabel`) → `PENDING` → resolved outcome |
| Canonical server/domain owner | **Not invoked.** Verified real future owners: for S1/S4/S5 (planned selection) the Selection/RSVP boundary this fixture illustrates has **no production equivalent today** — Matchboard has no automated deadline-driven RSVP mechanism (see `CURRENT_STATE_AUDIT.md`); for S6 (match-day addition) the real owner is `src/app/(app)/matches/match-helper-actions.ts`'s `addLeagueMatchHelperAction` with `provenance: "MATCH_DAY_ADDITION"`, eligibility-checked by `assertLeagueMatchHelperEligible` (`src/lib/matches/match-helper-eligibility.ts`) — this candidate's S6 `reasons` text mirrors that function's real, narrow scope (not-cancelled, active player, not-already-participant) without claiming it was actually invoked |
| Pending/success/rejection/conflict feedback | Same five-state vocabulary as A07 (`PENDING`/`SUCCESS`/`PERMISSION_DENIED`/`CONFLICT`/`PLANNING_CLOSED`), applied to a count instead of a pitch slot. S2/S3 are blocked-at-entry (candidate row disabled, no draft ever forms) rather than denial-after-confirm — disclosed explicitly in `candidate_manifest.json`'s `knownGaps` for those two entries |
| Context restoration | Today header (date, match reference, round) stays visible throughout every state; closing restores focus to the trigger. S6 additionally keeps a **separate, always-visible** "Planned squad: 8/9 (unchanged)" line so the two counters (planned-selection vs. operational roster) never visually merge |
| Navigation classification + rationale | `CONTEXT_INSPECTOR`/`CONTEXT_SHEET`. Rationale: XR-I01 — a same-day quick action completes in a contextual surface anchored to Today, never a detour through Match Details |
