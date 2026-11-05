# Gate B W4 — Experience Contract (B07)

ADR-0157's four knowledge classes, as actually applied to each B07 scenario.

## Class 1 — Fact (canonical recorded match state)

Both scenarios: `matchIdentity` (final score, opponent, kickoff), `timeline`
(`MatchTimelineItem[]`, real `GOAL_FOR`/`GOAL_AGAINST`/`MATCH_END` kinds). B07-B's hat-trick is
three individually logged `GOAL_FOR` items with `playerName: "Noah"` — Class 1, reported via the
real `MatchTimelineList`/`MetricStrip` components, unchanged.

## Class 2 — Deterministic evidence (computed measurements from canonical records)

B07-A's timed goal-against events (23' this match, 61'/54' in the two prior matches) are Class 2
— a reproducible fact about *when*, computed from nothing more than the recorded event minute.
This fixture never promotes a Class-2 measurement into a Class-4 causal claim on its own; the
*why* is always attributed to Class 3.

## Class 3 — Coach observation/assessment (attributed human judgement)

The three debrief notes (`B07_PRIOR1_DEBRIEF_NOTE`, `B07_PRIOR2_DEBRIEF_NOTE`,
`B07_HISTORICAL_DEBRIEF_NOTE` in `gate-b/shared/match-b-fixture.ts`) are Class 3 — the coaching
staff's own recorded words, not a measurement and not this review's own interpretation.
`EvidenceSourceLabel: "Coach observation"` is production's own label for exactly this class.

## Class 4 — Assistant Coach hypothesis (interpretation supported by cited evidence)

B07-A's primary insight ("Conceding after a lost throw-in on the right is a recurring concern")
is Class 4 — it synthesizes Class 2 (three timed goal-against events) and Class 3 (three debrief
notes) into a named pattern, explicitly hedged ("recorded in 2 of the last 2 prior completed
matches' debriefs... not every match this team has played raised it"), with a practical
implication (the paired "Next focus" insight). B07-B's Advisor summary
("No historical pattern identified from the available evidence.") is also Class 4 — a hypothesis
that explicitly declines to find a pattern, not an absence of the Advisor layer altogether.

## What this fixture never does

- Never turns Class 2 (a goal-against event) directly into Class 4 (a defensive-transition claim)
  without a Class-3 record establishing the relationship — the brief's own named anti-pattern.
- Never turns Class 3 (a debrief note) into Class 2 (treating the coach's own account as an
  objective measurement).
- Never fabricates a numeric confidence score for the Class-4 hypothesis (`fixtures.test.ts`
  asserts this directly).
- Never treats two mentions of the same match's same event as two independent Class-2 or Class-3
  records (B07-A's three debrief notes are three distinct matches, verified by distinct `scope`
  strings in a dedicated test).
