# Manager Workflow

## Product framing
Matchboard is a grassroots assistant manager. Its primary job is to surface coaching decisions, explain context, recommend actions, show consequences, and record coach decisions.

## Primary workflow
Assistant Inbox
→ Round Review
→ Team/Match Issue Review
→ Recommendation + rule explanation
→ Coach decision
→ Decision audit
→ State update / issue resolution
→ Post-match completion

## Decision lifecycle
1. System creates assistant issue.
2. Coach opens issue.
3. Coach reviews context, recommendation, rules, blockers, warnings, and cross-team impact.
4. Coach accepts, rejects, adjusts, or overrides.
5. System records DecisionRecord.
6. System resolves or keeps the issue open.
7. Affected state is recalculated or marked stale.
8. Coach returns to inbox.

## Assistant Inbox
The Assistant Inbox is the default operating surface. It groups coaching issues into:
- Needs Action
- Watch
- Recently Resolved
- Upcoming

## Round Review
Round Review shows whether a full round is publishable. It shows readiness for Blå, Hvit, and Rød, unresolved issues, support needs, blockers, and publish readiness.

## Team Issue Review
Team issue review shows team readiness, availability, support need, position gaps, rotation pressure, rule impact, and assistant recommendations.

## Match Issue Review
Match issue review shows selected players, unavailable players, unknown RSVP players, eligible-but-not-selected players, blockers, warnings, selection explanation, position coverage, and approval/publish status.

## Player Exception Review
Player exception review explains player-specific issues such as low match exposure, high load, unknown RSVP, floating-gap blockers, or repeated no-show patterns.

## Post-match workflow
Post-match workflow captures actual attendance, no-shows, late cancellations, optional positions, team note, optional player notes, and marks match complete.

## Explainability requirements
Every recommendation must expose:
- summary
- confidence
- rules applied
- warnings
- blockers
- affected teams
- affected players
- cross-team impact

## Override requirements
Overrides require a reason and create a DecisionRecord.

## Privacy requirements
Assistant issues, explanations, decisions, and external payloads store player IDs, not names.