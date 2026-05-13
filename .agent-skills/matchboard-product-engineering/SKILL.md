---
name: matchboard-product-engineering
description: Matchboard-specific domain rules for selection, squad planning, round workflow, explainability, and audit. Use for any user-facing Matchboard work alongside the global app-product-engineering skill. This skill contains ONLY Matchboard domain rules — generic UX/app rules are in the global skill, not duplicated here.
---

# Matchboard Product Engineering

## Always apply

When working on Matchboard user-facing features, apply both:

1. **Global `app-product-engineering` skill** — generic UX, interaction, accessibility, workflow, and implementation quality rules
2. **This skill** — Matchboard-specific domain rules

Do not duplicate the global skill's rules inside this file.

## Assistant Manager workflow

The Today/Assistant page must always show the next action based on workflow state:

1. **Setup** — Add teams, add players, add matches. Mark player availability.
2. **Populate all** — Generate draft selections for all rounds. No round is finalized.
3. **Review** — Inspect drafts, warnings, fairness impact. Resolve blockers. Manually adjust if needed.
4. **Finalize** — Lock one round at a time, or lock individual matches within a round.

The assistant must not skip steps or suggest finalization before draft review.

## Fixtures workflow

Fixtures (`/fixtures`) is the one-stop shop for the period → round → match hierarchy.

- Primary action: populate all, generate round, finalize
- Each level shows readiness state, warning counts, selected player counts
- Actions cascade: populate all generates all non-finalized rounds; generate round generates one round; finalize locks selections

## Team configuration

`/teams/[teamId]/configuration` is the team workspace for squad settings and rules.

- Squad settings form: target, min, max squad size and support priority rank (editable)
- Rule list: shows how rules affect this team; global rules are read-only; team-scoped rules have an Edit button that scrolls to the relevant setting
- Configuration edits must persist via server actions, not only client state

## Player assignment board

`/players` is a drag-and-drop board for assigning players to teams.

- Column layout: team columns + unassigned column
- Drag-and-drop persists to backend via `movePlayerToTeamAction`
- Double-click reveals MoveTo dropdown as accessibility fallback
- Role is determined automatically on drop (CORE for core team, SUPPORT/DEVELOPMENT per rotation path, override required if no path)
- BACKFILL is never a user-facing role choice
- Player IDs in stored payloads, names for display only

## Selection engine ownership boundary

Selection logic belongs in `src/lib/selection/*`. Rule loading belongs in `src/lib/rules/*`.

Do not duplicate selection-engine logic in UI components. UI displays engine output and records coach decisions.

The orchestrator must be thin. Selection concerns are:
- round orchestration (`generate-round.ts`)
- per-match generation (`generate-selection.ts`)
- rotation path policy (`rotation-path-policy.ts`)
- invariant validation (`validate-generated-round-invariants.ts`)
- support selection, squad repair, development selection
- controlled double-load evaluation
- core selection, season fairness, conflict validation
- warning generation and persistence, explanation generation
- manual edit validation, draft clearing, draft regeneration
- finalization/snapshotting

Do not grow a monolithic `generate-selection.ts`.

Rules must be testable without React.

## Explainability

Every non-obvious selection decision must have an explanation:

- Why was a player sent as support? → rotation path + team need
- Why was a player not selected? → conflict, availability, or fairness rotation
- Why was a player double-loaded? → controlled exception with reason
- Why does a warning exist? → severity, affected entity, blocking condition

Explanations are stored in the database and displayed to the coach. If the UI cannot explain a selection result, the engine must provide the explanation.

## Decision audit

Selection-affecting actions must create an auditable `DecisionRecord`.

Do not store player names inside assistant issues, explanations, recommendations, decision records, or cross-team impact payloads. Use player IDs.

Override reasons must use structured categories (`overrideReasonCategory` enum), not generic free text. Free-text detail is required for overrides of hard rules.

## Post-match

Post-match review is for finalized rounds only. It shows what happened, not what should happen.

Post-match data is historical. Finalized selections cannot be silently mutated.

## Player ID privacy

Never commit real player names, private roster data, or database credentials.

In stored payloads and external/public payloads, use player IDs. Resolve names for display only.

Do not introduce ability scores, best-XI language, permanent weak/strong labels, or public player ranking.

## Child-safety language

Use neutral coaching language for all movement and selection descriptions:

| Concept | Use | Never use |
|---------|-----|-----------|
| Player sent to another team for support | Sent as support | Demoted, benched, punished, failed |
| Player received from another team | Received support, received squad repair, received development | Promoted, upgraded, reward |
| Player not selected for a round | Dropped, not selected this round | Benched, failed, weak player |
| Player moved for development | Development movement, development rotation | Promoted, rewarded, upgraded |
| Player filling a gap | Squad repair, cover, repair after support | Replacement, substitute, backfill (in UI) |
| Team with fewer players than target | Short, below target | Weak team, B-team, reserve team |
| Team donating players | Donor team, support source | Stronger team, higher team |
| Team receiving players | Receiving team, support target | Weaker team, lower team |

BACKFILL remains the internal code role. Use "squad repair" in all user-facing UI and documentation.

## Readiness states

Round and match readiness has five states:

| Status | Meaning |
|--------|---------|
| NOT_GENERATED | No selections yet |
| DRAFT | Selections generated, not finalized |
| BLOCKED | Draft with HARD_BLOCK warnings |
| READY | Draft with no blockers |
| FINALIZED | Locked history |

Actionable warnings (HARD_BLOCK, REQUIRES_OVERRIDE) appear as count summaries and per-player icons. Informational warnings (WARNING, SCORING_PREFERENCE) are hidden behind a toggle. Surface actionable issues, not every observation.

The coach can always finalize by providing an override reason. No warning severity can absolutely prevent finalization. HARD_BLOCK and REQUIRES_OVERRIDE both require an override reason; they differ in presentation severity, not in whether they can be overridden.