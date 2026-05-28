# Matchboard Agent Instructions

Matchboard is a private coach-facing youth football operations cockpit for match-round squad planning, controlled player movement, coaching intent, matchday responsibility, plan integrity signals, finalized history, and post-match reflection across a planning period.

It is deployed as a hosted web app on Vercel with Neon PostgreSQL backend persistence. It is not a generic club-management platform, not a parent communication platform, and not a public player evaluation system.

`features/matchboard.feature` is the single behavioral source of truth for domain behavior, selection rules, and expected outcomes.

If code, UI, schema, tests, README, and `features/matchboard.feature` disagree, fix the mismatch.

When workflow or UX semantics change, update `features/matchboard.feature`, `AGENTS.md`, and `README.md` before implementing. Do not implement product-shape changes before aligning supporting docs.

## Required skills

When working on Matchboard, always apply these skills in order:

1. **`git-branch-commit-pr`** — for all coding-agent work: branch creation, commits, and PRs
2. **`ux-webapp-design-craft`** (global) — for all UX, visual design, workflow, navigation, interaction, accessibility, and information architecture work
3. **`app-product-engineering`** (global) — for any user-facing app work: UX, interaction, accessibility, workflow, forms, dashboards, navigation, responsive behavior, design systems

All Matchboard-specific domain rules (selection engine boundaries, explainability, decision audit, player ID privacy, child-safety language, readiness states, workflow stages) are documented in this AGENTS.md file directly, not in a separate skill file.

## Mandatory coding-agent workflow

Before coding, read:
- `docs/development/coding-agent-working-session.md`
- the `git-branch-commit-pr` skill

All coding-agent work must follow the working-session contract.

For product, workflow, UX, navigation, selection, fixtures, teams, players, matches, assistant, rules, explainability, and decision-audit changes, the domain rules in this AGENTS.md are mandatory.

Supporting documentation must be updated before implementation whenever behavior, UX, routes, schema, domain contracts, or workflow changes.

Every branch must remove stale/dead/unused artifacts related to the change.

Every branch must run lint, typecheck, tests, build, and schema validation where relevant.

## Workflow

Matchboard is set up by adding teams, players, and matches. The coach can then populate all draft squads. Populate all groups matches by round and generates draft selections per round. The coach reviews plan integrity signals by round, fixes issues per match, may manually adjust draft squads, and finalizes one round at a time. Season/planning-period history is used to keep load, support, drops, development exposure, and fairness balanced over time.

The primary coach workflow is:

1. **Setup** — Add teams, add players, add matches. Mark player availability.
2. **Define intent** — Set match purpose, team risk, desired football behavior, support need, development focus.
3. **Populate all** — Generate draft selections for all rounds in the active planning period. Each round is generated via round-level orchestration (not match-by-match). No round is finalized by populate all.
4. **Review** — Inspect draft selections, plan integrity signals, fairness impact, explanations, and coaching intent alignment. Resolve blockers. Manually adjust draft squads if needed.
5. **Adjust** — Manual changes are allowed. Manual changes must show impact. Manual changes must preserve auditability.
6. **Finalize** — Lock one round at a time, or lock individual matches within a round. Finalized rounds and matches become history and cannot be silently mutated.
7. **Reflect** — Record team-level reflection. Record player-level feedback only where useful. Use observable behavior.
8. **Learn** — Use history, readiness, feedback, and fairness to inform later planning. Do not mutate finalized historical plans.

The Assistant page must always show the next action based on this workflow state. The Assistant page derives work items from live database state using `getAssistantCommandCentre()`, not from persisted AssistantIssue rows.

The assistant must not skip steps or suggest finalization before draft review. Planning notes, scoring preferences, opponent observations, and seasonal context never appear as Assistant work items. The CoachingIntentSelector must not appear on the Assistant page — intent belongs on Fixtures and Round Board.

## Stack

- Next.js 16 App Router (Turbopack)
- TypeScript
- Tailwind
- Prisma
- PostgreSQL (Neon for production, Docker Compose for local dev)
- Auth.js (Google OAuth, email allowlist)

## Product boundary

Matchboard plans squads for already-created matches.

It does not:
- create fixtures
- schedule a season
- manage a club
- support public signup or multi-tenant auth
- store real player data in the repo
- serve as a parent communication platform
- serve as a public player evaluation system
- serve as a punishment or ranking engine

Note: Matchboard does have a match creation form for recording match details (opponent, date, home/away, type, format). This is match data entry, not fixture creation or season scheduling.

## Core operating model

Selections are generated per match round.

A match round is the operational planning unit.

The season or planning period is the fairness and load-balancing context.

A round may contain one or more matches.

One planned assignment per player per round. A player must not be planned for two matches in the same round/week. Moving a player between matches transfers the assignment. It must never duplicate the assignment. Additional actual appearances from post-match reports are recorded separately as unplanned participation and do not mutate finalized planned selections.

The round-level pipeline runs in strict phase order:
1. Per-match core selection
2. Round-level required support resolution
3. Cross-match conflict resolution
4. Development routing
5. Squad repair (repairing teams weakened by support movement)
6. Post-pipeline validation and plan integrity signal persistence

No phase may be skipped. Each phase must complete before the next begins.
No phase may create a second planned selection for the same player in the same round.

No phase may be skipped. Each phase must complete before the next begins.

Populate all generates drafts for all rounds in a planning period in one action. It does not finalize. Each round is generated via round-level orchestration to preserve cross-match conflict resolution.

Populate all must not generate each match independently. Populate all must group matches by round and run round generation per round.

## Coaching/domain model

Stable base groups protect belonging.

Movement between groups is normal, controlled, and temporary.

Movement is based on:
- team need
- effort
- attendance
- learning behavior
- game impact
- appropriate challenge
- fairness across the season/planning period

Movement is not a punishment or permanent label.

Do not design artificial equal-strength balancing. The app should create useful squad selections, not flatten all groups into generic equality.

### Coaching intent and execution model

Matchboard is not only a selection engine. Matchboard supports:

intent → selection → responsibility → execution → reflection → learning

This loop must be reflected in the UI workflow, not just the selection engine.

Selection logic must not be changed without preserving explainability and child-safe language.

Coaching intent can be attached to:
- planning periods
- match rounds
- matches
- teams
- selections

Intent categories (initial set):
- team_first — prioritize team function over individual development
- reset_after_error — prioritize reset and recovery after mistakes
- support_teammates — prioritize helping teammates over individual stats
- positional_discipline — prioritize staying in position and team shape
- play_through_team — prioritize connecting with teammates over solo actions
- defensive_recovery — prioritize defensive responsibility and recovery
- confidence_rebuild — prioritize a safer context with specific success criteria
- challenge_exposure — provide a harder match context because effort and readiness support it
- stabilize_weaker_team — prioritize stabilizing a team that needs support
- protect_match_function — prioritize making the match viable for all players

Rules:
- Intent informs explanations and plan integrity signals but does not silently override hard eligibility rules.
- Intent can be edited by the coach before finalization.
- Intent remains coach-facing unless explicitly exported through neutral parent-safe language.
- Finalized history preserves intent snapshots from finalization time.

### Matchday responsibilities

Matchday responsibilities are coach-facing execution concepts separate from selection roles.

