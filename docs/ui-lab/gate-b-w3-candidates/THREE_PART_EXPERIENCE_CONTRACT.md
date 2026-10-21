# B06 — Experience contract

ADR-0157 §2 ("Knowledge hierarchy — four visible semantic classes") requires every statement
shown to a coach to be exactly one of: **Fact**, **Deterministic evidence**, **Coach
observation/assessment**, or **Assistant Coach hypothesis** — and that the UI never visually
blur these four classes.

## The hierarchy, as it applies to B06

1. **Fact** — the only tier either of B06's four pages actually render: match identity
   (team/squad/opponent/kickoff/score), lineup assignments, attendance, goals/assists, the
   debrief's recorded answers, and the combination-evidence rows' raw counts.
2. **Deterministic evidence** — not exercised. B06's League · Before omits `MatchInsights`
   deliberately (B01's own territory; re-demonstrating ranked insight evidence is not this wave's
   job — see CURRENT_STATE_AUDIT.md's component-reuse table).
3. **Coach observation/assessment** — rendered once, read-only: Event · After's guided debrief
   (`PostMatchDebrief`, `readOnly`) and football observations (`FootballObservationSection`,
   `isLocked`) are explicit coach-authored judgement, visually distinct from Fact via their own
   established components' styling (unchanged by this wave).
4. **Assistant Coach hypothesis** — not exercised anywhere in this wave. `assistantCoachState` is
   `NOT_APPLICABLE` on every B06 candidate in `candidate_manifest.json`.

## The orthogonal dimension B06 adds: origin (League vs. Event)

Where B05 added "Editable vs. locked" as its own fourth contract dimension, B06 adds **origin**:
every fact rendered must stay attributable to its real source model without visual blending.
Concretely:
- League's `MatchIdentityCard` always carries a real kit colour (`MATCH_B_TEAM_KIT_COLOR`);
  Event's always passes `ownKitColor={null}`, rendering the real neutral shirt — not a missing
  colour, a schema fact (Event squads have no kit-colour concept, per
  `planning-pitch-assignment-projection.ts`'s own doc comment).
- Event's identity line always names both the `Event` and the `EventSquad` explicitly
  (`eventName`/`eventSquadName`) — League's identity has no equivalent extra layer, and this
  wave does not invent one to force a false symmetry.
- Event's eligible-participant badges distinguish squad / helper (amber "H") / guest ("Guest")
  using the real production vocabulary (`EligibleEventMatchPlayer.source`/`participantType`) —
  League's squad has no helper/guest concept at all, and none is fabricated for it.

No fact on any B06 page is ever presented as if it came from the other origin's model.
