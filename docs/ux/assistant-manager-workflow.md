# Assistant Manager UX Workflow

## Navigation
Add Assistant to the primary navigation. The Assistant page must be the recommended landing page.

## Assistant Inbox layout
Page sections:
1. Needs Action
2. Watch
3. Recently Resolved
4. Upcoming

## Assistant card pattern
Each card shows:
- severity badge
- title
- short summary
- recommended action
- affected team count
- affected player count
- rule count
- primary action
- secondary action where relevant

## Severity labels
Use:
- INFO
- WATCH
- ACTION_REQUIRED
- BLOCKED
- CRITICAL

## Status labels
Use:
- OPEN
- RESOLVED
- DISMISSED
- STALE

## Action model
Cards must link to the relevant review page:
- ROUND issue → /rounds/[roundId]/review
- TEAM issue → /teams/[teamId]/review
- MATCH issue → /matches/[matchId]/review
- PLAYER issue → /players/[playerId]?issue=[issueId]
- POST_MATCH issue → /matches/[matchId]/post-match

## Accept/reject/override UX
Accept creates a DecisionRecord and resolves the issue if no blockers remain.
Reject requires a reason if the issue remains unresolved.
Override always requires a reason.

## Cross-team impact UX
Cross-team impact must show:
- source team
- target team
- player ID
- positive effects
- negative effects
- rule conflicts
- fairness impact
- load impact
- impact level

## Empty states
Inbox empty state:
"No open coaching issues. Upcoming rounds are currently under control."

Round Review empty state:
"No generated squad draft exists for this round."

Post-match empty state:
"No post-match report started."

## Mobile behavior
Stack sections vertically. Cards remain fully readable. Tables may become card lists.