Allowed responsibilities (initial set):
- stabilizer — helps the team stay calm, connected, and organized
- connector — looks for simple team actions and helps involve teammates
- recovery_leader — reacts quickly after ball loss and models reset behavior
- width_holder — protects team shape and avoids unnecessary central crowding
- challenge_player — receives a harder match context because effort and readiness support it
- confidence_rebuild_player — receives a safer or clearer context with specific success criteria

Rules:
- A selected player may receive a matchday responsibility.
- Responsibility must be coach-facing by default.
- Responsibility must be preserved in finalized history.
- Responsibility must never change player eligibility by itself.
- Responsibility must be explained using observable football language.
- Responsibility must be separate from player identity, level, or permanent label.
- Responsibility may change from match to match.

### Player readiness signals

Readiness is soft coaching context, not a hard ranking system.

Initial readiness signals:
- effort trend — rising / stable / falling
- attendance reliability — high / medium / low
- learning behavior — strong / ok / needs_attention
- team-first behavior — strong / ok / needs_attention
- reset-after-error reliability — strong / ok / needs_attention
- coach trust — high / medium / low

Rules:
- Readiness may influence scoring preferences and plan integrity signals.
- Readiness must not create automatic punishment.
- Readiness must not permanently label a player.
- Readiness must not be included in parent-facing exports.
- Readiness must be coach-editable and explainable.
- Readiness must be time-bound or reviewable.
- Readiness must be based on observable behavior where possible.
- Low readiness cannot automatically exclude an eligible player.
- Strong readiness cannot automatically override hard eligibility rules.

### Post-match reflection and feedback

Matchboard supports lightweight post-match feedback based on observable behavior.

Feedback categories (initial set):
- effort
- team help
- reset after mistake
- positional discipline
- teammate involvement

Rules:
- Feedback is coach-facing by default.
- Feedback describes behavior, not character.
- Feedback is optional and lightweight.
- Feedback should be recorded only where useful.
- Feedback must not shame players.
- Feedback must not become automatic punishment.
- Feedback can inform future plan integrity signals, readiness signals, and planning suggestions.
- Feedback must not mutate finalized planned selections.
- Actual participation belongs to post-match reality/history and must stay separate from planned selection.
- Feedback must never use disallowed language: lazy, selfish, bad attitude, weak player, not good enough, useless, problem player.
- Feedback must use observable behavior descriptions: helped teammate after ball loss, recovered position quickly, stayed available for pass, etc.

### Canonical data truth

Every important fact must have one documented canonical source. Never add a second writable truth for an existing fact.

1. Player goals derive from `Goal` events in reported/locked reports. `MatchReportPlayerStat.goals` is a compatibility field, not independent goal truth.
2. Player assists derive from `Assist` events in reported/locked reports. `MatchReportPlayerStat.assists` is a compatibility field, not independent assist truth.
3. Actual appearances count only `PRESENT` actual participation in completed reports. `UNKNOWN` does not count. `NO_SHOW` does not count. Draft/finalized planned selections do not count.
4. `UNKNOWN` attendance blocks report completion.
5. Planned players who did not play require structured `MatchReportAbsence`.
6. Never infer scorer from score.
7. Never infer historical attendance during reconciliation.
8. Reconciliation supports dry-run and preserves factual history.
9. Do not remove candidate duplicate fields without measured usage and safe migration plan.
10. Keep planned selection separate from actual matchday participation.
11. Preserve live-derived plan integrity. Do not make stale `Warning` or `AssistantIssue` rows authoritative again.

Detailed source-of-truth register: `docs/domain/source-of-truth-register.md`

When consuming statistics:
- Use `Goal` events for player goals, not `MatchReportPlayerStat.goals`.
- Use `PRESENT` actual participation for played count, not planned selection status.
- Use structured absence for planned non-participation, not attendance status alone.
- Report mismatches through integrity audit, never silently choose one source over another.

### Coach-facing vs parent-facing language

Internal planning reasons must not leak into parent/player exports.

Do not store player names inside assistant issues, explanations, recommendations, decision records, or cross-team impact payloads. Use player IDs. Resolve names for display only.

Coach-facing language may include:
- movement direction and source/target team
- selection role
- matchday responsibility
- support burden and fairness impact
- readiness signals
- execution feedback
- override reason
- plan integrity signals (blocked conditions, decisions required, planning notes)
- internal explanation
- coaching intent

Parent-facing language must use neutral terms:
- rotation
- suitable challenge
- team balance
- availability
- match experience
- development opportunity
- squad adjustment
- planning period
- match group

Parent-facing language must never use:
- low readiness, weak player, support burden, confidence rebuild, effort concern, coach trust, needs_attention, internal ranking, punishment, selection debt, culture debt, hidden judgement

Rules:
- Coach export includes internal roles, movement direction, explanations, override reasons, readiness notes, and feedback where relevant.
- Parent export hides internal planning tags and judgement.
- Player names and personal data must not be sent to external AI services. Use stable player IDs and sanitize payloads.
- Hosted architecture does not make coach-facing data public.

### Explanation model

Every non-obvious selection should be explainable through:
- selection role
- movement path or manual override
- coaching intent
- matchday responsibility if assigned
- relevant plan integrity signals (blocked conditions, decisions required, planning notes)
- fairness impact
- load impact
- support impact
- risk created or mitigated
- distinction between hard rule and scoring preference
- distinction between planned selection and actual participation

Explanation patterns:
- Why was a player sent as support? → rotation path + team need
- Why was a player not selected? → conflict, availability, or fairness rotation
- Why does a plan integrity signal exist? → category, affected entity, reason

If the UI cannot explain a selection result, the engine must provide the explanation.

Rules:
- Coach can ask why a player was selected.
- Coach can ask why a player was not selected.
- Coach can ask which rule blocked a move.
- Coach can ask what risk a manual change creates.
- Explanation must distinguish hard eligibility rules from scoring preferences.
- Explanation must distinguish planned selection from actual participation.
- Explanation must cite the rule, intent, and relevant impact where possible.
- Explanation must use stable player IDs in external/sanitized contexts.

### Manual draft change impact analysis

Manual changes are allowed, but the app must explain impact.

Manual changes should support real matchday reality:
- late absence, emergency support, sickness, injury, availability change, coach judgement, squad size repair, real-world backfill, actual participation differing from planned selection

Rules:
- Adding a player manually recalculates plan integrity signals, round status, match status, explanations, fairness impact, and movement ledger.
- Manual add shows same-round conflict, availability, squad size, path validity, support burden, fairness impact, and need for override reason.
- Emergency backfill close to matchday is recorded as actual participation, not retroactively pretending the generation engine planned it.
- Actual double-load caused by real-world backfill is tracked through effective participation/history and must not mutate finalized planned selections.
- Manual removal preserves audit history.
- Manual changes require coach-facing explanation if they violate normal rules or create notable fairness/load/support impact.

### Misuse guardrails

Matchboard must not become:
- a punishment engine
- a hidden player ranking ladder
- a moral scoring system
- a parent-visible judgement tool
- a tool for hard early sorting
- a fake equality generator
- a generic scheduling system
- a generic club-management system
- a public player evaluation system

