# Navigation Model

## Product intent

Matchboard should have one coherent operational path for coaches. Menu labels must match the user's mental model and must not redirect to unrelated concepts.

## Primary navigation

Use these primary entries:

- **Assistant** `/assistant`
- **Fixtures** `/fixtures`
- **Teams** `/teams`
- **Players** `/players`

Remove from primary left menu:

- **Today** — replaced by Assistant
- **Matches** — was a redirect to Rounds, now replaced by Fixtures
- **Rounds** — remains as an internal route for round review, not a primary navigation entry
- **Rules** — merged into Team Configuration
- **Season** — demoted to Reports if Reports is added, otherwise accessible from Fixtures

## Assistant

Assistant is the default workflow surface. It replaces Today.

- `/assistant` is the default landing page.
- `/` (root) redirects to `/assistant`.
- `/today` redirects to `/assistant`.
- The Assistant page shows the issue inbox and workflow guidance.

## Fixtures

Fixtures is the one-stop shop for periods, rounds, and matches.

- `/fixtures` shows matches grouped by planning period and round.
- Coaches operate auto-selection at round level, but they must see individual matches in a grouped fixture list.
- Round-level actions (generate, review, finalize) link to `/rounds/[roundId]/review`.
- Match-level actions (review, post-match) link to `/matches/[matchId]/review` and `/matches/[matchId]/post-match`.

## Teams

Teams is the home for team setup, squad configuration, and rule configuration.

- `/teams` lists teams with "Configure" and "Review" actions.
- `/teams/[teamId]/configuration` is the Team Configuration page.
- `/teams/[teamId]/review` remains for team readiness review.
- Rules are surfaced through Team Configuration, not a separate nav item.

## Players

Players is the team assignment board.

- `/players` shows a drag-and-drop board with columns per team plus Unassigned.
- Dropping a player persists the assignment to the backend.
- Player cards show ID, name, position, and open issue count.
- No ability scores, ranking, best-XI language, weak/strong labels, or judgement wording.

## No duplicate paths

Do not create multiple left-menu choices that point to the same concept under different names.

- `/matches` redirects to `/fixtures`, not `/rounds`.
- `/rounds` works internally but is not a primary navigation entry.
- `/rules` works internally but is not a primary navigation entry.