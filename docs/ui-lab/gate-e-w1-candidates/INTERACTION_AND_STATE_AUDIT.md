# Gate E W1 — Interaction and State Audit

## Required interactions (per the mission brief §9 and §17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md)

| Interaction | Required? | Implemented | Simulated | Deferred |
|---|---|---|---|---|
| Context-local decisions | N/A for E01 — League's focused round/history rows are read/navigate-only; no decision/mutation surface exists in this scenario's register row | — | — | — |
| Correct selected-object navigation | Yes | Yes — period/round selection updates the real URL (`season`/`round` params), matching ADR-0144's "URL as selection authority" exactly | No | No |
| Tab and filter persistence | N/A — League has no local tab; "earlier rounds" disclosure is deliberately non-persisted (matches production) | Yes (verified the toggle resets per round the same way production does) | No | No |
| Source-detail disclosure | N/A — no evidence/source drilldown exists in E01's register row | — | — | — |
| Expand/collapse behaviour | Yes — "Show earlier rounds" | Yes | No | No |
| Empty-state actions | Yes — season-closed state (no current round) | Yes (honest fallback label, no fabricated action) | No | No |
| Disabled-state explanations | N/A — no disabled control exists in E01 | — | — | — |
| Keyboard operation | Yes | Yes (E01-R6 remediation) — `e2e/ui-lab-gate-e.spec.ts` focuses a season-rail slot, moves focus with `ArrowRight`, and activates the target with `Enter` (real `LeagueSeasonRail.handleKeyDown`, unmodified production code); a separate test focuses the season `<select>` and changes it with `ArrowDown`. Both assert the resulting URL/round-focus change, not merely that a control is reachable | No | No |
| Focus management | Partial | Not independently re-verified in this wave (no new focus-trap/dialog introduced — the mount adds no new interactive primitive beyond what `LeagueSurface` already manages) | No | Could be added in a future pass if a later wave touches League's own focus behaviour |
| Desktop and mobile layouts | Yes | Yes — captured at 1440×900, 390×844, 320×720 (capture script), and overflow-checked at 390×844 in Playwright | No | No |
| Horizontal overflow at narrow width | Yes | Yes (Playwright, both states, 390px) | No | No |

## Simulated vs. real interactions

**Nothing in this wave is simulated.** E01 has no mutation, no Assistant Coach surface, and no
Server Action to avoid invoking — every interaction (period select, round select, disclosure
toggle) calls the real, unmodified `router.push()`/`useSearchParams()` URL-state logic that
production's own `FixturesPage` uses, against the real, unmodified `buildLeagueOperatingViewModel()`
and `LeagueSurface`. This is a materially different situation from Gate C W3/Gate D W2's
"actions-override mount" pattern, which exists specifically to intercept a *mutation* handler —
E01 has no mutation to intercept.

## What is deliberately NOT implemented

- "Generate all draft squads" — the one real Server Action `FixturesPage` wires — is not rendered
  in the fixture mount; there is no safe way to represent it without invoking a real Server Action
  from a synthetic control (mission brief §11). This is a disclosed, deliberate omission, not a
  presentation gap: E01's acceptance question does not require it. "Create match" **is** rendered
  — it is a plain navigation link (`/o/{orgSlug}/matches/new`), not a mutation, so it carries none
  of that risk and is kept for layout/composition fidelity with real production.
## Context restoration: what this wave proves, and what it does not (E01-R6)

The register's acceptance question ("period navigation + context restoration", citing XR-T01)
traces to XR-T01's own text: "Moving period → round/event → match → back restores the selected
context and appropriate anchor whenever navigation permits" and its reject case "loss of active
round/date on return." That is a claim about **selected-context restoration on return
navigation** (direct URL load, browser Back/Forward) — not about a period remembering a
previously-selected round after the coach switches away to an unrelated period and back.
Production does not implement the latter: `handleSelectPeriod()` (`fixtures-page.tsx`, reproduced
verbatim in `league-fixture-mount.tsx`) explicitly clears the `round` URL param on every period
change (`setQueryParams({ season: periodId, round: null })`), and the destination period's own
`resolveDefaultFocus()` then re-resolves its default round honestly from scratch.

This wave proves, with real browser evidence in `e2e/ui-lab-gate-e.spec.ts`:

- **Default-focus re-resolution** (switching Spring → Autumn → Spring correctly re-derives each
  period's own current/needs-closure round, never caching or carrying over the other period's
  selection) — a distinct, equally real claim, but not "context restoration" in XR-T01's sense.
- **Selected-context restoration** — directly loading a URL with an explicit `round` param
  restores that exact round with no click; browser Back after selecting a different round restores
  the previously-focused round; the URL's `round` param is confirmed cleared (not merely
  unobserved) on period switch.

It explicitly does **not** claim, and no test or document in this folder should be read as
claiming, that manually selecting a historical round, switching to a different league season, and
switching back restores that manual selection — production has no such memory, and inventing one
in UI Lab would misrepresent the real app (mission brief §16, "no per-period round memory without
an explicit approved requirement"). If this stronger behaviour is ever desired, it is a production
capability gap requiring an explicit product decision, not something to add here.

## Keyboard operability (E01-R6 remediation)

Both interactive controls `league-fixture-mount.tsx` renders are now keyboard-tested with a real,
meaningful interaction (focus → move → activate), not merely a reachability/`tabIndex` check: the
season rail (`ArrowRight` + `Enter`) and the season `<select>` (`ArrowDown`). `LeagueSeasonRail`'s
keyboard handling itself is unmodified production code; these tests verify E01's own fixture wires
it correctly, not that the primitive's internals changed.