Guardrail rules:
- Low readiness cannot automatically exclude a player.
- Feedback cannot be shown in parent export.
- Movement remains temporary and explainable.
- Stable belonging remains protected.
- Coach judgement remains explicit when overriding rules.
- Hosted deployment does not weaken privacy boundaries.
- Player development context does not become public labels.
- Stronger players can be used for support without permanently redefining their identity.
- Weaker but hungry players can receive challenge where behavior and context support it.
- Social participation is respected, but it must not silently define the football ceiling for the whole group.

### Opponent teams and encounter observations

Matchboard stores opponent teams as reusable private match-planning entities.

1. Every match must reference one persisted opponent team while preserving `Match.opponent` as a historical match-time display-name snapshot.
2. `Match.matchFit` is the existing sporting-fit observation and must be reused, not duplicated. No new sporting-fit model or enum may be introduced.
3. Match-environment observations are separate from sporting-fit feedback. They describe individual encounters, never fixed traits of an opponent team.
4. Matchboard must never introduce designed fields for opponent player names, opponent coach names, parent or spectator names, referee names, shirt numbers connected to incidents, contact information, physical descriptions, or identifying details about individuals.
5. Free-text opponent summaries must be short (max 500 characters), factual, coach-facing, and explicitly prohibit identifying details. The form must reject obvious email, phone, and URL patterns.
6. Serious Fair Play concerns are handled through club processes outside Matchboard. Matchboard records follow-up status only.
7. Opponent encounter context must not automatically alter selection-engine outcomes: no eligibility changes, no support priority changes, no development movement changes, no squad repair changes, no fairness scoring changes, no readiness signal changes, no warning changes, no blocker changes, no plan integrity signal changes, no finalisation behaviour changes.
8. Opponent observation data must not appear in parent-facing exports.
9. Opponent observation data must not appear in external AI payloads.
10. Use the `ux-webapp-design-craft` skill for all user-facing interaction and visual work related to this feature.
11. Preserve existing child-sensitive, non-labelling language rules.

Required user-facing terminology for opponent features:

| Concept | Use | Never use |
|---------|-----|-----------|
| Reusable opponent identity | Opponent team | Bad team, Problem team, Unsafe team |
| Match history against opponent | Previous encounters, Encounter history | Risk history, Opponent rating |
| Post-match observation | Post-match observation | Opponent evaluation |
| Sporting fit | Sporting match fit | Opponent strength, Opponent quality score |
| Environment assessment | Match environment | Threat assessment |
| Fair Play concern | Fair Play concern, Observed concern | Bad behaviour, Red flag |
| Serious observation | Serious concern observed | Unsafe team, Dangerous team |
| Follow-up | Follow-up | Action required |
| Summary | Brief factual summary | Incident report |
| No concern | No concern observed | Clean record |
| Not assessed | Not assessed | Unknown risk |

Required UI must never display: blacklist, reputation score, Fair Play score, opponent rating, opponent quality score, hostile parents, aggressive coach, dirty players, weak opponent, strong opponent, avoid this team.

### Consecutive support rotation

The selection engine penalizes players who have been sent as support for consecutive rounds. This is a scoring preference, not a hard rule.

- Players with consecutive finalized SUPPORT rounds receive a priority score penalty of -6 per consecutive round beyond the first (e.g., 2 consecutive = -6, 3 consecutive = -12)
- The penalty only applies to SUPPORT candidates, not DEVELOPMENT or other categories
- Players with 1 or 0 consecutive support rounds receive no penalty
- The penalty does not prevent selection when no better candidate exists — it is a ranking preference, not a hard block
- Both the per-match generation engine and the round-level support resolver use this penalty to rotate support assignments across available players from the source team

## Rule precedence

Team support is priority 1.

If a team needs required support, that support must be attempted before:
- optional development movement
- fairness optimization
- cosmetic balancing
- generic rotation

If required support cannot be fulfilled, generate a Blocked or Decision required condition. Do not silently weaken the team.

Fairness must not override required support. Fairness is a scoring preference, not a hard rule.

## RotationPath authority

RotationPath is the single source of truth for automatic non-core player movement. A player may only be selected outside their core team when an active directed RotationPath exists from the player's core team to the target team for the exact role being assigned, unless a manual override with reason is used.

Rules:
- Each RotationPath authorizes exactly one role: SUPPORT, DEVELOPMENT, or BACKFILL
- A SUPPORT path permits only SUPPORT movement — not DEVELOPMENT or BACKFILL
- A DEVELOPMENT path permits only DEVELOPMENT movement — not SUPPORT or BACKFILL
- A BACKFILL path permits only BACKFILL movement — not SUPPORT or DEVELOPMENT
- Paths are directional: from_team → to_team. The reverse direction requires a separate path
- No configured path means no non-core automatic selection
- Fairness scoring cannot make an invalid path valid
- nonRotatable blocks all automatic non-core movement regardless of path existence
- Manual override may bypass path checks but must record reason
- No fallback can bypass path validation
- Invalid path eligibility is a hard eligibility problem, not a ranking problem

### Legacy relationship tables

The `TeamSupportSource` and `TeamDevelopmentSource` tables must not drive selection eligibility or movement decisions. They exist for backward-compatible UI configuration display only and are scheduled for removal. The selection engine must use RotationPath exclusively.

### Support priority convention

Support priority is a **rank**, not a weight. Lower number = higher priority. Priority 1 is resolved before priority 2. The `supportPriority` field on the Team model uses ascending sort order (`ORDER BY supportPriority ASC`). The UI label must say "support priority rank: 1 is highest". Do not use ambiguous labels like "support priority" without the rank clarification.

## Squad repair rules (was "Backfill rules")

"Squad repair" is the user-facing term. The generation engine now produces `role = SUPPORT` for squad repair (was previously `role = BACKFILL`). `BACKFILL` remains in the Prisma enum for backward compatibility of historical data and manual overrides.

When a player fills a gap in a squad weakened by support/development movement, the generation engine assigns `role = SUPPORT` with a squad repair explanation code. The explanation field provides the repair context; the role identifies the movement type.

If a player is re-included in their own team after being temporarily dropped, the generation engine assigns `role = SUPPORT` with the `self_squad_repair` explanation code.

Squad repair priority order:

1. Own core team player moved as support, if matches are on different dates and the player can play both
2. Players from teams connected by an active DEVELOPMENT or SUPPORT rotation path to the receiving team, where `nonRotatable = false`
3. Any player from another team with an active SUPPORT or BACKFILL rotation path to the receiving team, where `nonRotatable = false`

Rules:
- Non-rotatable players must never be used as generic squad repair
- Squad repair must respect same-round conflict rules
- If no valid squad repair exists, generate a Planning note instead of silently weakening the team

### Legacy Backfill data

Historical data with `role = BACKFILL` must still be readable. The `SelectionRole.BACKFILL` enum value is retained. New generation never produces `role = BACKFILL`. Manual draft edits may still assign any role including BACKFILL if the coach explicitly overrides with a reason.

## One planned assignment per player per round

During draft planning, a player may belong to at most one planned match squad in a match round.

A player shown on the Round Board represents one planned match opportunity. Moving a player between matches transfers the planned assignment. It must never duplicate the planned assignment.

The user interface must not provide a deliberate workflow for adding the same player to multiple planned matches in a round.

The server must reject any draft-generation, manual-add, manual-move, role-change or finalisation mutation that would persist more than one active planned selection for the same player in the same match round.

Historical data created under older behaviour may be displayed as legacy history if it already exists, but new planning behaviour must never create planned double load.

