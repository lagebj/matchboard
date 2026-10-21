# Gate B W2 — Three/Four-Part Experience Contract

Reuses ADR-0157 §1's existing knowledge hierarchy verbatim — this wave does not invent a second
one, same as Gate B W1.

## The hierarchy, as it applies to B05

1. **Fact** — final score, attendance, goal minutes, debrief answers. Rendered by
   `MatchIdentityCard`/`PostMatchReportHeader`'s `MetricStrip`, `PostMatchSummaryTab`,
   `PostMatchDebrief`'s read-only view.
2. **Deterministic evidence** — `aggregateGoalScorers()`/`aggregateAssistProviders()`/
   `buildMatchTimeline()`/`buildPlayerInvolvement()`'s own computed output over the raw facts
   (see `DATA_TRUTH_AND_FIXTURES.md`). Rendered by `PostMatchSummaryTab`, `MatchTimelineList`,
   `MatchCombinationEvidencePanel`.
3. **Coach observation/judgement** — the guided debrief itself (team execution ratings, what
   worked/needs attention, match-changes, opponent memory, player observations) and the team
   note. This wave is the first Gate B scenario to render a genuinely mutable coach-judgement
   surface at all (`PostMatchDebrief`'s interactive wizard, DRAFT state) — Gate B W1 explicitly
   noted "no mutating coach-input control is reused" for B01-B04; B05 is exactly the surface
   where that changes, because the register row is specifically about the editable/locked
   distinction.
4. **Assistant Coach hypothesis** — not exercised by this wave. Post-Match Report's Summary tab
   has no Match Insights/Assistant-Coach surface in production (confirmed by reading
   `post-match-summary-tab.tsx` directly — it renders facts and deterministic evidence only); B07
   (Assistant Coach longitudinal, deferred) is where this tier belongs for this family of
   surfaces, per Gate B W1's own `BLOCKERS.md`.

These tiers are not visually blurred by this wave: the debrief's own UI already separates a
recorded answer (fact, once `SUBMITTED`) from the deterministic counts shown elsewhere on the
same page — nothing in B05 presents a deterministic count as if it were a coach's own judgement
or vice versa.

## Editable vs. locked is itself the fourth contract dimension this wave adds

Gate B W1's hierarchy is about *what kind of knowledge* is shown. B05's register row
("Editable vs locked") adds an orthogonal dimension — *whether the coach can still change it* —
which this wave demonstrates structurally: every mutation surface (`Complete report`, goal/
assist/attendance editing, the debrief wizard, additional-observations forms) is present and
real in the draft fixture and genuinely absent (not merely disabled) in the completed one,
because the real components themselves gate on `status`/`surfaceState`, not a UI-Lab-local flag.
