# Gate C W3 — Source Reconciliation

Register rows (from `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`, the handoff bundle's CSV — not tracked
in `docs/`, quoted here verbatim as every prior Gate C wave has done since no official Gate C
wave-ordering document exists in-repo):

```
C07,C,Today,Assistant Coach context-free fallback,Decision day with capability OFF / ON,Desktop + mobile,Same priority and layout when OFF; only material contextual synthesis when ON,TodaySurface; situation policy; no second ranking,Needs golden,GATE_C,DIRECTIONAL_ONLY,NOT_READY,,b070df73664d816f1b0ebc61d54487a24044972e
C08,C,Round Board and Today,Same-day quick add,Planning open / after RSVP / closed / guest / late arrival,Mobile + desktop,No route labyrinth; permission-specific action, existing validation, accurate consequence,Selection/RSVP; Today and Round Board,Needs golden,GATE_C,DIRECTIONAL_ONLY,NOT_READY,,b070df73664d816f1b0ebc61d54487a24044972e
```

Neither has ever been attempted. Gate C W1 (PR #826, C01-C03) and W2 (PR #829, C04-C06) both
explicitly deferred both, with disclosed reasons — see each wave's own `BLOCKERS.md`.

## Authority conflict and its resolution — C07

W1's `BLOCKERS.md` treated "a fixture that merely simulates an ON state without any real
underlying wiring" as a documented prohibition for C07, because Today had (and still has) zero
real Assistant Coach data loader. **This wave's own brief explicitly overrides that stance**,
verbatim: "The original Gate C W1 audit deferred C07 because Today had no production Assistant
Coach hypothesis integration. This wave explicitly authorizes a fixture-driven UI Lab candidate
without requiring that production integration. A mocked candidate is not evidence that the
production capability exists."

This is a disclosed authority override, not a silent change to the requirement: W1's objection was
specifically about *misrepresenting* a fixture as implemented capability. This wave satisfies that
underlying concern by (a) reusing the real, already-shipped Assistant Coach presentation
components verbatim (`AssistantCoachHypothesisPanel`, `AdvisorPanelStale`, `AdvisorPanelUnavailable`
— nothing new was built for this wave), (b) adding only the smallest possible integration seam to
`TodaySurface` (one optional prop, rendering nothing when omitted — see
`CURRENT_STATE_AUDIT.md`), and (c) explicitly disclosing, in `C07_PRODUCTION_INTEGRATION_GAP.md`,
that Today still has no real production data loader. No ADR amendment was opened for this
seam — per explicit instruction, the disclosure lives in this wave's own doc set, the same way
prior waves disclosed deferrals rather than opening new architecture process for them.

## C08's real scope was larger — and smaller — than the register implies

C08 was deferred in W1/W2 because it is jointly owned by Round Board and Today, and Round Board's
own Gate C wave (W2) hadn't shipped yet. That dependency is now satisfied.

Investigating C08 against the real codebase (not the register's one-line gloss) found:

- **C08-A/B/C (same-day quick add, eligible player)**: Today already has a real, fully-authorized
  quick-add — `applyTodaySelectionRecommendationAction` → `addPlayerToDraftMatch`, the same
  canonical mutation and authorization path Round Board uses. **No new application code was
  needed** for this half of C08; the gap was test/fixture coverage, not capability.
- **C08-D/E (guest, late arrival)**: ADR-0151's 3-path "Add player" action (`AddPlayerDialog`) is
  already fully implemented and live on the Match Details Tactics tab, despite the ADR document
  itself still saying "Status: Proposed" (fixed in this branch — see below). It already satisfies
  the shape of both scenarios with **no new mutation**, but building against it surfaced two real
  gaps, disclosed in `BLOCKERS.md` and fixed/filed respectively.
- **"After RSVP" has no real analog.** Matchboard has no automated RSVP-deadline mechanism — see
  `DATA_TRUTH_AND_FIXTURES.md`, same disclosure precedent as Gate A's A09.

## ADR-0151 status correction

ADR-0151 ("Match-day roster changes and operational participation") said "Status: Proposed" while
its decisions 1-3 were fully implemented and shipped in production code (`HelperProvenance`,
`MatchHelperAssignment.provenance`, `addLeagueMatchGuestAction`'s `skipRoundRegistration`, the
3-path `AddPlayerDialog`). Flipped to **Accepted** in this branch as a same-branch documentation
correction, with a status note recording what was confirmed and what new gap this wave found — see
the ADR file itself.

## Issues #827 / #830

Both remain open, pre-existing, unrelated to this wave. This wave uses its own new, non-shared
fixture directory (`gate-c/w3-shared/`), following W2's precedent, specifically so it cannot
re-trigger #827's fingerprint-invalidation mechanism. #830 (Round Board ~840-1200px desktop gap)
is not touched; C08's fixtures are Today-side only and do not exercise Round Board's layout at
all in this wave.
