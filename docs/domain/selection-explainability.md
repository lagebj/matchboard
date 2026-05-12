# Selection Explainability

## Ownership boundary
The selection engine owns eligibility, support priority, floating rules, squad caps, match load fairness, and readiness calculations.
The UI only displays engine output and records coach decisions.

## Required output contracts
The assistant workflow uses:
- AssistantIssue
- RuleImpact
- Recommendation
- CrossTeamImpact
- SelectionExplanation
- DecisionRecord
- PostMatchReport
- PostMatchPlayerActual

## AssistantIssue
Represents an actionable or informational coaching issue.

## RuleImpact
Represents a rule affecting a player, team, match, or round.

## Recommendation
Represents the assistant recommendation and its confidence.

## CrossTeamImpact
Represents the consequence of moving/supporting a player across teams.

## SelectionExplanation
Represents why a player/team/match/round state exists.

## DecisionRecord
Represents coach action, acceptance, rejection, override, or publish decision.

## Privacy
All explanation payloads use player IDs. Names are display-only and resolved separately.