### Actual double-load from post-match reports

Actual double-load (a player appearing in two post-match reports in the same round) may happen because reality forced it. It:
- Must affect future fairness/load
- Must NOT mutate finalized planned selections
- Must be recorded as actual history
- Is tracked via the effective participation layer, not via `controlledDoubleLoad`
- Is not a warning against the player

### Unplanned actual participation

A player not in the finalized planned squad may be recorded as an actual participant in post-match reporting. This:
- Requires an unplanned-appearance reason (emergency squad cover, late availability change, no-show replacement, injury replacement, other recorded reason)
- Does not rewrite the finalized planned squad
- Is stored as source UNPLANNED with structured reason
- Does not create a planning warning

An additional actual appearance in the same round is allowed as recorded reality and is counted in future participation/load context.

## Target / min / max squad size

- Target squad size is a planning target, not a hard cap. A team may be selected above target up to maximum squad size.
- Minimum accepted squad size is a hard floor. Below minimum requires manual override.
- Maximum squad size is a hard ceiling. Above maximum requires manual override.
- Below target but above minimum is a planning note, not a Blocked condition.

## Warnings and plan integrity signals

Current active plan integrity is computed from the current editable draft. Draft-derived signals are reconciled, never accumulated indefinitely. Recalculation yielding zero signals clears/resolves obsolete active projection. Assistant work is derived from current Blocked and Decision required only. Planning notes never create Assistant tasks, Fixtures totals or finalisation requirements.

The application reserves prominent unresolved issue signals for conditions that directly affect planned match opportunity, selection validity, or minimum match viability.

Active prominent signals are restricted to:
1. Squad below minimum accepted size (Blocked)
2. Selected unavailable player (Blocked)
3. Invalid duplicate planned assignment (Blocked)
4. Available eligible player without planned match opportunity (Decision required)

Opponent history is informational only and never becomes a selection warning.

Visible signal categories:
- **Blocked** — the planned round or match is invalid or not viable. Requires action before normal finalisation.
- **Decision required** — a meaningful player-opportunity exception must be consciously accepted and recorded. Requires override reason to finalise.
- **Planning note** — useful context; the current plan remains valid and finalisable. Not shown as prominent unresolved issue.

Selection ranking and engine rationale are shown as "Why this selection" explanations and must never be counted or displayed as unresolved issues.

Fixtures must not display generic issue totals. Fixtures displays structured Blocked and Decision required summaries only. Planning notes must not be counted.

Round Board uses Plan integrity, Planning notes and Why this selection. It must not show actionable warnings, informational warnings or generic warning totals. Player chips must not show generic warning count badges.

Planned same-round double load is prohibited. Additional actual participation is post-match reality only and does not become an active plan-integrity signal.

### Blocked conditions

- Squad below minimum accepted size (`SQUAD_BELOW_MINIMUM`)
- Selected unavailable player (`SELECTED_PLAYER_UNAVAILABLE`)
- Corrupted duplicate planned assignment (`DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE`)

### Decision required conditions

- Available eligible player without planned match opportunity (`AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY`)
- Repeated missed planned opportunity adds explanatory context to the same issue

### Planning notes (not prominent unresolved issues)

- Below target but above minimum (`BELOW_TARGET_BUT_PLAYABLE`)
- Preferred support not met when plan remains viable (`PREFERRED_SUPPORT_NOT_MET`)
- Squad repair below preferred target when team remains viable (`SQUAD_REPAIR_BELOW_PREFERRED_TARGET`)
- Permitted fallback position used (`FALLBACK_POSITION_USED`)
- Selection scoring preference (shown as explanation, not issue)

### Legacy WarningSeverity database enum

The existing `WarningSeverity` enum values (`HARD_BLOCK`, `REQUIRES_OVERRIDE`, `WARNING`, `SCORING_PREFERENCE`) remain in the schema for database compatibility. New active generation maps these to the new signal model:
- `HARD_BLOCK` → Blocked condition
- `REQUIRES_OVERRIDE` → Decision required condition
- `WARNING` → Planning note (no longer presented as unresolved issue)
- `SCORING_PREFERENCE` → Explanation only (never persisted as active issue)

The UI must not display legacy database enum names (`HARD_BLOCK`, `REQUIRES_OVERRIDE`, `WARNING`, `SCORING_PREFERENCE`). Instead it must use the visible signal model: Blocked, Decision required, Planning note.

Warnings are generated during round generation and must be persisted to the database.

The coach can always finalize Blocked rounds by providing an explicit override reason. No condition can absolutely prevent finalization, but Blocked conditions require conscious acceptance and recorded reason.

Planning notes must not require acknowledgement in the finalization dialog.

Finalisation recomputes live integrity from current state server-side. Stale rows cannot affect finalisation after their condition resolves.

## Draft clearing

Generated draft selections can be cleared at three levels:
- **Clear all** — remove all non-finalized draft selections, draft plan integrity signals, draft explanations, provisional planning context, and draft generation metadata across all rounds
- **Clear round** — remove all non-finalized draft data for one selected round
- **Clear match** — remove all non-finalized draft data for one selected match

Hard rules:
- Never delete finalized selections
- Never delete finalized history
- Never delete teams, players, matches, rounds, rules, or availability
- Clearing draft data must be explicit and require confirmation
- After clearing, affected rounds/matches must return to not-populated state
- After clearing, affected round status and plan integrity signals must be recalculated
- After clearing all, no stale draft context may affect later generation

## Manual draft squad editing

Draft match squads can be manually edited before finalization.

**Manual override principle: selection rules are for the automatic engine only.** A coach can manually override any domain rule (same-round conflict, rotation path, availability, non-rotatable, squad size) by providing an override reason. The only absolute hard blocks for manual edits are data integrity: finalized round/match, non-existent player/match/selection.

Manual editing applies to draft/non-finalized selections only. Finalized selections cannot be edited by normal draft actions.

Manual editing must:
- validate that the match exists and the round is not finalized
- validate that the player exists and is active in the registry
- check domain rules and require an override reason when bypassing any of them
- recalculate match status, round status, plan integrity signals, explanations, and fairness impact
- store the override reason with the selection
- show the override badge on the player selection

Domain rules that require override reason for manual edits (not hard blocks):
- rotation path eligibility for non-core movement
- same-round conflict (player selected for another match)
- duplicate selection in the same match
- player availability
- squad size limits
- non-rotatable player movement outside core team

The only hard blocks for manual edits:
- round is FINALIZED
- match/selection/player does not exist
- player has been removed from the active registry

Manual override requires reason. Manual override must be persisted with the selection. Manual override must appear in finalization summary.

### Manual override reason categories

Override reasons must use structured categories, not generic free text. "Manual override" alone is not sufficient for analysis.

Structured categories:
- squad_too_small
- support_missing
- development_opportunity
- no_planned_match_opportunity
- double_load_needed (legacy — retained for backward compatibility only, must not be used for new planned assignments)
- availability_changed
- coach_judgement
- match_already_played
- data_correction
- other

Override reasons are stored as two fields:
- `overrideReasonCategory` — the structured category (enum)
- `overrideReasonDetail` — free-text detail explaining the specific context

Free-text detail is required for:
- same-round conflict in planned assignment
- unavailable player selection
- invalid path usage
- finalized history edit

## Movement ledger

