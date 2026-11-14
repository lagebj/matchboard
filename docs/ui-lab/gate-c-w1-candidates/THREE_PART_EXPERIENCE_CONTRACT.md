# Gate C W1 — Three-Part Experience Contract

Per the brief's §8 and ADR-0157 §4's four evidence classes. This wave shows exactly three of the
four on any Today surface, and never blurs them:

1. **Canonical fact** — directly persisted/derived domain state: match identity, kickoff,
   lifecycle status, selection state, availability, lineup presence. Rendered plainly, with no
   confidence language.
2. **Deterministic evidence** — plan-integrity signals, situational decisions, matchday
   readiness/action. Produced by pure, DB-free resolvers (`today-primary-action.ts`,
   `today-matchday-readiness.ts`, `today-matchday-phase.ts`) from already-computed facts; every
   reason shown traces to a closed, named reason code or the signal's own fields, never
   freeform prose.
3. **Coach observation** — not present in any C01-C03 scenario; Today's own peer/development
   review section (`DueDecisionReviewSection`) is the one place a coach's own prior observation
   surfaces, and this wave's fixtures leave it empty (no due reviews) rather than fabricate one.
4. **Assistant Coach hypothesis** — **not applicable to this wave.** `CURRENT_STATE_AUDIT.md`
   confirms zero Assistant Coach wiring exists in Today at all today; C01-C03 correctly show
   Today's deterministic baseline with no hypothesis class present, rather than inventing one.
   `candidate_manifest.json` marks every C01-C03 candidate's `assistantCoachState` as
   `NOT_APPLICABLE`. Demonstrating the real OFF/ON contrast is C07's job (deferred — see
   `BLOCKERS.md`), not this wave's.

No candidate in this wave visually represents a hypothesis as a verified fact, or a coach
observation as canonical evidence — there is simply no hypothesis or observation data in any of
these three fixtures to blur in the first place.
