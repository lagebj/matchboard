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
| Keyboard operation | Yes | Reused as-is — `LeagueSeasonRail`'s real keyboard handling (`handleKeyDown`) is unmodified production code; not re-tested here beyond what Gate A/B/C/D's own keyboard-accessibility precedent already established for Touchline primitives, since this wave introduces no new interactive primitive | No | No further keyboard-specific Gate E test beyond the existing Touchline baseline — not required by E01's register row, which asks about temporal identification, not accessibility conformance per se |
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

- "Generate all draft squads" and "Create match" (real Server Actions in production) are not
  rendered at all in the fixture mount — there is no safe way to represent either without
  invoking a real Server Action from a synthetic control (mission brief §11). This is a
  disclosed, deliberate omission, not a presentation gap: E01's acceptance question does not
  require either action.
- Keyboard-level re-verification of `LeagueSeasonRail`'s own existing keyboard handling — reused
  as real, unmodified production code; not independently re-tested here.