Every non-core movement must create a MovementLedger entry. The movement ledger is the authoritative record of player movement, not the Selection table alone.

Movement ledger entries are created during:
- round draft generation (each non-core selection where `player.coreTeamId !== match.teamId`)
- legacy controlled double-load assignments (historical data where `sourceTeam == targetTeam`)

Movement ledger entries are NOT created for:
- CORE selections where `player.coreTeamId === match.teamId` and no movement occurred

Rules:
- `movements: []` in export is invalid when non-core selections exist
- Support always creates a movement ledger entry
- Development always creates a movement ledger entry
- Squad repair /_BACKFILL from another team creates a movement ledger entry
- Legacy controlled double-load data retains its movement ledger entries
- Manual override does not remove the need for movement ledger entries
- Finalization flips `isDraft` from `true` to `false`; it does not create new entries
- Un-finalization flips `isDraft` back from `false` to `true`

Existing data that has non-core selections but empty MovementLedger must be backfilled via a normalization/migration function.

## Draft regeneration

Generated draft selections can be regenerated at three levels:
- **Regenerate match** — rerun automatic selection for one match, preserving any manual edits
- **Regenerate round** — rerun round-level orchestration for one round, preserving any manual edits
- **Regenerate all drafts** — regenerate all DRAFT rounds in the planning period, preserving manual edits in each

Regeneration rules:
- Regeneration preserves manual edits: selections marked as manually added or manually removed are kept, and only automatic selections are recalculated
- If a match/round has only manual edits, regeneration is effectively a no-op (the manual selections are preserved as-is)
- To fully regenerate a match/round that has manual edits, clear the draft first, then regenerate
- Regeneration never touches FINALIZED selections
- Regeneration rebuilds plan integrity signals after recalculation
- Regeneration buttons must be clearly visible: on match columns in the round board (RefreshCw icon), via the round board action bar ("Regenerate"), and on rounds list and today page ("Regenerate all drafts")

## Per-match and round finalization

Finalization can happen at two levels:

1. **Per-match**: The coach can finalize individual matches within a round. This locks only the selections for that specific match. Other matches in the round remain in DRAFT state.

2. **Round-level**: The coach can finalize an entire round at once. This locks all selections in all matches in the round.

Per-match finalization rules:
- Per-match finalization locks all DRAFT selections for the target match as FINALIZED
- Per-match finalization checks Blocked and Decision required conditions scoped to the target match only (not the entire round); both require override reason, neither absolutely prevents finalization
- When all matches in a round have been finalized (no remaining DRAFT selections), the round's status must automatically transition to FINALIZED
- A match in a FINALIZED round cannot be finalized again
- Per-match finalization uses the same rule config version stamping as round-level finalization

Round-level finalization finalizes all remaining DRAFT selections in the round atomically.

### Un-finalization

Finalized matches and rounds can be un-finalized to revert selections back to DRAFT for recalculation.

Un-finalization can happen at two levels:

1. **Per-match**: The coach can un-finalize individual matches. Selections revert from FINALIZED to DRAFT, movement ledger entries revert to draft, and ruleConfigVersion/overrideReason are cleared.

2. **Round-level**: The coach can un-finalize an entire round. All selections in the round revert to DRAFT.

Un-finalization rules:
- Reverts Selection.status from FINALIZED back to DRAFT
- Clears ruleConfigVersion and overrideReason on affected selections
- Reverts MovementLedger.isDraft from false back to true
- Re-derives round status from plan integrity signals (DRAFT/BLOCKED/READY)
- When un-finalizing a single match in a FINALIZED round, if other finalized selections remain, the round stays FINALIZED; only when all selections are back to DRAFT does the round status revert
- Only FINALIZED rounds/matches can be un-finalized
- Un-finalize requires confirmation (not silent)
- Finalized data used for fairness calculations is affected: un-finalized selections no longer count as history

The match detail page shows per-match finalization controls and also provides a link to finalizing the entire round from the round workbench.

The round board uses a column-based layout: one "Available players" column on the left showing all unassigned players, and one column per match showing assigned players grouped by role. Players are moved between columns via drag-and-drop (desktop and touch).

When a player is dropped onto a match column, the role is determined automatically:
- If the player's core team matches the match team → CORE
- If a rotation path exists from the player's core team to the match team → SUPPORT (preferred) or DEVELOPMENT based on the path role
- If no rotation path exists → CORE (requires override reason)

BACKFILL is not a user-facing role choice. It is used internally by the selection engine for squad repair. Existing BACKFILL selections are displayed under "Squad repair" in the round board, but coaches cannot select BACKFILL as a role — the system assigns it automatically.

Plan integrity signals are shown with reduced verbosity: Blocked conditions and Decision required conditions appear as a count summary at the top of the round board and as per-player signal icons on player chips. Planning notes are hidden behind a toggle. Explanation-only scoring preferences never appear as signal icons. The main goal is to surface actionable issues, not to list every observation.

## Selection architecture

Keep selection logic out of React components.

Selection logic belongs in `src/lib/selection/*`.

Rule loading and validation belong in `src/lib/rules/*`.

Do not duplicate selection-engine logic in UI components. UI displays engine output and records coach decisions.

Keep these concerns separate:
- round orchestration (`generate-round.ts`)
- per-match generation (`generate-selection.ts`)
- rotation path policy (`rotation-path-policy.ts`)
- invariant validation (`validate-generated-round-invariants.ts`)
- round eligibility
- support selection
- squad repair selection
- development selection
- core selection
- season fairness
- conflict validation
- plan integrity signal generation and persistence
- explanation generation
- manual edit validation
- draft clearing
- draft regeneration
- finalization/snapshotting

Do not grow a monolithic `generate-selection.ts`.

The orchestrator should be thin.

Rules must be testable without React.

## Populate all

Populate all is a convenience workflow that generates drafts for all non-finalized rounds in the active planning period.

- It calls `generateMatchRound` for each round in chronological order
- It groups matches by round and generates per round (not match-by-match)
- It uses round-level orchestration (not match-by-match)
- It does not finalize any round
- It skips already-finalized rounds
- It persists plan integrity signals per round after generation
- Draft selections from earlier rounds may be used as provisional planning context for later rounds in the same run
- On partial failure, successful round generations are kept and failures are reported

## UI architecture

### Canonical routes

Primary navigation (4 items, in this order):

1. **Assistant** (`/assistant`) — next action, setup progress, blockers, urgent reviews and upcoming work.
2. **Fixtures** (`/fixtures`) — the one-stop shop for the period → round → match hierarchy with actions. Primary actions: populate all, generate round, finalize. Each level shows readiness state, plan integrity signal counts, selected player counts. Actions cascade: populate all generates all non-finalized rounds; generate round generates one round; finalize locks selections.
3. **Teams** (`/teams`) — team registry and access to team detail.
4. **Players** (`/players`) — season participation, current planning attention, and base-group administration.

The following must not be primary sidebar items:
- `/rounds`
- `/matches`
- `/season`
- `/history`
- `/rules`

These remain accessible through contextually appropriate links, buttons, tabs or secondary navigation.

Other canonical routes:
| Route | Purpose |
|-------|---------|
| `/rounds` | Rounds — generate, review, finalize per match round |
| `/rounds/[matchRoundId]` | Round Board |
| `/season` | Season — player-by-round matrix, movement paths, fairness overview |
| `/history` | Historical audit of finalized selections and movement |
| `/rules` | Selection rules, support priority, rotation paths |

