# Gate C W2 — Visual vs. Current Production Comparison

All three candidates reuse the Touchline Design Atlas composition Round Board already has (exception-first status strip, contextual rail, match lanes, inspector/sheet, optional allocation matrix) — this wave made no layout or visual-language change. What changed is data wiring and a small number of interaction corrections, all disclosed in `CURRENT_STATE_AUDIT.md`. Each item below states whether a candidate is a pure baseline confirmation or demonstrates a real, regression-tested production change.

## C04 — Planning open, unresolved player decision

- **Baseline confirmation**: exception-first status strip, attention list, match lanes, inspector/sheet composition, valid/override-required destination distinction — unchanged.
- **Real production change demonstrated**: the new "Eligible players with an opportunity" tile, fed by `RoundPlanIntegrity.coverage` for the first time. Before this wave, no view of this number existed anywhere in the UI.

## C05 — Planning closed, historical warnings

- **Baseline confirmation**: closed banner, per-match `isFinalized` gating of remove/move/repair/add on player chips, live-boundary-not-persisted-status gating (pre-existing, separately regression-tested).
- **Real production change demonstrated**: closed destinations are now excluded from the suggestion list (previously they were offered and could be committed to); a new `closedNotice` explains why nothing is assignable when that's the case, including proactively when the SELECTED player's own match (not just every other one) is closed; mixed-boundary behavior (one match closed, another genuinely open) is now proven end-to-end rather than only separately true in theory. Independent review added two further real changes: the Resolve control in the contextual rail is now gated on a computed `resolvable` flag (so it never renders for an unactionable historical item at all, not merely before an unproductive click), and the retained historical warning itself was corrected to one the real plan-integrity engine can actually produce for a finalized match (`SQUAD_BELOW_MINIMUM`, not `SELECTED_PLAYER_UNAVAILABLE`).

## C06 — Dense allocation, position-precision disclosure

- **Baseline confirmation**: the player×match allocation matrix, mobile assignment sheet, shared assignment command across matrix/board/sheet — unchanged, now exercised at genuine density (54 players, 4 matches) rather than a small illustrative fixture.
- **Real production change demonstrated**: the new "View exact position in Lineup →" navigation link from the inspector — the first time Round Board points a coach toward the actual canonical home for exact tactical identity, rather than staying silent about the gap.
- **Explicitly not demonstrated** (disclosed, not concealed): 24-vs-14 position-precision contrast inside Round Board itself. See `POSITION_VOCABULARY_AND_PRECISION.md` for why this is a genuine source gap, not an oversight in this wave's fixture design.

## What stayed visually identical

`RoundStatusStrip`'s four pre-existing tiles kept their values and tone logic; only labels for two were clarified for accuracy ("Opportunities planned" already existed; "Coverage issues" was relabeled "Squads below minimum" to stop it reading as if it were the new eligible-coverage measure — it was always squad-below-minimum-match-count, never anything about distinct players). `PlayerAssignmentInspector`/`Sheet`'s suggestion cards, the allocation matrix's cell/row/column rendering, and every match lane's chip anatomy are byte-for-byte what production already rendered.