Setup registry create routes (no top-level nav):
- `/teams/new` — create team form
- `/players/new` — create player form
- `/matches/new` — create match form

Detail routes (no top-level nav):
- `/players/[playerId]` — player profile
- `/teams/[teamId]` — team detail workspace
- `/teams/[teamId]/configuration` — team configuration and rules
- `/matches/[matchId]` — match detail

Canonical redirects:
- `/` → `/assistant`
- `/today` → `/assistant`
- `/matches` → `/fixtures`

No navigation component, page header, CTA or breadcrumb may present `/matches` as a competing top-level destination. Match detail routes such as `/matches/[matchId]` remain valid.

Active navigation state:
- `/assistant` visibly activates Assistant.
- `/fixtures` and fixture child/detail contexts visibly activate Fixtures.
- `/teams` and `/teams/[teamId]` contexts visibly activate Teams.
- `/players` and `/players/[playerId]` contexts visibly activate Players.
- Redirected routes do not produce an unselected or misleading sidebar state.

Operational workflow hierarchy:
1. Assistant identifies the next required action.
2. Fixtures provides the season/planning-period and round hierarchy.
3. Round Board is the primary squad decision surface.
4. Match detail handles match-specific preparation, finalisation and post-match reporting.
5. Team and Player pages provide supporting context and configuration.
6. Season, History and Rules are secondary analysis/configuration destinations.

### Setup registries are table-first

Teams, Players, and Matches are setup registries. They serve data-entry efficiency, not football operations workflow. Each registry page is a dense table with prominent Create actions and actionable empty states. Create buttons must never be dead links. Empty states must link directly to creation.

- Teams (`/teams`): dense table of teams with core player count, squad limits, support priority. Links to `/teams/new` for creation. Links to `/teams/[teamId]` for detail. Empty state: "No teams yet. Create a team." with direct link to `/teams/new`.
- Players (`/players`): three-mode surface — Season overview (actual participation and recorded match statistics for a selected planning period), Current round attention (canonical live plan-integrity state for a selected round), Manage base groups (stable core-team assignment and player registry administration). Links to `/players/new` for creation. Links to `/players/[playerId]` for full profile. When no teams exist: "Create a team first." with direct link to `/teams/new`. When teams exist but no players: "No players yet. Add a player." with direct link to `/players/new`.
- Fixtures provides match creation and match registry. The `/matches/new` route creates matches assigned to match rounds based on date. Fixtures must not expose a separate fixture-list mental model through a competing `/matches` navigation destination.

Create routes must work reliably. `/teams/new` must save all team fields (not just name and a few fields). `/players/new` must not silently disappear when teams exist. `/matches/new` must assign matches to match rounds based on date.

Round selection (`/rounds`) remains workflow-first. It uses cards, boards, panels, and role buckets — not tables as the primary interaction model.

### Players page modes

`/players` has three internal modes using accessible tabs or segmented navigation:

1. **Season overview** (default) — actual participation, recorded match statistics, and movement distribution for a selected planning period. Scoped to a visible `Planning period: {label}`. Statistics use reported or locked post-match data only. Draft selections and finalised unreported assignments do not count as played appearances.

2. **Current round attention** — canonical live plan-integrity state for a selected round. Scoped to a visible `Round: {label}`. Uses `computeRoundPlanIntegrity` output only. Does not derive attention from season statistics, goals, assists, or historical movement counts.

3. **Manage base groups** — stable core-team assignment and player registry administration. This mode is for team belonging, not weekly match selection, seasonal fairness review, or reported participation analysis. Display: "Base groups define stable team belonging. Match selections and movement are planned in rounds."

Season overview required columns (desktop): Player, Core team, Played, Goals, Assists, Core, Support, Development, Matchday additions, Planned absent, Review.

Current round attention required columns (desktop): Player, Core team, Availability, Planned opportunity, Role, State, Action.

Season overview default sort: Played ascending, then Core team ascending, then Player ascending.

Current round attention default sort: Blocked first, then Decision required, then Covered, then Unconfirmed, then Not available, then Player name.

Players overview rules:

- Reported or locked actual participation is the source of truth for Played, Goals, and Assists.
- Draft selections do not count as played appearances.
- Finalised unreported assignments are upcoming, not played.
- Core, Support, and Development counts represent actual played participation associated with planned roles.
- Matchday additions are factual load context, not warnings or fairness faults.
- Planned absences are context preventing false interpretation of lower participation totals.
- Actual additional appearances remain factual load context and must not create current attention states.
- Goals and assists never drive fairness, plan integrity, or selection generation.
- The overview must not calculate or show an overall fairness score, player ranking, or automatic judgement from seasonal statistics.
- Seasonal review uses transparent facts (sorting and explicit filters), not hidden automatic player ratings.
- Any filter must identify the factual criterion being filtered.
- Current round attention must reuse canonical live plan-integrity state only. It must not reconstruct plan-integrity rules inside Players UI components.
- Base-group management remains separate from weekly planning and seasonal review.
- Use the `ux-webapp-design-craft` skill for all UX, visual design, and interaction decisions in this workflow.
- Preserve privacy, parent-export, and external-payload boundaries. Coach-only review context must not be included in parent-facing exports or external AI payloads.

Contradictory SeasonFlag logic:

- `low_development_exposure` triggered by `developmentCount > coreCount` with zero core appearances does not indicate low development exposure. This flag logic must not be surfaced as an automatic badge. A player having more development than core appearances is factual context, not a negative label.
- `high_support_burden` triggered by `supportCount > coreCount` with zero core appearances does not necessarily indicate problematic support burden. This flag logic must not be surfaced as an automatic negative badge.
- For this branch, prefer factual columns, sorting, and explicit filters over automatic seasonal judgement badges.

### Teams page and team detail

The `/teams` page is a table-first registry. It links each team to its detail page.
It must not become a catch-all dashboard or show squad rosters inline.

`/teams/[teamId]` is the primary team workspace. It answers:
- Who belongs to this team
- Who is available
- Who is selected this round
- Who is moving out as support
- Who is moving in as support/squad repair/development
- Whether the team is short
- What plan integrity signals exist for this team
- What the team's movement and fairness situation looks like

Team detail has these sections:
- Team header (name, squad limits, support priority)
- Team summary strip (current round status, core count, sent/received counts, plan integrity signal count)
- Squad tab (core roster, planning status groups)
- Current Round tab (who is selected, sent, received, dropped — with selection reason)
- Movement tab (movement history across rounds)
- History tab (finalized rounds for this team)
- Rules/Links tab (rotation paths, config, link to Rules page)

`/teams/[teamId]/configuration` is the team workspace for squad settings and rules:
- Squad settings form: target, min, max squad size and support priority rank (editable)
- Rule list: shows how rules affect this team; global rules are read-only; team-scoped rules have an Edit button that scrolls to the relevant setting
- Configuration edits must persist via server actions, not only client state

### Navigation model

- **Sidebar**: 4 items — Assistant, Fixtures, Teams, Players (in this order)
- **Top context bar**: provides appropriate title/context for the current route. It must not describe `/assistant` as "Dashboard". It must not present `/matches` as an independent top-level workflow. It provides context appropriate to the current operational task. When a primary action exists in context, it is clearly prioritised.
- **Mobile nav**: preserves the same four primary destinations, maintains active-state correctness, and ensures blockers and primary actions are not hidden behind inaccessible interactions.

Status vocabulary: The app uses exactly these visible status labels: Not generated, Draft, Blocked, Ready, Finalized. No alternative visible status terms for the same state may be introduced.

Warning and signal hierarchy: Blocked conditions must be visually dominant and placed beside the affected round or match. Decision required conditions must be visible without opening hidden technical detail. Planning notes may be progressively disclosed. One primary action must be visually dominant per major workflow context. Draft state and finalised history must never appear visually interchangeable.

User-facing terminology: Use Assistant (not Dashboard), Fixtures (not Match list), Round Board (not Command center or Decision inbox), Needs Action (not Decision inbox or Decision debt), Squad repair (not Backfill in current user-facing generated movement), Sent as support (not Demoted), Development movement (not Promoted), Not selected this round (not Benched), Short or Below target (not Weak team). Internal enum BACKFILL remains for backward compatibility but must not appear as current user-facing terminology for generated squad repair.

### Auth layout rules

- Auth routes (`/auth/signin`, `/auth/error`) must use a public auth layout, never the protected app layout
- Sign-in and access-denied pages must not show sidebar, top bar, coach data, team data, player data, match data, or round data
- Protected app shell (sidebar, top bar, user nav) only renders after authenticated allowlisted coach access
- Auth pages must use the Matchboard dark theme but without protected navigation
- Root layout must contain only HTML/body/font wrappers — no protected shell components
- Protected shell (sidebar, top bar, user nav) lives in `(app)/layout.tsx`, not in root layout

### Season overview

The `/season` route is the fairness control surface. It is not a decorative analytics page. It exists to help the coach trust or challenge the season pattern.

The season overview must provide:

1. **Player × round matrix** (primary view): rows = players, columns = rounds, cells = role + team for that round
2. **Movement path summary** (secondary view): team-to-team movement totals table
3. **Player drill-down**: movement timeline per player
4. **Path drill-down**: players moved, rounds, dates per team-to-team path
5. **Season fairness warnings**: generated from the overview data

Season overview rules:

- The matrix is primary. Graphs are secondary and must be backed by drill-down data.
- Draft and finalized data must never be mixed without visible labeling.
- Draft selections must never look like finalized history.
- Unavailable rounds must not count as fairness debt.
- Double-load must count as extra load.
- Support and development must be counted separately.
- Squad repair/backfill must be counted separately or clearly explained.
- Every metric must be drillable (clickable to see detail).

Toggle:

- **Finalized only**: excludes all draft selections. Only shows finalized history.
- **Include drafts**: includes draft selections visibly marked as draft.

Filters:

- all players, by core team, high load, low load, high support burden, low development exposure, dropped recently, unavailable-heavy

Season page layout:

- Header: "Season" with subtitle "Track load, movement, and fairness across the planning period."
- Controls: planning period selector, finalized/draft toggle, filters
- Top summary strip: total rounds, finalized rounds, draft rounds, players with plan integrity signals, highest support burden, legacy additional assignment count
- Main: player × round matrix
- Side or lower panel: selected player/path drill-down
- Secondary: movement path summary table

Matrix row summary columns: rounds played, total selections, core matches, support matches, development matches, squad repair/backfill matches, additional actual appearances, drops/rests, unavailable rounds, last movement, plan integrity signal count.

Movement path table columns: source team, target team, role, count, unique players, last used, plan integrity signals.

Season-level fairness warnings:

- player has high support burden compared with team average
- player has low development exposure compared with eligible peers
- player has repeated additional actual appearances
- player dropped twice before playing again
- player moved too many consecutive rounds
- team supplies disproportionate support
- expected support path unused
- unavailable rounds excluded from fairness debt

Each plan integrity signal must include: signal category (Blocked/Decision required/Planning note), affected player/team/path, reason, drill-down link, whether based on finalized-only or draft-included data.

Data/service layer must be outside React components:

- `getSeasonPlayerRoundMatrix()`
- `getPlayerLoadSummary()`
- `getMovementPathSummary()`
- `getPlayerMovementTimeline()`
- `getSeasonFairnessWarnings()` (returns plan integrity signals categorized as Blocked/Decision required/Planning note)

These services must distinguish draft and finalized data, count additional actual appearances correctly, count support/development separately, exclude unavailable rounds from fairness debt, and avoid hardcoded demo assumptions.

### Season export

The season overview page provides an export function that downloads finalized match data and season statistics.

Available formats: CSV, JSON, TXT, Markdown.
Available visibility modes: coach (includes roles, plan integrity signals, movement paths, explanations, override reasons), parent (hides internal planning tags).

Coach export includes:
- Per-selection rows: round, date, team, home/away, opponent, player name, source team, role, position, override reason, explanation
- Movement rows: round, date, player name, from team, to team, role
- Player statistics: player, team, rounds played, core matches, support matches, development matches, squad repair, additional actual appearances

Parent export includes:
- Per-selection rows: round, date, team, home/away, opponent, player name, position
- Movement direction (without team names or role labels)
- Player statistics: player, team, rounds played

API endpoint: `/api/season/export?planningPeriodId=<id>&format=<csv|json|txt|md>&visibility=<coach|parent>`

### Prohibited copy

Never use: command center, decision inbox, decision debt, structured review room, workspace, optimization output, entity, resource, assistant advice (as a page concept replacing the workflow).

Use instead: Round Board, Needs Action, Round Checks, Squad planning, Generated squads, Player, Team, Next action.

### Domain language for movement and roles

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

Note: BACKFILL remains the internal code role and rotation path role. Use "squad repair" in all user-facing UI and documentation.

### Round status model (5 states)

| Status | Meaning |
|--------|---------|
| NOT_GENERATED | No selections yet |
| DRAFT | Selections generated, not finalized |
| BLOCKED | Draft with Blocked conditions |
| READY | Draft with no blockers |
| FINALIZED | Locked history |

## Testing requirements

Any change to selection behavior must include tests.

Run tests with `npm test`.

Required test coverage should include:
- same-round player conflict prevention
- same-round conflict requires override reason for manual edits
- duplicate selection in match requires override reason for manual edits
- support before development
- support not overridden by fairness scoring
- backfill priority order (1 → 2 → 3)
- non-rotatable exclusion from generic backfill
- plan integrity signal generation when support/backfill fails
- plan integrity signal persistence after generation
- season/planning-period fairness
- unavailable rounds excluded from fairness debt
- explanation output for important decisions
- populate all generates all rounds without finalizing
- populate all skips finalized rounds
- populate all reports partial failures without rollback
- clear all removes only non-finalized draft data
- clear round removes only selected round draft data
- clear match removes only selected match draft data
- clear actions preserve finalized history and setup data
- manual add player with and without valid path
- manual same-round conflict override with reason
- manual duplicate selection override with reason
- manual remove player recalculates plan integrity signals
- manual role change validates role-specific path
- manual override requires reason
- finalized match cannot be edited by draft action
- regenerate match preserves manual edits
- regenerate round preserves manual edits
- regenerate all drafts skips finalized rounds
- regeneration never touches finalized selections
- invariant validation catches invalid non-core movement
- rotation path policy enforces exact role matching
- un-finalize round reverts selections and movement ledger to DRAFT
- un-finalize single match reverts selections and re-derives round status
- un-finalize preserves other finalized matches in the round
- consecutive support rotation penalizes repeated support assignments
- consecutive support penalty increases with more consecutive rounds
- consecutive support does not prevent selection when no other candidate exists

## Data safety

Never commit real player names, private roster data, or database credentials.

Never commit AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, or any auth credentials.

Never prefix secrets with NEXT_PUBLIC_ (they would be exposed to the browser).

Demo data must be fake.

## Auth rules

Matchboard is a private coaching app. Auth is mandatory, not optional.

- Users must authenticate (Google OAuth) before accessing any app data
- Access is controlled by an email allowlist (`ALLOWED_COACH_EMAILS`)
- No public signup exists or should be added unless explicitly requested
- Every server action that reads or writes protected data must call `requireCoachAccess()`
- Every API route that reads or writes protected data must call `requireCoachAccess()`
- Every route showing protected app data must require authenticated coach access
- UI-only protection is insufficient — hiding buttons is not authorization
- Direct server action calls must fail without authorization
- Direct API calls must fail without authorization
- `requireCoachAccess()` is the shared authorization helper that all protected actions must use
- Create, edit, delete, finalize, export, clear, manual-edit, and populate actions must all be protected
- Unauthenticated users redirect to sign-in
- Authenticated but non-allowlisted users see access denied
- Tests or verification must cover unauthorized access scenarios

## Deployment and security

Before deployment-related work, follow the validation requirements in `docs/development/coding-agent-working-session.md`. At minimum:

- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- Verify no secrets are tracked: `git ls-files | xargs grep -l "postgresql://\|neon.tech\|client_secret\|PRIVATE KEY" 2>/dev/null` should return nothing relevant
- Inspect any active selection-engine branch (`fix/selection-engine-remaining-tasks`) for pending improvements

### Hosting

Matchboard is deployed to **Vercel** with **Neon Postgres**. SQLite is not used for production persistence.

- Runtime queries use `DATABASE_URL` (Neon pooled connection)
- Prisma CLI/migrations use `DIRECT_URL` (Neon direct connection)
- `prisma.config.ts` configures the datasource URL from `DIRECT_URL` for CLI operations
- `src/lib/db.ts` auto-detects Neon from the connection string and uses the appropriate adapter

### Production migrations

- **Never run `prisma migrate dev` against production.**
- Production migrations must be run deliberately from a local machine: `npx prisma migrate deploy` with `DIRECT_URL` targeting Neon.
- Migrations must not run as part of the Vercel build process.
- The `postinstall` script runs `prisma generate` only — not migrations.

### Hard rules

- Real secrets belong only in local `.env` and Vercel environment variables
- `.env` must never be committed
- `.env.example` may contain placeholders only
- `.vercel/` must never be committed
- Vercel environment variables must never be committed to the repository
- `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and similar secrets must never be exposed as `NEXT_PUBLIC_*`
- No real player data, exports, local database files, or credentials may be committed
- Deployment must not happen until lint/build/security checks pass
- All data-mutating server actions must call `requireCoachAccess()` or equivalent
- All data-reading server actions and API routes exposing app data must call `requireCoachAccess()` or equivalent
- The `/api/health` endpoint must not expose business data (player counts, etc.)
- Rate limiting is in-memory only — document this limitation for production
- All final changes must use the `git-branch-commit-pr` skill (see mandatory coding-agent workflow)

## Implementation style

Prefer:
- explicit domain code
- small files
- clear names
- boring architecture
- tests over confidence
- explanation objects from selection logic

Avoid:
- generic scheduling engines
- hidden UI-only rule behavior
- clever abstractions
- silent fallbacks
- adding features before rule consistency is proven

## Key engine files

| File | Purpose |
|------|---------|
| `src/lib/selection/generate-round.ts` | Round-level orchestrator |
| `src/lib/selection/generate-selection.ts` | Per-match selection |
| `src/lib/selection/resolve-round-support.ts` | Cross-match support and squad repair resolution |
| `src/lib/selection/resolve-round-conflicts.ts` | Same-round player conflicts |
| `src/lib/selection/route-core-match-drops.ts` | Core match drop routing |
| `src/lib/selection/rotation-path-policy.ts` | Movement eligibility validation |
| `src/lib/selection/validate-generated-round-invariants.ts` | Post-generation invariant checks |
| `src/lib/selection/save-generated-draft.ts` | Persist draft selections and movement ledger entries |
| `src/lib/selection/evaluate-controlled-double-load.ts` | Legacy: controlled double-load evaluation — quarantined, not in active pipeline |
| `src/lib/selection/migrate-double-load-roles.ts` | Migration: merge standalone DOUBLE_LOAD rows into base role rows with controlledDoubleLoad=true |
| `src/lib/selection/migrate-squad-repair-roles.ts` | Migration: role=CORE with "squad repair" explanation → role=BACKFILL |
| `src/lib/selection/backfill-movement-ledger.ts` | Normalization: create MovementLedger entries for existing non-core selections without ledger entries |
| `src/lib/selection/finalize-match-round.ts` | Finalize a round |
| `src/lib/selection/finalize-single-match.ts` | Finalize a single match within a round |
| `src/lib/selection/unfinalize-match-round.ts` | Un-finalize a round (revert to DRAFT) |
| `src/lib/selection/unfinalize-single-match.ts` | Un-finalize a single match (revert to DRAFT) |
| `src/lib/selection/get-planning-period-fairness.ts` | Fairness calculation (FINALIZED only) |
| `src/lib/selection/get-consecutive-support-count.ts` | Consecutive support round tracking |
| `src/lib/selection/refresh-draft-selection.ts` | Regenerate draft for a match or round |
| `src/lib/selection/populate-all-drafts.ts` | Populate all convenience workflow |
| `src/lib/selection/persist-warnings.ts` | Persist plan integrity signals after generation |
| `src/lib/data-integrity/audit-data-integrity.ts` | Integrity audit: mandatory checks + candidate stubs |
| `src/lib/data-integrity/reconcile-canonical-derived-data.ts` | Reconcile derived projections from canonical sources |
| `src/lib/data-integrity/types.ts` | Audit and reconciliation types |
| `src/app/api/admin/audit/route.ts` | GET `/api/admin/audit` — run integrity audit |
| `src/app/api/admin/reconcile/route.ts` | POST `/api/admin/reconcile` — reconcile derived projections |

## Stale references removed

- `docs/domain.md` — deleted, do not reference
- `docs/spec-ux-overhaul.md` — superseded by `docs/specs/ux-overhaul.md`

## Assistant Manager Workflow Rules

When implementing workflow, selection, squad review, player profile, team review, or match review changes, follow the mandatory coding-agent workflow in `docs/development/coding-agent-working-session.md`.

Key rules:
- Update supporting docs before implementation.
- Do not duplicate selection-engine logic in UI components.
- Use player IDs in stored payloads and external/public payloads.
- Do not store player names inside assistant work items, explanations, recommendations, decision records, or cross-team impact payloads.
- Do not introduce ability scores, best-XI language, permanent weak/strong labels, or public player ranking.
- Overrides must require a reason.
- Selection-affecting actions must create an auditable DecisionRecord.
- Use the `git-branch-commit-pr` workflow.
- Do not commit internal work logs, scratch notes, or handover documents.