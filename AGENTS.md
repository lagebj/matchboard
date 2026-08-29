<!-- BEGIN swamp managed section - DO NOT EDIT -->
# Project

This repository is managed with [swamp](https://github.com/swamp-club/swamp).

## Rules

1. **Search before you build.** When automating AWS, APIs, or any external service: (a) search community extensions with `swamp extension search <query>` — prefer `@swamp/*` official extensions first, (b) search local/installed types with `swamp model type search <query>`, (c) if a community extension exists, install it with `swamp extension pull <package>` instead of building from scratch, (d) extend an existing type if it covers the domain but lacks the method you need, (e) only create a custom extension model in `extensions/models/` as a last resort. Read `.agents/skills/swamp/SKILL.md` for guidance. The `command/shell` model is ONLY for ad-hoc one-off shell commands, NEVER for wrapping CLI tools or building integrations.
2. **Extend, don't be clever.** When a model covers the domain but lacks the method you need, extend it with `export const extension` — don't bypass it with shell scripts, CLI tools, or multi-step hacks. One method, one purpose. Use `swamp model type describe <type> --json` to check available methods.
3. **Use the data model.** Once data exists in a model (via `lookup`, `start`, `sync`, etc.), reference it with CEL expressions. Don't re-fetch data that's already available.
4. **CEL expressions everywhere.** Wire models together with CEL expressions. Always prefer `data.latest("<name>", "<dataName>").attributes.<field>` over the deprecated `model.<name>.resource.<spec>.<instance>.attributes.<field>` pattern.
5. **Verify before destructive operations.** Always `swamp model get <name> --json` and verify resource IDs before running delete/stop/destroy methods.
6. **Prefer fan-out methods over loops.** When operating on multiple targets, use a single method that handles all targets internally (factory pattern) rather than looping N separate `swamp model method run` calls against the same model. Multiple parallel calls against the same model contend on the per-model lock, causing timeouts. A single fan-out method acquires the lock once and produces all outputs in one execution. Check `swamp model type describe` for methods that accept filters or produce multiple outputs.
7. **Extension npm deps are bundled, not lockfile-tracked.** Swamp's bundler inlines all npm packages (except zod) into extension bundles at bundle time. `deno.lock` and `package.json` do NOT cover extension model dependencies — this is by design. Always pin explicit versions in `npm:` import specifiers (e.g., `npm:lodash-es@4.17.21`).
8. **Reports for reusable data pipelines.** When the task involves building a repeatable pipeline to transform, aggregate, or analyze model output (security reports, cost analysis, compliance checks, summaries), create a report extension. Read `.agents/skills/swamp/SKILL.md` for guidance.
9. **"Workflow" means a swamp workflow.** In this repository the word "workflow" (and "create/run/execute/validate/debug workflow", "automate", "orchestrate", "automated/nightly job") refers to a swamp workflow — a declarative YAML DAG of model-method steps authored via `swamp workflow create`. Read `.agents/skills/swamp/SKILL.md` for these requests. Do NOT interpret these as a request to build an agent task list, spin up worktrees, or schedule a cron/remote agent. Only use those orchestration mechanisms when the user explicitly names one (e.g. "task list", "subagent", "worktree", "cron", "remote agent") or explicitly asks you to do the work yourself step by step rather than author a swamp workflow.
10. **Use swamp, don't bypass it.** Always work through swamp commands — don't go around them with raw shell tools. Use `swamp data query` to find data, not `grep`/`find` on `.swamp/` files. Use model methods to interact with resources, not `curl`/`aws`/`gcloud`/`kubectl` when a model type already wraps that API — check with `swamp model type search`. Use `swamp help` for CLI discovery, not guesswork. Composing with swamp output is fine (e.g. piping `--json` through `jq`) — the anti-pattern is bypassing swamp entirely.
11. **Inspect reports after failures.** When a model method or workflow run fails, inspect its generated reports before retrying or changing definitions. Reports run even on failure and capture structured diagnostics — error messages, execution status, arguments, and data output pointers. Use `swamp report get @swamp/method-summary --model <model> --json` for method failures or `swamp report get @swamp/workflow-summary --workflow <workflow> --json` for workflow failures. Run `swamp help report get` to confirm current retrieval syntax.

## Skills

**IMPORTANT:** Skills are detailed guides stored in `.agents/skills/`. When a task
matches a skill area below, read the corresponding `SKILL.md` file for guidance.

- `.agents/skills/swamp/SKILL.md` - Swamp CLI — models, workflows, data, vaults, extensions, publishing, repos, reports, issues, and troubleshooting
- `.agents/skills/swamp-getting-started/SKILL.md` - Interactive onboarding for new swamp users

## Getting Started

**IMPORTANT:** At the start of every conversation, run
`swamp model search --json`. If no models are returned (empty result), you MUST
immediately read `.agents/skills/swamp-getting-started/SKILL.md` and follow its
instructions. This walks new users through an interactive onboarding tutorial.

If models already exist, start by reading `.agents/skills/swamp/SKILL.md`
to work with swamp models.

## Commands

Use `swamp --help` to see available commands. For a machine-readable JSON
schema of the CLI (commands, options, arguments) intended for agent
consumption, run `swamp help [<command>...]` — e.g. `swamp help` returns
the full tree, and `swamp help model method run` scopes to a subtree.
<!-- END swamp managed section -->

# Matchboard Agent Instructions

Matchboard is a private coach-facing football operations cockpit for match-round squad planning, controlled player movement, coaching intent, matchday responsibility, plan integrity signals, finalized history, and post-match reflection across a league season.

It is deployed as a hosted web app on Vercel with Neon PostgreSQL backend persistence. It is not a generic club-management platform, not a parent communication platform, and not a public player evaluation system.

`features/matchboard.feature` is the single behavioral source of truth for domain behavior, selection rules, and expected outcomes.

If code, UI, schema, tests, README, and `features/matchboard.feature` disagree, fix the mismatch.

When workflow or UX semantics change, update `features/matchboard.feature`, `AGENTS.md`, and `README.md` before implementing. Do not implement product-shape changes before aligning supporting docs.

## Required skills

When working on Matchboard, always apply these skills in order:

1. **`git-branch-commit-pr`** — for all coding-agent work: branch creation, commits, and PRs
2. **`adr-governance`** — for architecture-affecting changes: public API or interface changes, storage model changes, state-management model changes, auth or authz model changes, deployment or runtime changes, observability strategy changes, test-strategy changes, cross-module or cross-service boundary changes, event or message contract changes, or any change that introduces durable design rules future tasks must follow. Create or update repo-local ADRs under `docs/adr/` before making structural code changes.
3. **`architectural-residue-records`** — when work exposes multiple sources of truth, duplicated domain behaviour, active legacy structures, staged migration residue, violated architectural boundaries, or an existing ARR. Create or update ARRs under `docs/arr/` to record verified structural mismatches between intended architecture and current implementation. Do not create an ARR for every vulnerability. Do not use an ADR as a backlog item. When an ARR is discovered during code work, record it before continuing; when implementation resolves an ARR, update its state with evidence.
4. **`ux-webapp-design-craft`** (global) — for all UX, visual design, workflow, navigation, interaction, accessibility, and information architecture work
5. **`app-product-engineering`** (global) — for any user-facing app work: UX, interaction, accessibility, workflow, forms, dashboards, navigation, responsive behavior, design systems

All Matchboard-specific domain rules (selection engine boundaries, explainability, decision audit, player ID privacy, child-safety language, readiness states, workflow stages) are documented in this AGENTS.md file directly, not in a separate skill file.

## Mandatory coding-agent workflow

Before coding, read:
- `docs/development/coding-agent-working-session.md`
- the `git-branch-commit-pr` skill

All coding-agent work must follow the working-session contract.

Discover available verification/investigation procedures with
`swamp --no-telemetry model search --json` (see `docs/development/swamp-workflows.md` and
`docs/adr/0068-swamp-procedure-runner.md`) before hand-rolling a command sequence. When a task
requires running the same multi-step command sequence more than once, or a sequence any future
agent session would plausibly need again (a new investigation, verification, or CLI-wrapping
procedure), add it as a `command/shell` model under `models/command/shell/` following the
existing procedures' pattern (POSIX `/bin/sh`, `set -e`, no bashisms) rather than leaving it as
one-off shell commands in the transcript. Update `docs/development/swamp-workflows.md`'s
procedure table when a procedure is added, changed, or its status changes (stub → real).

For product, workflow, UX, navigation, selection, fixtures, teams, players, matches, assistant, rules, explainability, and decision-audit changes, the domain rules in this AGENTS.md are mandatory.

## Licensing rules

- Matchboard is licensed under Elastic License 2.0 (`Elastic-2.0`). Do not replace or weaken the root LICENSE.
- Do not describe Matchboard as MIT licensed or OSI Open Source. Use "source available" or "publicly developed".
- New Matchboard-owned code follows the repository license unless explicitly stated otherwise.
- Preserve third-party license and copyright notices. Do not remove them during changes.
- Do not copy third-party code with unclear or incompatible licensing. Surface licensing uncertainty instead of silently deciding.
- Keep `README.md`, `package.json` license field, `LICENSING.md`, `CONTRIBUTING.md`, and `TRADEMARKS.md` consistent with the current license.
- Do not change CLA requirements casually. Follow the contributor agreement process in `CONTRIBUTING.md`.
- Do not accept substantive external code without an accepted CLA record. The CLA check workflow enforces this on pull requests.
- The Matchboard CLA is based on Harmony v1.0 Option Five. It is active, not pending review.
- CLA acceptance must be affirmative and recorded (GitHub username, legal name, CLA type, version, timestamp). Opening a PR is not implicit acceptance.
- Trivial contributions (typo fixes, formatting, mechanical dependency updates) may not require a CLA. When uncertain, require the CLA.
- Licensing and commercial decisions remain with the Matchboard maintainer/copyright holder.

## Security rules

Every operation is denied by default and receives only the verified actor, tenant, input, data, network and dependency capabilities it needs.

### Invariant

One business operation, one owning implementation, multiple adapters.

Routes, server actions, API handlers, Assistant actions, exports, jobs and simulation runners may adapt input and output. They must not independently implement common domain behaviour.

### Mandatory security assessment for every change

Before adding or changing an operation, determine and verify:

1. who may call it
2. which organisation and resource it may affect
3. which input is trusted and which is hostile
4. which data may leave the process
5. which external systems it may contact
6. which secrets it needs
7. what must be logged without exposing sensitive data
8. what negative and abuse cases must fail
9. whether the change affects the threat model, ASVS mapping, ADRs or ARRs

### Security rules

- Authentication is not authorisation. IDs, slugs, hidden form fields, URLs and client-supplied organisation values are never authority.
- Authorisation is server-side and deny-by-default.
- Tenant-owned operations require trusted context.
- Sensitive operations re-check current membership and role.
- Input schemas and bounds are required on every server mutation.
- Output is minimised and encoded for its destination.
- Unsafe raw SQL methods (`$queryRawUnsafe`, `$executeRawUnsafe`) and SQL string concatenation are forbidden in application code.
- Outbound HTTP is centralised and destination-allowlisted.
- External AI payloads are centrally projected and sanitised.
- Secrets never enter Git, logs, fixtures, reports or public environment variables.
- Invitation tokens are hashed (SHA-256) for database lookup. The plaintext token is available only at creation time for the acceptance link and is nullified after accept, decline, revoke, or expiry. The database never stores a usable plaintext token.
- BYPASS_AUTH is a test-only mechanism explicitly rejected in production. It must not be reintroduced as an authorization shortcut.
- Caches, jobs, exports and files are tenant-aware.
- Audit logs exclude sensitive payloads.
- New dependencies and GitHub Actions require security review.
- Security tests include negative and abuse cases.
- Controls cannot be weakened to make tests pass.
- Ordinary users cannot be restricted by IP, VPN or country as a normal access model.
- Visible friction is reserved for high-risk privileged operations.

### Security engineering programme

Matchboard has a local security engineering workflow: find → triage → verify → reproduce → regression test → fix → rescan.

Available commands:
- `npm run security:tools` — verify required tools and versions
- `npm run security:semgrep` — run SAST with custom Matchboard rules
- `npm run security:deps` — run OSV dependency vulnerability scan
- `npm run security:secrets` — run Gitleaks secret detection
- `npm run security:authz` — run Matchboard authorization security test suite
- `npm run security:static` — run all non-runtime security scanners
- `npm run security:dast:baseline` — passive ZAP scan (safe)
- `npm run security:dast:active` — active ZAP scan (requires opt-in, isolated env)
- `npm run security:review` — run full non-destructive security review

Rules:
- A scanner finding is evidence, not proof. Do not modify code merely to silence scanners.
- Credible findings must be reproduced, regression-tested, and verified.
- Never run active security scans against production (app.matchboard.football).
- Active DAST requires explicit opt-in and an isolated Neon security branch.
- Never commit generated security reports (SARIF, ZAP output, etc.) to the repository.
- Never commit real credentials or exploit artifacts.
- CodeQL is **active** on this public repository via GitHub's repository-settings-level default setup (not an in-repo workflow), relying on GitHub's public-repository code-scanning entitlement rather than the standalone CodeQL CLI Terms (which Matchboard's ELv2/non-OSI license would otherwise fail). This is a maintainer licensing decision — see ADR-0070 and SECURITY.md's "CodeQL" section. Do not disable it or add a competing `codeql.yml` workflow without a new maintainer decision.
- See SECURITY.md for full documentation.

### Security finding, ARR and ADR boundaries

- Security finding: a specific vulnerability or failed control.
- ARR: a verified structural mismatch between intended architecture and current implementation. Recorded in `docs/arr/`. Use the `architectural-residue-records` skill to create or update ARRs.
- ADR: a decision, including deliberate deferral or accepted risk. Recorded in `docs/adr/`. Use the `adr-governance` skill to create or update ADRs.

Do not create an ARR for every vulnerability. Do not use an ADR as a backlog item. A vulnerability is a security finding; an ARR records a structural mismatch; an ADR records a decision.

### Provider configuration workflow

When code changes require Vercel, Neon, GitHub or other provider settings:

- automate only through existing safe authenticated tooling
- otherwise create or update durable provider desired-state documentation in the repository
- record an exact external action in the programme state while active
- never claim completion without evidence
- never document secret values

Supporting documentation must be updated before implementation whenever behavior, UX, routes, schema, domain contracts, or workflow changes.

Every branch must remove stale/dead/unused artifacts related to the change.

Every branch must run lint, typecheck, tests, build, and schema validation where relevant.

## Workflow

Matchboard is set up by adding teams, players, and matches. The coach can then populate all draft squads. Populate all groups matches by round and generates draft selections per round. The coach reviews plan integrity signals by round, fixes issues per match, may manually adjust draft squads, and finalizes one round at a time. Season/league-season history is used to keep load, support, drops, development exposure, and fairness balanced over time.

The primary coach workflow is:

1. **Setup** — Add teams, add players, add matches. Mark player availability.
2. **Define intent** — Set match purpose, team risk, desired football behavior, support need, development focus.
3. **Populate all** — Generate draft selections for all rounds in the active league season. Each round is generated via round-level orchestration (not match-by-match). No round is finalized by populate all.
4. **Review** — Inspect draft selections, plan integrity signals, fairness impact, explanations, and coaching intent alignment. Resolve blockers. Manually adjust draft squads if needed.
5. **Adjust** — Manual changes are allowed. Manual changes must show impact. Manual changes must preserve auditability.
6. **Finalize** — Lock one round at a time, or lock individual matches within a round. Finalized rounds and matches become history and cannot be silently mutated.
7. **Reflect** — Record team-level reflection. Record player-level feedback only where useful. Use observable behavior.
8. **Learn** — Use history, readiness, feedback, and fairness to inform later planning. Do not mutate finalized historical plans.

The Assistant page (presented at the canonical `/today` route since Phase 2.4 — see "Canonical routes") must always show the next action based on this workflow state. The Assistant page derives work items from live database state using `getAssistantCommandCentre()`, not from persisted AssistantIssue rows.

The assistant must not skip steps or suggest finalization before draft review. Planning notes, scoring preferences, opponent observations, and seasonal context never appear as Assistant work items. The CoachingIntentSelector must not appear on the Assistant page — intent belongs on Fixtures and Round Board.

## Stack

- Next.js 16 App Router (Turbopack)
- TypeScript
- Tailwind
- Prisma
- PostgreSQL (Neon for production, Docker Compose for local dev)
- Auth.js (Google OAuth, organisation membership)
- Cloudflare Workers/Durable Objects (`workers/live-match/`) — optional live match realtime
  coordination layer, additive to the primary Next.js/Vercel/Neon stack, not a replacement
  for any of it. See ADR-0086 and `docs/development/live-match-realtime.md`.

## Product boundary

Matchboard plans squads for already-created matches.

It does not:
- create fixtures
- schedule a season
- manage a club
- support public signup or multi-tenant self-service auth
- store real player data in the repo
- serve as a parent communication platform
- serve as a public player evaluation system
- serve as a punishment or ranking engine

Note: Matchboard does have a match creation form for recording match details (opponent, date, home/away, type, format). This is match data entry, not fixture creation or season scheduling.

### Organisation (tenant) creation is invitation-only, not self-service

Matchboard is invitation-only (ADR-0085). There is no in-app "create organisation" flow —
authenticating with Google does not let a user create a new tenant for themselves. New
organisations are provisioned by the maintainer/backend team via
`scripts/bootstrap-organisation.ts`, not through the application UI. `/organisations` only
shows a user's existing memberships and pending invitations; its empty state directs the
user to ask an administrator for an invitation, with no create action. Do not reintroduce
a self-service organisation-creation form or server action without a new explicit decision
overriding ADR-0085 — this is a deliberate security-boundary choice, not an oversight.

## Core operating model

Selections are generated per match round.

A match round is the operational planning unit.

The season or league season is the fairness and load-balancing context.

A round may contain one or more matches.

One planned assignment per player per round. A player must not be planned for two matches in the same round/week. Moving a player between matches transfers the assignment. It must never duplicate the assignment. Additional actual appearances from post-match reports are recorded separately as unplanned participation and do not mutate finalized planned selections.

The round-level pipeline runs in strict phase order:
1. Per-match core selection
2. Round-level required support resolution
3. Cross-match conflict resolution
4. Development routing
5. Squad repair (repairing teams weakened by support movement)
6. Post-pipeline validation and plan integrity signal persistence
7. Policy-derived warnings (additive, non-blocking)

No phase may be skipped. Each phase must complete before the next begins.
No phase may create a second planned selection for the same player in the same round.

Populate all generates drafts for all rounds in a league season in one action. It does not finalize. Each round is generated via round-level orchestration to preserve cross-match conflict resolution.

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
- fairness across the season/league season

Movement is not a punishment or permanent label.

Do not design artificial equal-strength balancing. The app should create useful squad selections, not flatten all groups into generic equality.

### Coaching intent and execution model

Matchboard is not only a selection engine. Matchboard supports:

intent → selection → responsibility → execution → reflection → learning

This loop must be reflected in the UI workflow, not just the selection engine.

Selection logic must not be changed without preserving explainability and child-safe language.

Coaching intent can be attached to:
- league seasons
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

### Post-match reflection and feedback (consolidated into Football observations)

**Football observations is the canonical player-development observation concept.** The earlier
"Post-match feedback" concept (`MatchExecutionFeedback`, 5 fixed categories below) was a
narrower, largely-overlapping predecessor — both asked the coach to describe the same match in
different vocabularies, on the same post-match page, back to back. There is now exactly one
active write path: `FootballObservationSection` (`src/components/player-development/`,
`PlayerDevelopmentObservation` model), which already feeds the evidence engine
(`player-evidence-service.ts`) with its 14 football-skill-code vocabulary. "Post-match feedback"
is no longer an active input:
- `MatchExecutionFeedback` rows and the `MatchExecutionFeedback` table are preserved — historical
  data is never deleted.
- Existing rows display read-only via `LegacyMatchFeedbackSection`
  (`src/components/matches/legacy-match-feedback-section.tsx`), shown only when a match already
  has legacy rows, labeled "Post-match feedback (legacy)", positioned after the canonical Football
  observations section.
- There is no remaining create/update/delete action for `MatchExecutionFeedback` — the former
  active write path (`match-feedback-section.tsx`, `post-match/feedback-actions.ts`) was removed.
- `src/lib/coaching/match-execution-feedback.ts`'s CRUD functions were already unreachable before
  this consolidation (the removed action file inlined its own `db.matchExecutionFeedback.*` calls
  instead of calling them) and remain unused; flagged as residue for a future cleanup pass rather
  than removed in the same change that touched the active UI surface.

Original feedback categories (historical data only, no longer an input path): effort, team help,
reset after mistake, positional discipline, teammate involvement.

Rules (apply to Football observations as the active concept; legacy feedback display keeps the
same coach-facing/observable-behavior/no-shaming constraints for historical rows):
- Feedback/observations are coach-facing by default.
- Feedback/observations describe behavior, not character.
- Feedback/observations are optional and lightweight.
- Feedback/observations should be recorded only where useful.
- Feedback/observations must not shame players.
- Feedback/observations must not become automatic punishment.
- Football observations can inform future plan integrity signals, readiness signals, and planning
  suggestions (the historical `FEEDBACK_TO_READINESS` readiness-suggestion mapping in
  `src/lib/coaching/types.ts` is now unreferenced outside its own test now that its only caller —
  the removed feedback-creation form — is gone; left in place pending an equivalent wired into
  Football observations, rather than deleted).
- Feedback/observations must not mutate finalized planned selections.
- Actual participation belongs to post-match reality/history and must stay separate from planned selection.
- Feedback/observations must never use disallowed language: lazy, selfish, bad attitude, weak player, not good enough, useless, problem player.
- Feedback/observations must use observable behavior descriptions: helped teammate after ball loss, recovered position quickly, stayed available for pass, etc.

### Match-specific player absence

Round/team assignment, match roster membership, and match participation status are three
distinct, related concepts. A player can remain assigned to a round/team while being marked
Away/Sick/No-show/Declined for one specific match — the `Selection` row is never touched by this.

This reuses the existing `MatchReportAbsence` structured-absence concept (previously only
reachable from the post-match report screen) rather than introducing a second competing model.
`MatchReportAbsence` already has a direct `matchId` field (not only reachable via the report), so
it can be queried per-match without a report existing yet.

- `markMatchAbsence()`/`clearMatchAbsence()` (`src/lib/reports/report-mutations.ts`) are the
  domain orchestrators. If no `PostMatchReport` exists yet for the match (the normal pre-kickoff
  state), `markMatchAbsence()` seeds one early via `seedReportFromFinalizedSquad()` with its
  selection-status filter broadened to `["DRAFT", "FINALIZED"]` for this caller only — the normal
  post-match "After match" entry point keeps its FINALIZED-only default unchanged.
- `markMatchAbsence()` also upserts the player's `PostMatchPlayerActual.attendanceStatus` to
  `NO_SHOW` so report completion is never blocked by a stale `UNKNOWN` attendance the coach
  already explained pre-match (AGENTS.md "Canonical data truth": "UNKNOWN attendance blocks
  report completion").
- Server actions: `markMatchAbsenceAction()`/`clearMatchAbsenceAction()`
  (`src/app/(app)/matches/absence-actions.ts`).
- UI: `AbsenceControl` (`src/components/matches/absence-control.tsx`) on the match detail page's
  Squad tab, per player chip. Only active before the report is locked; a locked report uses the
  existing post-match correction mechanism instead.
- `PlannedAbsenceReason` gained an `AWAY` value (additive enum) alongside the existing
  `NO_SHOW`/`SICK`/`INJURED`/`DECLINED`/`NO_RSVP`/`OTHER`.
- A non-participating player is excluded from active-participant contexts — the League live
  reporting roster (`getLiveMatchPreMatchPackageAction`, `src/app/(app)/matches/[matchId]/live/live-actions.ts`)
  and the canonical `getEffectiveLeagueMatchRoster()` (`src/lib/matches/match-helper-eligibility.ts`)
  both carry an `absenceReason`/`isActiveParticipant` field per roster entry; `LiveMatchClient`'s
  scorer/assist/rotation/fair-play pickers filter on `isActiveParticipant !== false` — but the
  player remains visible in the match roster (Squad tab chip, dimmed with a strike-through name)
  rather than disappearing.
- Event matches are out of scope for this — `MatchReportAbsence` is a League `Match`/
  `PostMatchReport` concept; `isActiveParticipant` on `SquadPlayer` is optional and Event-match
  squad data simply never sets it (defaults to active).

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

Full personal-data inventory (what's stored, where, retention/deletion capability):
`docs/domain/pii-inventory.md`. Update it whenever the schema or handling of player/user
personal data changes.

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
- league season
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

### Combination evidence (bounded advisory signal)

Combination evidence describes what actually happened while a defined football relationship (partnership, triangle, line, corridor, functional unit, full configuration) existed on the pitch. It is descriptive/contextual, never a chemistry score.

- Derived only from the actual position timeline (`ActualPositionInterval`, including its `line`/`lane` classification), never from planned assignment.
- Confidence (`INSUFFICIENT`/`EMERGING`/`ESTABLISHED`) reflects how much evidence exists, not how good the combination is. Unknown is neutral, never negative.
- Consumed by selection as a bounded, capped advisory signal (`src/lib/selection/combination-scoring.ts`) — cannot override eligibility, availability, hard conflicts, required coverage, or fairness rules.
- Intent-dependent: amplified under `CHALLENGE_EXPOSURE`/`STABILIZE_WEAKER_TEAM` coaching intent, suppressed under `CONFIDENCE_REBUILD`/`RESET_AFTER_ERROR` so unknown pairs are never structurally disadvantaged against known ones, unmodified otherwise.
- Direct assist contribution is only available for live-recorded matches (the canonical `Assist` model carries no timestamp) — left at 0 for direct-entry reports rather than guessed.
- Explanations are factual sentences (minutes together, match count, confidence) — never a synthesized score or percentage. See ADR-0094.
- Beyond selection scoring, factual season partnership evidence (`selectRelevantPartnerships()`, `src/lib/evidence/combination-aggregation.ts`) is also surfaced as read-only planning context on the Tactics tab (current line-up), the Rotations tab (current starting line-up), and the opponent detail page (evidence recorded in matches against that specific opponent, via `getOpponentCombinationEvidence()`) — never a second selection-scoring input, purely descriptive.

### Canonical post-match learning pipeline (League/Event evidence parity)

There is one learning pipeline for "what did Matchboard learn from a completed match" — used by
new League matches, new Event matches, and the historical catch-up tool described below. League
and Event are adapters into this pipeline; neither owns a separate copy of the evidence
algorithms. See ADR-0104.

- `FootballMatchRef` (`src/lib/evidence/football-match-ref.ts`) — discriminated union identifying
  a match's source (`LEAGUE_MATCH { matchId, leagueSeasonId }` /
  `EVENT_MATCH { eventMatchId, eventId, evidenceLeagueSeasonId? }`) without exposing persistence
  details to evidence algorithms.
- `src/lib/evidence/adapters/` holds one adapter per source (`league-evidence-adapter.ts`,
  `event-evidence-adapter.ts`) that builds a `FootballMatchRef`, resolving each source's own
  evidence-season context. Generalized evidence algorithms
  (`recordOpponentSportingEvidenceForRef`, `computeAndApplyPlayerEvidenceForMatch`,
  `rebuildMatchCombinationEvidence`, `rebuildActualTimelineForRef`) take a `FootballMatchRef` and
  resolve their own source-specific query internally, branching only at the narrow
  persistence-write boundary (which unique column to upsert on) — there is no single shared
  "canonical evidence" struct threaded through every function, since each algorithm needs a
  different slice of match data (observations for player evidence, score/participants for
  opponent evidence, position intervals for combination evidence).
- `runPostMatchLearning(ref)` (`src/lib/evidence/post-match-learning.ts`) — the one shared
  orchestrator, called from both League's `completeReport()`
  (`src/lib/reports/report-mutations.ts`) and Event's `completeEventReport()`
  (`src/lib/reports/event-report-mutations.ts`). Sequence: rebuild actual timeline → record
  opponent sporting evidence → compute player evidence → rebuild combination evidence (skipped
  with a reason code, e.g. `NO_EVIDENCE_SEASON`, when no evidence season resolves). Returns a
  structured `APPLIED`/`SKIPPED`/`FAILED` result per evidence type — no step's failure blocks
  report completion or another step, and re-running is always safe (idempotent upserts/rebuilds).
- Generalized models use nullable dual-FK + discriminator, matching the pattern already
  established by `PlayerDevelopmentObservation.sourceType`: `matchId String?` /
  `eventMatchId String?` with a `CHECK` constraint enforcing exactly one is set. Applied to
  `PlayerDevelopmentObservation`, `OpponentSportingEvidence`, `CombinationEvidence`,
  `ActualPositionInterval`.
- Event actual-timeline reconstruction (`rebuildEventActualTimeline`, in
  `src/lib/evidence/actual-timeline.ts` alongside League's `rebuildActualTimeline`) derives
  intervals from `EventMatchLineupAssignment` (starting state) plus `EventLiveMatchEvent` rows
  (`ROTATION_OUT`/`ROTATION_IN`/`POSITIONS_CHANGED` — the same shared `LiveMatchEventType` enum
  League uses) — no separate Event substitution table.
- Not generalized, and not evidence-algorithm input: `OpponentEncounterObservation` (coach's
  manual qualitative assessment) and `TeamReflection` (structured rating model). Event keeps its
  existing free-text `opponentObservation`/`teamReflection` fields on `EventPostMatchReport`.
- `EventMatch` has no `matchFit` field, so the Event opponent-evidence adapter never
  auto-excludes on that basis (League's CHAOTIC/SUPPORT_OVERPOWERED/SUPPORT_TOO_LOW check has no
  Event equivalent yet). If Event ever needs this, it must reuse the existing `MatchFit` enum,
  never a duplicate.
- The "Populate opponent levels" transient catch-up tool (see "Provider configuration workflow"
  boundary rules and ARR-0031) processes both historical League and Event matches through this
  same pipeline — not a second historical-only algorithm.

### Quick observations

A capture-first, classify-later inbox (`src/lib/coaching/quick-observation.ts`) for a note the coach wants to record in the moment without deciding up front which existing evidence owner it belongs to. No AI classification.

- Minimum fields: note text, optional match/player context, timestamp, author.
- Later, explicit coach action converts it into an existing owner (development thread observation, team reflection, opponent observation), keeps it as a plain note, or discards it — never automatically.
- Converting to an opponent observation reuses the same identifying-detail rejection as the normal opponent-observation form. See ADR-0098.

### Emergency repair options

Before kickoff, a late unavailability can produce a small, ranked set of viable replacement options (`src/lib/selection/emergency-repair-options.ts`) — never applied automatically. Reuses the existing manual-edit mutation as the sole eligibility gate (a candidate needing an override reason is not "viable" here) and existing scoring primitives (readiness, recent load, combination evidence) for ranking. See ADR-0099.

The Round Board surfaces this via a "Repair options" action (Wrench icon) on any player chip in a match column (not the Available column, never on a finalized match). It calls `generateEmergencyRepairOptionsAction()`, shows the ranked options in a dialog, and applies the coach's chosen option through the same remove/add manual-edit actions the board already uses for drag/drop and the non-drag Move picker — nothing is applied until the coach picks an option.

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

GroupMovementPath is the group-level authority that expands into team-level RotationPath edges for selection engine consumption. The `load-rotation-paths.ts` helpers merge team-level RotationPaths with group-level GroupMovementPath edges, ensuring the selection engine considers both sources.

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

### Player locks ("Pin")

`PlayerLock` is a round-scoped, explicit coach planning constraint, read directly by the selection engine (`generate-selection.ts`). It is coach-facing under the name **Pin** (DECISIONS.md: "Use `Pin` for an explicit coach planning constraint"); the underlying model/field names (`PlayerLock`, `lockType` values `LOCKED_IN`/`LOCKED_OUT`) are unchanged.

- **Pin out** (`LOCKED_OUT`) excludes the player from the entire round automatically — a hard exclusion, always honored (no override needed to exclude further, since it's already the coach's explicit instruction).
- **Pin in** (`LOCKED_IN`) forces the player into a selection for the round if they are not otherwise chosen. If a hard rule (e.g. unavailability) would block them, the pin does not override it — the round instead shows a `player_locked_in_blocked` warning explaining why.
- One `PlayerLock` per `(matchRoundId, playerId)` — pinning a player again while already pinned replaces the existing pin (upsert), it does not create a duplicate.
- Cannot pin a player in a `FINALIZED` round.
- UI: `src/components/team/team-detail.tsx`'s Current Round tab (`PinControl`) — a coach can pin/unpin any player shown there (selected as core, sent as support, or dropped) for that team's current round.
- Domain: `src/lib/selection/player-lock.ts`. Actions: `src/app/(app)/teams/player-lock-actions.ts`.

### Movement candidates

MovementCandidate is a coach-facing domain concept for marking individual players as suitable for temporary movement through a specific rotation path. It is a soft preference that augments — but does not replace — RotationPath eligibility and existing player attributes.

Core rules:
- A MovementCandidate links a player to a rotation path and a role (SUPPORT or DEVELOPMENT)
- A player can have multiple MovementCandidate records (one per rotation path)
- Unique constraint on `[playerId, rotationPathId, role]` — no duplicates
- MovementCandidate is coach-facing only — must never appear in parent-facing exports or external AI payloads
- MovementCandidate does not change core team membership
- MovementCandidate does not replace `supportSuitability` or `developmentReadiness` player attributes
- MovementCandidate does not bypass hard eligibility rules (RotationPath, nonRotatable, same-round conflict)
- The selection engine PREFERS active candidates (+12 scoring bonus) but falls back to any eligible player on the rotation path
- Candidate filtering is always active when generating selections — no toggle
- Non-candidate players can still be selected for non-core movement when eligible

Candidate role compatibility:
- SUPPORT candidates are allowed on BACKFILL rotation paths
- DEVELOPMENT candidates are allowed on CONFIDENCE_REBUILD rotation paths
- This mirrors the selection engine's role compatibility for squad repair and development routing

Candidate status:
- ACTIVE — candidate is considered in selection scoring
- PAUSED — candidate is temporarily excluded from scoring but record is preserved
- Reactivating a PAUSED candidate requires the rotation path to still be active

Rationale categories (structured, not free text):
- CHALLENGE_EXPOSURE — player receives harder match context because effort and readiness support it
- CONFIDENCE_AND_INVOLVEMENT — player benefits from involvement and connection
- STABILISE_TEAM_FUNCTION — player helps stabilise a team that needs support
- SUPPORT_TEAMMATES — player helps teammates through coordinated movement
- POSITIONAL_LEARNING — player develops through positional exposure
- RESET_AND_RESPONSIBILITY — player receives reset and responsibility context
- COACH_JUDGEMENT — coach judgement with specific context in the note

Drift and review detection (all are Planning notes, not Blocked or Decision required):
- Review overdue — `reviewBy` date has passed
- Long-running candidate — active for many rounds without being used
- Repeated non-core without candidate — player moves without candidate record
- One-way movement pattern — player only moves one direction
- Core replacement concern — player rarely selected for core team
- Never-used candidate — candidate never resulted in actual movement

Data layer:
- `src/lib/selection/movement-candidate.ts` — validation, CRUD, queries, enrichment
- `src/app/(app)/teams/movement-candidate-actions.ts` — server actions

Manual draft edits:
- Selecting a non-candidate player for non-core movement shows a contextual note (not a hard block)
- Manual override always remains possible with reason

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

### League Match helpers

A League Match helper is a temporary, match-level addition of a player to one specific League
Match, so the player is available to live match reporting (rotation/position tracking, goal
scorer selection, assist selection) before the match starts — not only retroactively in the
after-match report. This mirrors the existing Event Match helper concept
(`EventMatchSupportAssignment`) but for League matches, since Event helpers are blocked once the
event is finalized and blocked from overlapping matches — the opposite of what League helpers
need.

Rules:
- Adding a helper never creates, moves, or deletes a `Selection` row. The player's planned League
  Round team assignment is untouched — this is not a transfer, loan, or round rebalancing.
- Adding a helper works identically whether the League Round is finalized or still in draft.
  Finalization locks planned round assignments; it does not prevent an emergency helper from being
  added to an individual match. The round is never reopened and never becomes editable because of
  a helper.
- A player already assigned to another League team in the same round remains selectable as a
  helper. Existing assignment does not make a player unavailable for helper selection, and the
  coach does not need to remove or transfer the player from their own team first.
- A player who has already played another match in the same round remains eligible to help — this
  is an explicit, intentional coach override of the normal one-planned-assignment-per-round
  expectation, not a scheduling conflict to block.
- A player cannot be added as a helper twice to the same match (duplicate prevention), and cannot
  be added as a helper if already a normal participant in that match.
- The live match roster for a League Match is `normal Selection-based squad ∪ match helpers`. Live
  reporting (rotation, position, goals, assists) consumes this one combined roster; there is no
  separate helper-only code path anywhere in live reporting.
- A helper added before the match already appears in the after-match report once it's opened —
  the same underlying actual-participation model (`PostMatchPlayerActual`, `source:
  EMERGENCY_BACKFILL`, `unplannedAppearanceReason: EMERGENCY_SQUAD_COVER`) is seeded
  automatically. The coach never needs to add the same player again retroactively.
- A helper appearance is a real, separate match appearance, counted correctly by the existing
  effective-participation/statistics layer alongside the player's own planned appearance for their
  normal team in the same round — without corrupting round-allocation history or season
  balancing calculations.
- A helper can be removed before they have any recorded actual participation. Once a
  `PostMatchPlayerActual` row exists for that player and match (report already seeded or started),
  removal is refused rather than silently deleting recorded goals, assists, or live match events.
- Server-side validation enforces every invariant above; UI controls being disabled is not a
  substitute. See ADR-0077 for the full design.

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

`computeRoundPlanIntegrity()` must evaluate squad size, goalkeeper coverage, and any other
per-match squad-composition check against a match's full selection set — DRAFT and FINALIZED
together, since a match individually finalized within an otherwise-DRAFT round did not stop
having players just because it's locked. Only checks that ask "does the current DRAFT plan need
a coach decision before finalizing" (e.g. `SELECTED_PLAYER_UNAVAILABLE`) should stay scoped to
DRAFT selections, since a FINALIZED selection isn't something a draft action can fix and that
match isn't part of what the round-level or per-match finalize call being evaluated would change.
Querying only DRAFT selections for squad-composition checks silently treats an already-finalized,
fully-staffed match as having zero players, producing false Blocked signals that then require an
override reason to finalize the round's remaining matches — a real production bug (see ADR-0073).

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

`double_load_needed` was removed from the structured categories above (no UI ever offered it,
and only historical rows could reference it). The `OverrideReasonCategory.DOUBLE_LOAD_NEEDED`
Prisma enum value is retained so any existing historical row remains readable — matching the same
retained-enum-value pattern already used for `SelectionRole.BACKFILL`. New code must never produce
or accept it; the app-level type, validation, and display layers no longer include it at all.

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
- Squad repair (BACKFILL) from another team creates a movement ledger entry
- Legacy controlled double-load data retains its movement ledger entries
- Manual override does not remove the need for movement ledger entries
- Finalization flips `isDraft` from `true` to `false`; it does not create new entries
- Un-finalization flips `isDraft` back from `false` to `true`

Existing data that has non-core selections but empty MovementLedger must be backfilled via a normalization/migration function.

## Draft regeneration

Generated draft selections can be regenerated at three levels:
- **Regenerate match** — rerun automatic selection for one match, preserving any manual edits
- **Regenerate round** — rerun round-level orchestration for one round, preserving any manual edits
- **Regenerate all drafts** — regenerate all DRAFT rounds in the league season, preserving manual edits in each

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
- group pool resolution and cross-group movement authorization (`group-pool-resolver.ts`, `cross-group-movement-authorizer.ts`, `group-path-bridge.ts`)
- group-aware rotation path loading (`load-rotation-paths.ts`)
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

Domain/policy code in `src/lib/selection/`, `src/lib/policies/`, `src/lib/rules/`,
`src/lib/groups/`, and `src/domain/team-composition/` must never import Next.js, Brevo, or Vercel
SDKs directly (ADR-0079) — that belongs in the calling application-service/action layer. Enforced
by `npm run architecture:check` (part of `npm run validate`).

Rules must be testable without React.

## Best Lineup

User-facing label: **Recommended lineup** (not "Best lineup" — "best" implies an objectively
optimal team, which the algorithm does not determine; it applies Matchboard's selection rules and
evidence to produce a recommendation the coach can accept or change, preserving coach authority).
The internal feature name, file names (`best-lineup.ts`, `best-lineup-tab.tsx`,
`best-lineup-actions/`), database model (`TeamBestLineup`), and function names
(`autoSelectBestLineup`, `copyBestLineupToMatch`, `assignPlayerToBestLineupSlot`) are unchanged —
this is a display-language rename only, matching the existing pattern of "Squad repair" (internal
`BACKFILL`) and "Pin" (internal `PlayerLock`).

Best Lineup answers a different question from `src/domain/team-composition/`'s cross-team
composition scenarios. Team composition distributes players *across* multiple teams from a
shared pool. Best Lineup fills formation slots *within one team's own core roster*, independent
of any specific match, and is explicitly not a cross-team optimizer.

Meaning, per the reconciliation required by Phase 9 §63/§67 of the consolidation programme (no
prior explicit domain decision existed for this shipped feature): Best Lineup is a **generated
sensible starting point**, not an abstract "strongest possible XI" and not a match-specific
tactical plan. It becomes a **coach-preferred lineup** the moment a coach locks or manually edits
a slot — the generated state is a starting point to react to, not a final answer the coach must
accept as-is.

Behavior:
- `autoSelectBestLineup` fills each formation slot with the best positionally-compatible player
  from the team's core roster: primary-position match first, then rating descending (missing
  ratings are neutral, not worst-case — see "Player attribute ratings"), scarcest slots filled
  first.
- Every slot remains individually lockable and coach-overridable
  (`assignPlayerToBestLineupSlot`); a locked slot survives regeneration.
- Best Lineup is per team, not per match — it persists independent of any specific fixture.
  `copyBestLineupToMatch` applies the current Best Lineup to a real match lineup on demand,
  skipping unavailable/inactive players; it does not keep the two in sync afterward.
- Overall rating alone does not implicitly define Best Lineup — position/slot fit is checked
  first, rating only orders players within a fit tier.

Key files: `src/lib/best-lineup/best-lineup.ts` (all generation/assignment/lock/copy logic),
`src/app/(app)/o/[orgSlug]/teams/[teamId]/best-lineup-actions/actions.ts` (server actions),
`src/components/team/best-lineup-tab.tsx` (UI tab on the team workspace).

## Policy-capable selection engine

Matchboard separates deterministic squad/lineup solving from configurable policy evaluation.

### Policy layers

1. **Core invariants** — non-overridable safety rules enforced in TypeScript (`src/lib/policies/core-invariants.ts`). Removed players, inactive players, unavailable players, duplicate lineup assignments — these cannot be overridden by custom policies.
2. **Default Matchboard policy** — standard eligibility, warnings, score adjustments, and explanations (`src/lib/policies/default-matchboard-policy.ts`). Always runs.
3. **Optional custom OPA/Rego policy** — compiled to WebAssembly and evaluated server-side via `@open-policy-agent/opa-wasm`. May make rules stricter, add warnings, adjust scoring, or add explanations. Cannot override core invariants. No OPA server, no sidecar, no runtime Rego compilation, no browser-side evaluation.

### Rego/Wasm policy adapter

Custom policies are written in Rego, compiled to Wasm before deployment, and evaluated inside the Next.js server runtime using `@open-policy-agent/opa-wasm`.

Rego may:
- add blocked player reasons
- add warnings
- add score adjustments (bounded ±20)
- add explanations
- add tags

Rego may not:
- override core invariants
- allow players blocked by core invariants
- mutate data, access the database, access secrets, make network calls, depend on `http.send`, read files, perform side effects, replace squad generation, replace lineup generation, or alter historical snapshots

See `docs/policies.md` and `docs/admin/policy-management.md` for full documentation.

### Integration points

- Event squad generation: pre-filter blocked players, apply score adjustments, surface warnings
- Event helper selection: block overlapping helpers via core invariant
- Event match lineup: filter blocked players, warn on weak position coverage
- League match selection: apply pre/post policy evaluation
- Assistant: surface policy warnings and explanations

### Policy configuration

- `MATCHBOARD_POLICY_REGO_ENABLED` — enable Rego adapter (default: `false`)
- `MATCHBOARD_POLICY_WASM_PATH` — path to compiled Wasm artifact (overrides pack-resolved path when set)
- `MATCHBOARD_POLICY_REGO_FAILURE_MODE` — `fail_closed` (default) or `fail_open`
- `MATCHBOARD_POLICY_PACK_ID` — which policy pack to load (default: `matchboard-default`)

### Policy key files

| File | Purpose |
|------|---------|
| `src/lib/policies/types.ts` | Policy input/result type definitions |
| `src/lib/policies/core-invariants.ts` | Non-overridable core invariant checks |
| `src/lib/policies/build-policy-input.ts` | Build normalized policy input from app data |
| `src/lib/policies/default-matchboard-policy.ts` | Default Matchboard eligibility/warning/scoring policy |
| `src/lib/policies/selection-policy-adapter.ts` | Policy adapter interface, composite pipeline, factory |
| `src/lib/policies/rego-policy-adapter.ts` | OPA/Rego Wasm adapter for custom Rego policies |
| `src/lib/policies/policy-pack.ts` | Policy pack metadata validation, resolution, diagnostics, and artifact hashing |
| `src/lib/policies/policy-evaluation.ts` | Evaluate policy pipeline, filter blocked players, apply score adjustments, coach-facing reason formatting |
| `src/lib/policies/policy-signal-mapper.ts` | Map policy results to plan integrity signals, merge with existing signals |
| `src/lib/policies/policy-version.ts` | Policy artifact hash/version tracking for audit and diagnostics |
| `src/lib/policies/policy-decision-log.ts` | Policy decision summary builder for logging |
| `src/lib/workbench/workbench-types.ts` | Workbench request/result/fixture/diagnostics types |
| `src/lib/workbench/workbench-service.ts` | Workbench service: load fixtures, run policy evaluation, compare default vs Rego |
| `src/lib/workbench/policy-diff.ts` | Diff policy results (default vs Rego), summarize workbench input |
| `src/app/api/workbench/diagnostics/route.ts` | GET workbench diagnostics (policy version, Rego status) |
| `src/app/api/workbench/run/route.ts` | POST workbench dry-run policy evaluation |
| `src/app/api/workbench/fixtures/route.ts` | GET available workbench fixtures |
| `src/app/(app)/workbench/page.tsx` | Workbench UI page |
| `test/fixtures/workbench/*.json` | Workbench fixture data (anonymized) |
| `scripts/workbench-dry-run.mjs` | CLI dry-run script for workbench fixtures |
| `src/app/api/admin/policy/route.ts` | Admin diagnostics: policy runtime, version, Rego status |
| `policies/packs/matchboard-default/` | Default policy pack (primary) |
| `policies/packs/custom-example/` | Example custom policy pack |
| `policies/rego/matchboard_selection.rego` | Legacy Rego policy source (backward-compatible) |
| `policies/rego/matchboard_selection_test.rego` | Legacy Rego policy tests |
| `policies/compiled/matchboard_selection.wasm` | Legacy compiled Wasm artifact (backward-compatible) |
| `scripts/build-opa-policy.mjs` | Build script: compile Rego to Wasm (supports `--pack <id>`) |
| `scripts/policy-dry-run.mjs` | Dry-run utility (supports `--pack <id>`) |
| `scripts/policy-validate.mjs` | Pack metadata and structure validation |
| `scripts/policy-list.mjs` | List discovered policy packs |

Rules: selection rules should go through the policy layer where appropriate. Core invariants remain in app code. Custom policies must not break historical integrity or youth-safe defaults. Never add proprietary policy DSL. Never let Rego override historical integrity or youth-safe defaults. Update policy docs and tests with every policy change. Run policy tests and build before completion.

## Populate all

Populate all is a convenience workflow that generates drafts for all non-finalized rounds in the active league season.

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
 
Primary navigation (5 items, in this order) — the Today/League/Events/Players/More
information architecture from the UI/UX programme (Phase 2.4,
`.matchboard-work/ux-branding-language-ui/PROGRAMME.md` §6, gitignored working bundle):

1. **Today** (`/o/{orgSlug}/today`) — next action, setup progress, blockers, urgent reviews and upcoming work. Canonical operational landing surface; renders the same command-centre content previously called "Assistant" (`getAssistantCommandCentre()`, `AssistantCommandCentrePage`) — the underlying data/component did not change, only its canonical route and nav label.
2. **League** (`/o/{orgSlug}/fixtures`) — the one-stop shop for the period → round → match hierarchy with actions. Primary actions: populate all, generate round, finalize. Each level shows readiness state, plan integrity signal counts, selected player counts. Actions cascade: populate all generates all non-finalized rounds; generate round generates one round; finalize locks selections. League teams (`/o/{orgSlug}/teams`) are reachable via a "League teams" link on this page's header, not their own primary sidebar item.
3. **Events** (`/o/{orgSlug}/events`) — event squads and planning (cups, tournaments, friendly days). See "Event squad planning".
4. **Players** (`/o/{orgSlug}/players`) — season participation, current planning attention, and base-group administration.
5. **More** (`/o/{orgSlug}/more`) — analysis, administration, and secondary destinations: Insights, Season, History, Opponents, Groups, Formations, Rules, Settings, Reviews, and (admin roles only) Simulation and Policy workbench.

The following must not be primary sidebar items — they moved under League or More above:
- `/o/{orgSlug}/teams` (under League, via the League teams link)
- `/o/{orgSlug}/rounds`
- `/o/{orgSlug}/matches`
- `/o/{orgSlug}/season` (under More)
- `/o/{orgSlug}/history` (under More)
- `/o/{orgSlug}/rules` (under More)
- `/o/{orgSlug}/groups` (under More)
- `/o/{orgSlug}/opponents` (under More)
- `/o/{orgSlug}/formations` (under More)
- `/o/{orgSlug}/insights` (under More)
- `/o/{orgSlug}/settings` (under More)
- `/o/{orgSlug}/reviews`, `/o/{orgSlug}/simulation`, `/o/{orgSlug}/workbench` (under More)

These remain accessible through contextually appropriate links, buttons, tabs or secondary navigation — never deleted or made unreachable, and no route that resolved before Phase 2.4 returns a 404 after it.

Other canonical routes:
| Route | Purpose |
|-------|---------|
| `/o/{orgSlug}/rounds` | Rounds — generate, review, finalize per match round |
| `/o/{orgSlug}/rounds/[matchRoundId]` | Round Board |
| `/o/{orgSlug}/season` | Season — player-by-round matrix, movement paths, fairness overview |
| `/o/{orgSlug}/history` | Historical audit of finalized selections and movement |
| `/o/{orgSlug}/rules` | Selection rules, support priority, rotation paths |
| `/o/{orgSlug}/formations` | Formation management — list, filter by game format, create, duplicate, edit, archive |
| `/o/{orgSlug}/formations/new` | Create new custom formation (supports `?gameFormat=X&returnTo=Y`) |
| `/o/{orgSlug}/formations/[formationId]/edit` | Edit custom formation (supports `?returnTo=Y`) |
| `/o/{orgSlug}/workbench` | Policy and generation workbench — dry-run policy evaluation, fixture comparison |
| `/o/{orgSlug}/insights/player-pathways` | Player Pathways — season matrix, context transitions, fairness overview |
| `/o/{orgSlug}/insights/opportunity-quality` | Opportunity Quality (I-002) — factual per-opportunity record |
| `/o/{orgSlug}/insights/opportunity-gap` | Opportunity Gap (I-003) — descriptive planned-vs-realised gap, not a debt score |
| `/o/{orgSlug}/insights/position-exposure` | Position & Formation Exposure (I-004) — planned vs realised positions per player |
| `/o/{orgSlug}/insights/player-combinations` | Player Combinations (I-005) — co-selection/co-appearance frequency |
| `/o/{orgSlug}/insights/continuity` | Continuity vs Exploration (I-006) — round-over-round retained/new players and formation repeats |
| `/o/{orgSlug}/insights/operational-health` | Operational Health (I-007) — 9 grouped concrete facts, no composite score |
| `/o/{orgSlug}/more` | More — hub page linking Insights, Season, History, Opponents, Groups, Formations, Rules, Settings, Reviews (plus Simulation/Workbench for admin roles) |

Setup registry create routes (no top-level nav):
- `/o/{orgSlug}/teams/new` — create team form
- `/o/{orgSlug}/players/new` — create player form
- `/o/{orgSlug}/matches/new` — create match form

Detail routes (no top-level nav):
- `/o/{orgSlug}/players/[playerId]` — player profile
- `/o/{orgSlug}/teams/[teamId]` — team detail workspace
- `/o/{orgSlug}/teams/[teamId]/configuration` — team configuration and rules
- `/o/{orgSlug}/matches/[matchId]` — match detail
- `/o/{orgSlug}/matches/[matchId]/live` — live match reporting
- `/o/{orgSlug}/matches/[matchId]/live/follow` — follow live (read-only viewer)
- `/o/{orgSlug}/matches/[matchId]/handover` — coach handover compact match-operational view

Canonical redirects:
- `/` → `/o/{orgSlug}/today` (resolves orgSlug from session)
- `/assistant` → `/today`; `/o/{orgSlug}/assistant` → `/o/{orgSlug}/today` (deep-link aliases — Today is canonical, Assistant is the historical name, not the other way around)
- `/matches` → `/o/{orgSlug}/fixtures`
- Global routes (`/today`, `/fixtures`, `/teams`, etc.) redirect to `/o/{orgSlug}/` equivalents

No navigation component, page header, CTA or breadcrumb may present `/matches` as a competing top-level destination. Match detail routes such as `/o/{orgSlug}/matches/[matchId]` remain valid.

Active navigation state:
- `/o/{orgSlug}/today` visibly activates Today.
- `/o/{orgSlug}/fixtures` and fixture/round/match/team/season child contexts visibly activate League.
- `/o/{orgSlug}/events` contexts visibly activate Events.
- `/o/{orgSlug}/players` and `/o/{orgSlug}/players/[playerId]` contexts visibly activate Players.
- `/o/{orgSlug}/more` and its linked destinations (insights, opponents, groups, formations, rules, history, reviews, settings, simulation, workbench) visibly activate More.
- Redirected routes do not produce an unselected or misleading sidebar state.

Operational workflow hierarchy:
1. Today identifies the next required action.
2. League provides the season/league-season and round hierarchy.
3. Round Board is the primary squad decision surface.
4. Match detail handles match-specific preparation, finalisation and post-match reporting.
5. Team and Player pages provide supporting context and configuration.
6. More (Season, History, Rules, Insights, Groups, Formations, Opponents, Settings) holds secondary analysis/configuration destinations.

### Setup registries are table-first

Teams, Players, and Matches are setup registries. They serve data-entry efficiency, not football operations workflow. Each registry page is a dense table with prominent Create actions and actionable empty states. Create buttons must never be dead links. Empty states must link directly to creation.

- Teams (`/teams`): dense table of teams with core player count, squad limits, support priority. Links to `/teams/new` for creation. Links to `/teams/[teamId]` for detail. Empty state: "No teams yet. Create a team." with direct link to `/teams/new`.
- Players (`/players`): three-mode surface — Season overview (actual participation and recorded match statistics for a selected league season), Current round attention (canonical live plan-integrity state for a selected round), Manage base groups (stable core-team assignment and player registry administration). Links to `/players/new` for creation. Links to `/players/[playerId]` for full profile. When no teams exist: "Create a team first." with direct link to `/teams/new`. When teams exist but no players: "No players yet. Add a player." with direct link to `/players/new`.
- Fixtures provides match creation and match registry. The `/matches/new` route creates matches assigned to match rounds based on date. Fixtures must not expose a separate fixture-list mental model through a competing `/matches` navigation destination.

Create routes must work reliably. `/teams/new` must save all team fields (not just name and a few fields). `/players/new` must not silently disappear when teams exist. `/matches/new` must assign matches to match rounds based on date.

Round selection (`/rounds`) remains workflow-first. It uses cards, boards, panels, and role buckets — not tables as the primary interaction model.

### Players page modes

`/players` has three internal modes using accessible tabs or segmented navigation:

1. **Season overview** (default) — factual player matrix with actual participation, recorded match statistics, and per-round assignments for a selected league season. Scoped to a visible `League season: {label}`. Statistics use reported or locked post-match data only. Draft selections and finalised unreported assignments do not count as played appearances. The Season overview does not render a summary-statistics panel, summary strip, or Movement paths overview. Factual columns, sorting and explicit filters replace automatic fairness judgement panels or badges.

2. **Current round attention** — canonical live plan-integrity state for a selected round. Scoped to a visible `Round: {label}`. Uses `computeRoundPlanIntegrity` output only. Does not derive attention from season statistics, goals, assists, or historical movement counts.

3. **Manage base groups** — stable core-team assignment and player registry administration. This mode is for team belonging, not weekly match selection, seasonal fairness review, or reported participation analysis. Display: "Base groups define stable team belonging. Match selections and movement are planned in rounds."

Season overview required columns (desktop): Player, Core team, Played, Goals, Assists, Core, Support, Development, Matchday additions, Planned absent.

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

Players overview display rules:

- /players Season overview is a factual player matrix and must not render a summary-statistics panel or Movement paths overview.
- /players must not render automated fairness judgement badges. Factual metrics and explicit filters/sorts are allowed.
- Visible phase labels are derived from startDate and endDate; stored names must not misstate visible time scope.
- The default Season overview table must not show round columns (W18 2026 etc.), Last movement, Review, dropped count/status, or a separate Profile button column.
- Player name must be a focusable link to the full player profile.
- User-facing vocabulary uses League season (not Phase or Planning period) for the bounded spring/autumn operational window.
- User-facing vocabulary uses Season for the broad football-year context.

### Teams page and team detail

The `/teams` page is a selected-league-season completed-results overview. It must not present configuration-first columns.

Required copy: `Teams` heading with subtitle `Results and match record for {leagueSeasonRange}.`

Required selector: `League season: {leagueSeasonLabel}`

Teams overview required columns (desktop, in order): Team, Played, W-D-L, GF, GA, GD, Clean sheets, Core players.

Team result statistics use completed post-match final scores only:
- Final team result derives from `PostMatchReport.homeGoals` and `PostMatchReport.awayGoals` in REPORTED or LOCKED reports.
- Team GF/GA must not be derived from player Goal events.
- DRAFT post-match reports do not become completed result statistics.
- Display-only team statistics must be derived rather than stored unless a later measured performance need justifies persistence.
- Positive GD must show a plus sign.

Team rules, squad limits, support priority and rotation paths belong in team detail/configuration workflows, not in the main overview table.

Teams overview must not show these overview columns: Available, Squad limits, Support priority, Rotation paths.

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
- Movement candidates tab (incoming and outgoing candidates, create/pause/reactivate/delete, drift indicators)
- History tab (finalized rounds for this team)
- Rules/Links tab (rotation paths, config, link to Rules page)

`/teams/[teamId]/configuration` is the team workspace for squad settings and rules:
- Squad settings form: target, min, max squad size and support priority rank (editable)
- Rule list: shows how rules affect this team; global rules are read-only; team-scoped rules have an Edit button that scrolls to the relevant setting
- Configuration edits must persist via server actions, not only client state

### Navigation model

The app shell has three viewport tiers, each rendering the same five primary destinations
(Today, League, Events, Players, More) with the same active-state logic
(`isNavItemActive()` in `src/components/shell/nav-active.ts`, shared across all three so
they cannot silently drift apart):

- **Sidebar** (`SidebarNav`, expanded viewports, ≥840px): full 14rem sidebar, icon + label.
- **Navigation rail** (`NavigationRail`, medium viewports, 600–839px): narrower rail
  (`--rail-width`), icon + short label — not the phone bottom-nav treatment. A tablet-
  portrait viewport must never fall back to the compact/phone nav.
- **Mobile nav** (`MobileNav`, compact viewports, <600px): fixed bottom bar, preserves the
  same five primary destinations, maintains active-state correctness, and ensures blockers
  and primary actions are not hidden behind inaccessible interactions.
- **Top context bar**: provides appropriate title/context for the current route. It must not describe `/today` as "Dashboard". It must not present `/matches` as an independent top-level workflow. It provides context appropriate to the current operational task. When a primary action exists in context, it is clearly prioritised.

Breakpoint tokens (`globals.css`, `@theme`): `--breakpoint-medium: 600px`,
`--breakpoint-expanded: 840px`, `--breakpoint-large: 1200px`, `--breakpoint-xlarge: 1600px`
— deliberately distinct from Tailwind's default `sm`/`md`/`lg`/`xl`/`2xl` so they don't
collide with pre-existing `xl:` usage elsewhere in the app. Compact is the unprefixed base
(<600px); there is no token for it.

Status vocabulary (superseded by ADR-0101 — evidence-driven-coaching-loop programme, explicit maintainer decision): **Not generated, Draft, Blocked, Ready, Finalized** remain the internal selection-planning-completeness vocabulary (round/match plan integrity, override requirements) and the `RoundStatus` enum/type is unchanged. They are no longer the primary label shown for a single match's status. The primary, football-action-oriented match lifecycle status is one of: **Planning open, Planning closed, Live, Played, Report incomplete, Done, Cancelled** (`deriveMatchLifecycleStatus()`, `src/lib/selection/planning-boundary.ts`; `MatchLifecycleBadge`, `src/components/ui/status-badge.tsx`). Report status wins over round-finalization status: a finalized-but-unplayed match shows "Planning closed", never "Done" — finalizing the plan and completing the report are different facts (see the pre-existing "Fixtures result display rules": "Finalized does not mean the match has been played or reported"). Round-level or aggregate contexts (Rounds list, Round Board) may still show Draft/Blocked/Ready/Finalized as a secondary/internal detail alongside the primary lifecycle status, never as the only label.

Warning and signal hierarchy: Blocked conditions must be visually dominant and placed beside the affected round or match. Decision required conditions must be visible without opening hidden technical detail. Planning notes may be progressively disclosed. One primary action must be visually dominant per major workflow context. Draft state and finalised history must never appear visually interchangeable.

User-facing terminology: Use Today (not Dashboard, not Assistant as the primary nav label — "Assistant" remains a valid deep-link alias and historical name), League (not Fixtures as the primary nav label — the `/fixtures` route itself is unchanged), Round Board (not Command center or Decision inbox), Needs Action (not Decision inbox or Decision debt), Squad repair (not Backfill in current user-facing generated movement), Sent as support (not Demoted), Development movement (not Promoted), Not selected this round (not Benched), Short or Below target (not Weak team), League season (not Phase or Planning period), Season (for the broad football-year context). Internal enum BACKFILL remains for backward compatibility but must not appear as current user-facing terminology for generated squad repair.

Season and Phase vocabulary:

- Season is the full football-year context. League season is the bounded spring/autumn operational window (internally a LeagueSeason with LeagueSeasonPart SPRING/FALL).
- User-facing text must use "League season" and "Season", never "Phase" or "Planning period".
- A Phase display must include truthful date-range context (e.g. "Spring 2026 · Apr–Jun") and must not expose misleading single-month labels for multi-month ranges.
- LeagueSeason is the database model. The database model was renamed from PlanningPeriod.

Match schedule editing:

- Unplayed matches (no REPORTED or LOCKED post-match report) can have their date and time edited.
- Date changes must remain within the current league season's date range. Outside-range changes require moving the match to a different league season first.
- Match Round is an ISO-week operational container inside a league season. Match creation and match rescheduling use one shared league-season-scoped target-round resolver.
- An in-range reschedule automatically reuses or creates the target-week round. Normal rescheduling does not require manual destination-round input.
- A matching week round from another league season must never be reused.
- Ambiguous same-range target-round matches must fail safely rather than choose arbitrarily.
- Same-week date/time edits retain the current round. No new round is created.
- Cross-round movement must keep Match, DRAFT Selection and DRAFT MovementLedger references consistent in one transaction.
- Any FINALIZED selection blocks automatic cross-round relocation until explicit unfinalisation.
- A match with a completed post-match report cannot be casually rescheduled. Date correction requires an explicit authorised workflow.
- Successful cross-round moves trigger canonical integrity recalculation for both affected rounds.
- Empty old rounds are not automatically deleted.
- After a schedule change, revalidate /fixtures, /matches/{matchId}, affected round boards, /assistant.

Direct post-match workflow:

- "After match" is a direct reporting workflow. Selecting it must open or create the working report directly.
- When no report exists and a finalised squad exists, the first explicit entry creates a DRAFT report seeded from the planned squad automatically. No separate "Open post-match report" or "Seed from plan" step is required.
- When no report exists and no finalised squad exists, the first entry opens an empty editable report with a contextual note.
- Existing draft reports open directly. Existing completed reports open directly in read-only mode.
- Normal post-match completion uses one visible "Complete report" action, not separate Submit plus Lock steps.
- "Complete report" validates all required inputs and transitions the report to the final completed state (LOCKED).
- The REPORTED status remains in the schema for backward compatibility but is not a routine user-facing workflow step.
- Legacy completed records (REPORTED, LOCKED) remain included in statistics and results.

Post-match feedback eligibility:

- Post-match feedback player selection must be derived from actual participants with attendanceStatus = PRESENT, not from the planned squad.
- Manually added matchday participants who are PRESENT must appear in the feedback selector.
- Players recorded as "Did not play", removed from actual participation, or with UNKNOWN attendance must not appear.
- When a coach removes a player from actual participation who has draft feedback, the app must either require confirmation or remove the feedback transactionally. Feedback must not remain attached to a non-participant.

Fixture result styling:

- Completed fixtures may use soft colour treatment to support rapid scanning: soft green for Won, soft neutral/slate for Drawn, soft red for Lost.
- Outcome text ("Won", "Drawn", "Lost") must always be visible. Colour is secondary reinforcement only, never the sole signal.
- No styling must be applied to upcoming matches, DRAFT reports, or report-incomplete tasks.
- Use existing design tokens or conventional Tailwind semantic classes. Avoid saturated colours.

Navigation shell branding:

- The navigation shell shows a compact football-oriented Matchboard identity mark in the top-left.
- Mark uses a local SVG or existing icon library, never remote assets or unlicensed imagery.
- Decorative icons use aria-hidden="true" when accompanying visible text.
- "Matchboard" and "Squad planning" text remain as the accessible product labels.

Fixtures result display rules:
- /fixtures shows completed final score and W/D/L outcome directly in fixture rows/cards.
- A DRAFT post-match report is incomplete work and never a final displayed result.
- Final score and outcome are shown for REPORTED and LOCKED post-match reports only.
- Completed fixtures show FT marker, final score, and Won/Drawn/Lost outcome from the Matchboard team's perspective.
- Completed Won fixtures may use soft green visual treatment. Completed Drawn fixtures may use soft neutral/slate treatment. Completed Lost fixtures may use soft red treatment. Outcome text must remain visible. Colour is secondary reinforcement only.
- Past matches with DRAFT reports show "Report incomplete" with an action to complete the report rather than a draft score.
- Future matches without completed reports retain planning-state presentation with no result placeholders.
- Planning state (Not generated, Draft, Blocked, Ready, Finalized) and result state are not confused. "Finalized" does not mean the match has been played or reported.
- No outcome styling must be applied to upcoming matches, DRAFT reports, or report-incomplete tasks.

### Auth layout rules

- Auth routes (`/auth/signin`, `/auth/error`) must use a public auth layout, never the protected app layout
- Sign-in and access-denied pages must not show sidebar, top bar, coach data, team data, player data, match data, or round data
- Protected app shell (sidebar, top bar, user nav) only renders after authenticated membership access
- Auth pages must use the Matchboard dark theme but without protected navigation
- Root layout must contain only HTML/body/font wrappers — no protected shell components
- Protected shell (sidebar, top bar, user nav) lives in `(app)/layout.tsx`, not in root layout
- `(app)/layout.tsx` must never `redirect()` to another route inside the same `(app)` group when
  no single organisation resolves (`getOrgSlugForUser()` returns `null` for zero eligible
  memberships, more than one eligible membership, or a suspended/expired membership) — `/organisations`
  and `/invite/[token]` live inside `(app)` and must stay reachable in that state, or the
  redirect loops forever (see issue #296 / the regression test in `src/test/security-audit.test.ts`).
  Instead the layout renders a minimal header-only shell (no sidebar, no org context) around
  `children` and lets the page handle its own auth/redirect. `resolveOrgSlugForLayout()` (which
  does redirect to `/organisations`) remains correct for pages that explicitly want that
  behavior (`(app)/page.tsx`, `(app)/assistant/page.tsx`, `redirect-to-org.ts`) — it is a
  deliberate per-page choice, never something the shared layout should do unconditionally.
- Every other page/action under `(app)` (not the layout, not the two canonical entry points
  above) achieves the same graceful redirect by calling `requirePageActorContext()` instead of
  `requireActorContext()` — see "Auth rules" below and ADR-0082.

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

- Header: "Season" with subtitle "Track load, movement, and fairness across the league season."
- Controls: league season selector, finalized/draft toggle, filters
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

API endpoint: `/api/season/export?leagueSeasonId=<id>&format=<csv|json|txt|md>&visibility=<coach|parent>`

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

### Rounds list page scope

`/o/{orgSlug}/rounds` defaults to the active league season's rounds only, not every round the
organisation has ever had — matching the same per-league-season default already used by `/players`
and `/fixtures`. This page is the coach's active planning workflow (generate/review/finalize per
round), not a historical archive; `/history` already serves that. `resolveActiveLeagueSeason()`
(`src/app/(app)/o/[orgSlug]/rounds/build-round-item.ts`) picks the season containing "now", falling
back to the most recently started season within a ~90-day plausibility window (excluding
implausibly-far-future seasons, which only ever arise from generated/test data) when none spans
"now", and only the absolute most-recent-by-start-date when every season is implausibly far out.
The window must stay well under 420 days — `e2e/helpers/live-match-fixtures.ts`'s
`randomFutureMatchDate()` spreads test matches 60-5060 weeks (~420 days minimum) out, and an
earlier, wider ~2-year window let some of that random spread land inside the "plausible" bucket
and wrongly outrank this repo's own real seed-dataset season, confirmed live in CI:
`round-mutation.spec.ts`'s target round disappeared from this page entirely.
An earlier unbounded, unscoped version of this query rendered every round the organisation had
ever accumulated on one page with no pagination — confirmed live in CI causing real page-load
slowness and intermittent E2E failures once round-count reached the low hundreds.

### Round status model (5 states)

| Status | Meaning |
|--------|---------|
| NOT_GENERATED | No selections yet |
| DRAFT | Selections generated, not finalized |
| BLOCKED | Draft with Blocked conditions |
| READY | Draft with no blockers |
| FINALIZED | Locked history |

### Round progress (aggregate, not a per-match replacement)

`src/lib/rounds/round-progress.ts`'s `deriveRoundProgress()` computes a round-level aggregate fact — whether the round's matches have actually been played and reported yet. Stages: Planning, Partially played, All matches played, Reporting, Complete (derived from each non-cancelled match's played-date and post-match report status). A round aggregates multiple matches that can each be at a different lifecycle stage, so this remains a distinct, coarser summary alongside the round status above. For a single match, use the primary lifecycle status (`deriveMatchLifecycleStatus()`) described under "Status vocabulary" above instead — see ADR-0100 (round progress) and ADR-0101 (match lifecycle status supersession).

### Match status model (2 states)

| Status | Meaning |
|--------|---------|
| SCHEDULED | Normal match, available for planning |
| CANCELLED | Match did not happen, bypasses post-match reporting and statistics |

Cancelled match rules:
- Cancelled matches are excluded from draft generation, plan integrity computation, and finalization
- Cancelled matches do not require post-match reports
- Cancelled matches do not count as played appearances in season statistics
- Cancelled matches display a "Cancelled" pill on the Fixtures page and match detail
- Planned selections for cancelled matches are preserved as context but excluded from stats
- Matches with a completed (REPORTED or LOCKED) post-match report cannot be cancelled
- Reopening a cancelled match clears the cancelledAt timestamp and cancelledReason, restoring SCHEDULED status
- The SelectionRole enum retains BACKFILL for backward compatibility; new generation never produces BACKFILL as a user-facing role (squad repair uses role=SUPPORT with an explanation code)

### PWA (installable app)

Matchboard is installable as a Progressive Web App. Scope is deliberately v1-only:

- `src/app/manifest.ts` — dynamic manifest (Next.js `MetadataRoute.Manifest`), branches on
  request hostname (`test.` prefix vs. everything else), not on a Vercel project-ID env var.
  Produces a visually distinct `name`/`short_name` ("Matchboard Test" vs. "Matchboard") so the
  installed Test app is never mistaken for Production. `start_url` is `/today` (the canonical
  landing route). Shortcuts: Today, League, Events (max 3). Supersedes the old static
  `public/brand/site.webmanifest`, which has been removed — do not reintroduce a static manifest
  reference in root `layout.tsx`'s metadata; it would compete with the dynamic route.
- An in-app "Test" badge renders in the top header on any `test.` hostname
  (`(app)/layout.tsx`'s `TestEnvironmentBadge`) — a second, code-level safeguard against
  mistaking installed Test for Production, independent of the home-screen icon.
- "Install Matchboard" (`src/components/pwa/install-prompt-card.tsx`, `InstallPwaCard`) is
  visible to any authenticated coach (not gated to Owner/Admin, unlike Settings) in two places:
  - **More page** (`src/app/(app)/o/[orgSlug]/more/page.tsx`) — always present, non-dismissible.
  - **Today page** (`AssistantCommandCentrePage`, the canonical `/today` landing surface) —
    rendered with `dismissible` so it surfaces the install path from the first visit (the
    intended signup → visit → install flow) without permanently occupying the primary daily
    landing page. Dismissal is a client-only `localStorage` preference
    (`matchboard:pwa-install-dismissed`), not a server-side/per-user setting — no schema change.
    The More instance is unaffected by dismissal; it's a separate, always-present entry point.
  - Platform-aware, and — as of 2026-08-22 — never renders nothing: captures
    `beforeinstallprompt` for Android/Chromium when the browser's own engagement heuristic allows
    it (there is no API to force this early; that heuristic is a hard browser-vendor policy, not
    something the app can bypass); shows static "tap Share → Add to Home Screen" instructions on
    iOS (no programmatic install API exists there); shows an "installed" state when already
    running in standalone mode (More instance only — the dismissible Today instance renders
    nothing once installed, since there's nothing actionable left for a daily-landing banner);
    and — new — shows generic "open your browser menu → Install app / Add to Home screen"
    instructions for every other case (desktop Chromium, or Android/Chromium before the
    engagement heuristic has allowed the native prompt), rather than the previous silent gap.

Explicitly out of scope for v1 — do not add without a new decision:
- Service worker / offline caching.
- Custom Web Push.
- App-store packaging of any kind.

Maintainer decisions on the two v1 open items (2026-08-22):
- **Maskable icon**: the existing `android-chrome-192x192.png`/`512x512.png` are declared
  `purpose: "maskable"` in the manifest, reusing the existing asset rather than commissioning a
  new safe-zoned variant — their full-bleed background already has the right structural shape.
  No new asset was created.
- **Test-marker home-screen icon**: deliberately not added for v1. The manifest's distinct
  `name`/`short_name` ("Matchboard Test") plus the in-app Test badge are the distinguishing
  signals instead. Revisit only if a real design need surfaces later — this is not tracked as
  outstanding work.

## Event squad planning

Matchboard supports temporary event squad planning for cups, tournaments, friendly days, and similar events. Event squads are separate from league match-round planning.

### Product language

| Concept | Use | Never use |
|---------|-----|-----------|
| Cup/tournament/friendly-day context | Event | Tournament mode, Cup mode |
| Temporary squad | Event squad | Temporary team, Scratch team |
| Strongest squad built from formation needs | Competitive squad | Topped team, A team, Best team |
| Remaining players distributed deliberately | Balanced remainder | Leftover players, B team, Second string |
| Player with null ratings | Not rated | Unrated, Default max, Zero skill |
| Event-specific availability | Event availability | (reuses existing availability statuses with event-specific context) |

### Integration boundaries

Event squad generation is separate from league round generation:
- Does not create `Selection` rows
- Does not create `MatchRound` rows
- Does not write to normal `Availability`
- Does not affect league fairness metrics unless explicitly added later
- Does not mutate finalized match history
- May READ existing players, player attributes, positions, formations, and readiness for context
- Event squad assignments do not count as league appearances

### Event models

Events use separate Prisma models:
- `Event`: top-level container with name, type (CUP/TOURNAMENT/FRIENDLY_DAY/OTHER), date range, game format, independent of league season, default formation, selection pattern
- `EventPlayerAvailability`: per-player availability for this event (AVAILABLE/UNAVAILABLE/UNKNOWN/RESERVE/LATE_ADDITION/WITHDRAWN)
- `EventSquad`: named squad within an event with intent (COMPETITIVE/BALANCED/MANUAL), target/min/max sizes, formation override, generation order, balance summary, status (DRAFT/LOCKED)
- `EventSquadPlayer`: player assignment with role type, position, source (AUTO/MANUAL/LOCKED), locked flag, selection reason, unique on [eventId, playerId] (one player per event across all squads)
- `EventMatchLineup`: per-match lineup with formation reference, status (DRAFT/CONFIRMED), cascade delete with EventMatch
- `EventMatchLineupAssignment`: per-slot player assignment within a lineup, with slot position (slotId, slotIndex, slotLabel, roleType, x, y), source (BASE_SQUAD/HELPER), unique on [lineupId, playerId]

Event squads are NOT normal `Team` rows. They are temporary event artifacts with no league identity.

### Mixed game formats inside one Event

Normal case: every squad in an Event shares the Event's default game format. Rare case: one Event
contains squads of different formats (e.g. two 7v7 teams and one 9v9 team on the same event day).

- `EventSquad.gameFormatOverride` (`GameFormat?`, nullable) — `null` means the squad inherits
  `Event.gameFormat`; a set value overrides it for that squad only.
- `getEffectiveEventTeamGameFormat(event, squad)` (`src/lib/events/event-types.ts`) is the single
  centralized resolver: `squad.gameFormatOverride ?? event.gameFormat`. Every downstream consumer
  (squad generation, formation lookup, lineup formation selection, live reporting, post-match
  reporting) must call this or use a value already derived from it — never re-derive the fallback
  inline or read `event.gameFormat` directly when a squad is in scope.
- `EventSquad.formationId` (`String?`, nullable) is the equivalent per-squad override for
  formation, resolved through the equally centralized `getEffectiveEventSquadFormationId(event,
  squad)`: `squad.formationId ?? event.defaultFormationId`. This matters most when a squad's
  effective game format differs from the Event default (a 9v9 squad needs its own formation, not
  the 7v7 default) — every downstream consumer (squad generation's `getFormationForSquad`,
  per-match lineup creation/defaulting in `event-lineup-actions.ts`/`event-match-lineup-panel.tsx`,
  the event detail page's formation display) must call this resolver rather than re-deriving the
  fallback inline; this consolidation replaced three previously-inconsistent copies of the same
  logic. UI: a per-squad "Formation" selector next to "Game format" on the Squads tab, filtered to
  formations matching that squad's *effective* game format (`data.compatibleFormations`, which
  itself now covers every distinct effective format used across the event's squads, not only the
  Event default).
- `EventSquad.targetSize`/`minSize`/`maxSize` are, and always were, genuine per-squad columns —
  target squad size may already differ from team to team within one event. The create-event form
  only ever applied one shared `targetSize` to every squad created at event creation time; the gap
  was the missing UI to adjust it per squad afterward. The Squads tab's player-count display
  (`{count}/{targetSize}`) is now click-to-edit, calling `updateEventSquadAction({ targetSize })`,
  matching the existing squad-name click-to-edit pattern.
- `generateEventSquadsAction` groups squads by effective format and runs the generation engine
  once per format group (players assigned in one group are removed from the pool before the next
  group runs), so the normal single-format case still degenerates to exactly one call with
  unchanged behavior.
- UI: each squad on the Squads tab has a "Game format" selector ("Event default (7v7)" or an
  explicit override) next to its name, using `updateEventSquadAction`'s `gameFormatOverride` field.
  There is no separate squad-settings panel — this reuses the existing inline per-squad edit area.
- Per-match lineup formation selection (`EventMatchLineupPanel` via `EventMatchCard`) and live
  match reporting (`getEventLiveMatchPreMatchPackageAction`) both resolve the match's own squad's
  effective format, not the Event default.
- Removing an override (selecting "Event default") restores inheritance; changing the Event's own
  default format changes every squad that has no override, without touching overridden squads.

### Event match halves and per-squad match timing

`Event.numberOfHalves` (`Int`, default `1`) — 1 (single continuous "Match" period, the original
behavior) or 2 (First half/Half time/Second half, mirroring League's regulation-time period
model). Event-level default, with an optional per-squad override (see below) — a cup's halves
format is normally a property of the competition, but different squads inside one event can play
genuinely different formats with different halves/duration/break (e.g. a 7v7 squad playing 2×17
with a 1 minute break alongside a 9v9 squad playing 2×20 with a 1 minute break, on the same event
day).

- `Event.matchDurationMinutes` means **the duration of ONE half**. For the default
  `numberOfHalves=1` that is trivially the whole match, so existing 1-half events see no
  behaviour change from this field's original meaning.
- `Event.breakDurationMinutes` (`Int?`, nullable) — minutes of break between halves, only
  meaningful when the effective `numberOfHalves` is 2 (ignored otherwise). `null`/unset is treated
  the same as 0 for match-length purposes (break length not tracked), matching the pre-existing
  "half-time break length isn't tracked separately" estimate exactly when unset.
- `EventSquad.numberOfHalvesOverride`/`matchDurationMinutesOverride`/`breakDurationMinutesOverride`
  (all `Int?`, nullable) are per-squad overrides following the exact same pattern as
  `gameFormatOverride`: `null` inherits the Event default, a set value overrides it for that squad
  only. Resolved through `getEffectiveEventSquadNumberOfHalves()`/
  `getEffectiveEventSquadMatchDurationMinutes()`/`getEffectiveEventSquadBreakDurationMinutes()`, or
  all three at once via `getEffectiveEventSquadMatchTiming()` (`src/lib/events/event-types.ts`) —
  never re-derive the `?? event.X` fallback inline.
- `getEventPeriodConfig(matchDurationMinutes, numberOfHalves, breakDurationMinutes?)`
  (`src/lib/live-match/period-config.ts`) is the single place branching on halves count for live
  reporting — `numberOfHalves=2` applies `matchDurationMinutes` to *each* half individually, not
  split across the match, and gives the `HALF_TIME` period a real `durationMs` when
  `breakDurationMinutes` is set (previously always `null`/undurated). Reuses the same `MatchPeriod`
  enum keys League's regulation-time config uses (`FIRST_HALF`/`HALF_TIME`/`SECOND_HALF`/
  `FULL_TIME`), so `LiveMatchClient` needs no changes to consume either shape.
- `getEventMatchWindow(match, matchDurationMinutes, numberOfHalves, breakDurationMinutes?)`
  (`src/lib/events/event-match-time.ts`) computes the full match window as
  `numberOfHalves × matchDurationMinutes + (numberOfHalves - 1) × breakDurationMinutes` (break
  term is 0 when `numberOfHalves=1` or `breakDurationMinutes` is null/unset) for helper-overlap
  detection.
- Helper-overlap detection is resolved **per match's own squad**, not from one event-wide value:
  `getSupportCandidatesForEventMatch()`/`checkSupportConflicts()`
  (`src/lib/events/event-match-support.ts`) take a `timingBySquadId: Map<string,
  EventSquadMatchTiming>` (one entry per squad, built via `getEffectiveEventSquadMatchTiming()`)
  instead of a single flat `matchDurationMinutes`/`numberOfHalves` pair, and the shared
  `resolveMatchWindow(match, timingBySquadId)` helper resolves each match's window using its own
  `eventSquadId`'s effective timing. A match whose squad has no resolvable duration is excluded
  from overlap consideration entirely rather than treated as zero-length. All three call sites in
  `event-support-actions.ts`, plus the Excel export's Match call-out/Conflicts sheets
  (`[eventId]/export/route.ts`), build this same per-squad map — never a single event-level
  duration applied uniformly across squads with different effective formats.
- UI: "Halves" (a 1/2 select, next to "Match duration"/"Half duration" — the label switches
  dynamically) and "Break between halves" (shown only when halves=2) on the create-event form
  (`create-event-form.tsx`) and the event detail overview's inline edit (`event-detail.tsx`,
  `updateEventNumberOfHalvesAction`/`updateEventMatchDurationAction`/
  `updateEventBreakDurationAction`) set the Event-level defaults. Per-squad overrides for halves,
  match/half duration, and break duration live on the Squads tab next to the Game format/Formation
  selectors, via `updateEventSquadAction`'s `numberOfHalvesOverride`/
  `matchDurationMinutesOverride`/`breakDurationMinutesOverride` fields (blank input clears the
  override back to inheriting the Event default).

### Event squad draft/commit lifecycle

Event squads have a status field: DRAFT or LOCKED.

- Generated squads start as DRAFT
- The coach reviews DRAFT squads, may make manual adjustments
- When satisfied, the coach locks squads via `confirmEventSquadsAction`, which runs validation first
- Validation checks: no duplicate players across squads, no unavailable players in squads, minimum size, goalkeeper coverage
- Blocking issues prevent locking; warning and info issues do not
- Locked squads can be unlocked back to DRAFT via `unconfirmEventSquadsAction`
- The Assistant surfaces `event_squads_ready` work items when all event squads are DRAFT
- Aggregate status (DRAFT/LOCKED/MIXED) is available via `getEventSquadsStatusAction`
- Review is optional and advisory via `ReviewRequest` — locking does not require review

### Policy decision types

The policy pipeline uses context-aware decision types to branch policy behavior by mode:

- `league_match_selection` — per-match selection in league rounds
- `league_round_fairness` — round-level fairness adjustments
- `event_squad_generation` — event squad construction
- `event_helper_selection` — event match support helpers
- `event_lineup_planning` — event match lineup
- `post_match_report_availability` — post-match report availability checks

Fairness scope values: `match`, `round`, `period`, `season`, `event`, `event_match`.

League mode applies fairness score adjustments (low recent/period/season match count). Event mode does NOT apply fairness adjustments — event fairness is construction feasibility, not longitudinal load balancing.

### Player attribute ratings

Player attributes are coach-facing internal planning context.

Rules:
- Null means "Not rated" — never display as 0 or max skill
- Ratings use a 1–10 scale: 2 = needs support, 4 = developing, 6 = steady, 8 = strong, 10 = standout in this group
- Ratings are relative to the cohort, not absolute scouting scores
- Goals, assists, and post-match stats must never directly become skill ratings
- Ratings must not appear in parent-facing exports
- Missing ratings are treated as uncertainty, not low ability or high ability
- Where a rating must become a plain number for sorting/scoring (rather than being excluded from
  an average, which is preferred where possible), fall back to `NEUTRAL_UNRATED_RATING`
  (`src/lib/ratings/player-rating.ts`), never to 0 — 0 makes an unrated player rank below every
  rated player, including a genuine 1/10, which contradicts "treated as uncertainty" above
  (Phase 9 audit §63)

Composite attributes for event generation:
- `overallLevel`: average of all non-null attributes, or null
- `defending`: average of `oneVOneDefending` + `positioning`, or null
- `attacking`: average of `oneVOneAttacking` + `ballControl`, or null
- `gameUnderstanding`: average of `decisionMaking` + `positioning`, or null
- `intensity`: average of `effort` + `concentration`, or null
- `teamplay`: direct value, or null
- `goalkeeperAbility`: enum field (NO/EMERGENCY/YES), not a numeric rating

Schema: Player numeric attribute fields are `Int?` (nullable). `goalkeeperAbility` enum field and `lastRatedAt DateTime?`. Server-side validation: null or integer 1–10 only. Existing 0 values are migrated to null (Not rated). Previous 1–5 values are migrated by ×2.

### Event availability

Only AVAILABLE players are included by default. RESERVE and LATE_ADDITION are included only when the coach explicitly enables them. UNAVAILABLE, UNKNOWN, and WITHDRAWN are excluded.

Before generation, show event pool validation:
- Number of available players
- Target squad count and target size
- Missing ratings count
- Goalkeeper coverage
- Defensive/central/attacking coverage based on selected tactic/formation
- Warnings/notes when the plan is structurally weak

### Formation/tactic selection

Events reuse existing formation infrastructure (Formation, FormationSlot, FormationSlotRoleType, acceptedPositionIds, Player.primaryPosition/secondaryPosition/tertiaryPosition).

- Event has optional default formation
- Each EventSquad may override the default formation
- Generation fills formation slot requirements first (goalkeeper, defender, midfielder, forward), then optimizes for balance or competitiveness
- If no formation is selected, fall back to a role template based on GameFormat
- UI must make the formation/tactic clear for each squad

Role fallback by game format:
- 3v3: no goalkeeper requirement unless formation says otherwise; balance defensive/central/attacking/flexible
- 5v5: goalkeeper if formation requires it; otherwise at least one defensive and one attacking player
- 7v7: goalkeeper, defensive, central, attacking, flexible
- 9v9/11v11: goalkeeper, defensive line, central/midfield, attacking line, flexible/bench

### Squad generation modes

Generation logic lives in `src/lib/events/event-squad-generation.ts`. Keep pure selection logic testable and separate from server actions.

Mode A — ALL_BALANCED: Distribute all players evenly across squads. Balance by total/average skill, skill band spread, goalkeeper coverage, tactic/formation slot coverage, position fit. Avoid one squad getting all high-rated or all unrated players.

Mode B — ONE_COMPETITIVE_BALANCED_REMAINDER: Build one competitive squad first by filling formation/role needs, then distributing remaining players through the balanced algorithm. The competitive squad must NOT be a simple top-N-by-overall ranking. It must be built from formation/role needs first. Remaining squads are balanced against each other, not against the competitive squad.

Competitive scoring weights: position/formation fit (high), overall level (medium/high), defending/attacking depending on slot (high), game understanding/decision making (medium/high), effort/intensity (medium), teamplay (medium). Missing ratings: neutral with uncertainty penalty, not zero ability.

Mode C — MANUAL_SEED_AUTO_BALANCE: Coach locks players to squads. Generator distributes unlocked players around anchors. Locked assignments are preserved on regeneration. Regenerate unlocks only unlocked assignments.

### Manual override and regeneration

- Coach can manually move players between event squads
- Coach can lock assignments
- Coach can clear generated event squads
- Coach can regenerate all unlocked assignments
- Coach can regenerate one squad or the balanced remainder
- Manual changes recalculate balance summaries and notes
- Structural issues produce planning notes (not Blocked conditions):
  - Squad has no goalkeeper-capable player
  - Squad lacks defensive coverage
  - Selected formation has uncovered slot types
  - Large skill imbalance between balanced remainder squads
  - Many unrated players make balance uncertain

### Explainability

Every EventSquadPlayer has a selection reason. Examples:
- "Selected for goalkeeper coverage"
- "Selected as defensive fit for selected formation"
- "Selected to balance remaining squads"
- "Selected as flexible player after core tactical roles were covered"
- "Kept because assignment was locked by coach"
- "Rating uncertainty: player has missing attributes"

Disallowed language: weak player, bad player, low quality, leftover, not good enough, punishment, B team player.

### Event match support planning

Matchboard supports temporary player help between event squads based on match timing overlap.

Rules:
- A player can only help another squad when their own squad is not playing at the same time
- Time overlap uses event match duration: `a.startsAt < b.endsAt && b.startsAt < a.endsAt`
- Exact boundary times do NOT overlap (e.g., 10:00-10:20 and 10:20-10:40)
- Cancelled matches do NOT block player availability
- Players marked UNAVAILABLE or WITHDRAWN for the event cannot be helpers
- A player cannot be assigned as support for their own squad's match
- Duplicate support assignments (same player, same match) are rejected
- Support assignments are persisted in EventMatchSupportAssignment (unique on [eventMatchId, playerId])
- Planned role is optional: GK cover, Defender cover, Midfield cover, Forward cover, General cover
- Conflict detection runs at query time, not stored — when match times or player availability change, conflicts are recomputed dynamically
- Conflict reasons: own squad overlapping, already helping another overlapping match, player removed from source squad, player unavailable, match cancelled, duration not set
- Support assignments appear in post-match reports with "Planned helper from {squad name}" role label
- Match duration is editable on the event detail overview via inline edit
- Match duration must be set before support planning is available

### Event routes and navigation

- `/events` — event list page, now a primary sidebar destination (Today/League/Events/Players/More, Phase 2.4)
- `/events/new` — create event
- `/events/[eventId]` — event detail/planning page
- `/events/[eventId]/export` — GET route: Excel workbook export (Squads, Match call-out, optional Conflicts sheets)

### Key engine files

| File | Purpose |
|------|---------|
| `src/lib/events/event-squad-generation.ts` | Event squad generation engine (all modes) |
| `src/lib/events/event-types.ts` | TypeScript types for event squad generation; `getEffectiveEventTeamGameFormat()` centralized per-squad effective format resolver |
| `src/lib/events/event-validation.ts` | Event pool validation and pre-generation checks |
| `src/lib/events/event-balance.ts` | Balance summary calculation |
| `src/lib/events/event-match-eligibility.ts` | Canonical eligibility service: `getEligibleEventMatchPlayers()`, `assertEligibleEventMatchPlayer()` |
| `src/lib/events/event-match-time.ts` | Event match time window calculation, overlap detection, support availability |
| `src/lib/events/event-match-support.ts` | Event match support candidate logic, conflict detection |
| `src/lib/formatters/game-format.ts` | Human-readable game format labels (3-a-side, 5-a-side, etc.) |
| `src/app/(app)/events/actions.ts` | Server actions: pool management, squad assignment, generation |
| `src/app/(app)/events/event-match-actions.ts` | Server actions: event match CRUD, edit, cancel, reopen |
| `src/app/(app)/events/event-support-actions.ts` | Server actions: support assignment add/remove/update, conflict-enriched list, candidate eligibility query |
| `src/app/(app)/events/event-squad-commit-actions.ts` | Server actions: squad validation, lock, unlock, aggregate status |
| `src/app/(app)/events/page.tsx` | Event list page |
| `src/app/(app)/events/new/page.tsx` | Create event |
| `src/app/(app)/events/[eventId]/page.tsx` | Event detail/planning |
| `src/app/(app)/events/[eventId]/event-detail.tsx` | Event detail client component (tabs: overview, squads, player pool) |
| `src/app/(app)/events/[eventId]/event-matches-tab.tsx` | Matches tab with per-match helper controls, support load summary, lineup, and post-match reporting |
| `src/app/(app)/events/[eventId]/event-match-report-panel.tsx` | Post-match report panel for event matches — uses the shared `PostMatchReportShell` (ARR-0034) for status/lifecycle/result/goals/assists/attendance; renders team reflection, opponent observation, notes, football observations, and combination evidence as its own `extraSections` |
| `src/lib/reports/post-match-report-view-model.ts` | Canonical `PostMatchReportViewModel`/`PostMatchReportActions`/`PostMatchReportCapabilities` types shared by League and Event post-match report UIs (ARR-0034) |
| `src/components/matches/post-match-report-shell.tsx` | Shared post-match report shell component: status/lifecycle actions, result, goals, assists, attendance (with add/remove) — used by both `src/components/assistant/post-match-page.tsx` (League) and `event-match-report-panel.tsx` (Event) |
| `src/app/(app)/events/[eventId]/event-lineup-actions.ts` | Server actions: event match lineup CRUD, auto-fill, formation change |
| `src/app/(app)/events/[eventId]/event-match-lineup-panel.tsx` | Event match lineup panel with formation selector, dropdown-per-slot assignment, auto-fill |
| `src/lib/formatters/event-labels.ts` | Human-readable event type, squad intent, player status, match status, goalkeeper ability labels |
| `src/lib/formatters/event-export-filename.ts` | Safe event export filename generation |
| `src/app/(app)/events/[eventId]/export/route.ts` | GET route: Excel workbook export with Squads, Match call-out, and optional Conflicts sheets |

### Planned rotation engine files

| File | Purpose |
|------|---------|
| `src/lib/planned-rotation/planned-rotation.ts` | Planned rotation domain service: CRUD, structured validation (PlannedRotationValidationIssue), lineup projection, minutes projection, coverage checking (`checkPlannedRotationCoverage`) |
| `src/app/(app)/matches/planned-rotation-actions.ts` | Server actions: create, update, delete, get, validate planned rotation; `checkPlannedRotationCoverageAction` (starters read from the team's current match line-up, never fabricated from the full squad) plus its planned partnership evidence |
| `src/app/(app)/matches/lineup-combination-evidence-actions.ts` | Server action: season partnership evidence relevant to a specific set of planned-together players — shared by the Tactics and Rotations tabs |
| `src/components/matches/planned-partnership-evidence.tsx` | Presentational: factual season partnership evidence list, shared by the Tactics and Rotations tabs |
| `src/app/(app)/matches/planned-rotation-live-actions.ts` | Server actions: apply (writes real actual-timeline events server-side), skip, delay, modify planned change during live match |
| `src/app/(app)/o/[orgSlug]/matches/[matchId]/handover/page.tsx` | Coach handover: compact match-operational view for mobile matchday use |
| `src/components/matches/coach-handover-view.tsx` | Coach handover client component: squad, rotations, intent, warnings |
| `src/lib/planned-rotation/planned-rotation-live-bridge.ts` | Plan-to-live bridge: apply/skip/delay/modify planned changes (DELAYED is re-visitable, not terminal), next change lookup |
| `src/lib/evidence/actual-timeline.ts` | Canonical actual position timeline: `rebuildActualTimeline()`, line/lane classification, interval queries |
| `src/lib/evidence/lineup-state.ts` | Pure position-interval computation from starters/rotations/position-changes (used by actual-timeline.ts) |
| `src/lib/planned-rotation/rotation-vs-actual.ts` | Rotation vs actual comparison: per-change deviation, minute deviation, unplanned substitutions |
| `src/lib/planned-rotation/development-thread.ts` | Development thread domain service (CRUD, lifecycle, observations) |
| `src/lib/coaching/development-thread-categories.ts` | Shared development focus categories and labels (client/server) |
| `src/components/matches/planned-rotation-panel.tsx` | UI: rotation plan panel on match detail (Rotations tab) |

### Team composition engine files

| File | Purpose |
|------|---------|
| `src/domain/team-composition/team-composition-types.ts` | Shared contract: TeamCompositionProblem, TeamCompositionProposal, CompositionPlayer, RoleSuitabilityProfile, all scenario/metric/validation types |
| `src/domain/team-composition/position-suitability.ts` | Position mapping, fit tiers, role-relevant strength, scarcity, deterministic sorting |
| `src/domain/team-composition/structural-requirements.ts` | Fallback formation structures per game format, slot requirements |
| `src/domain/team-composition/scenario-catalogue.ts` | Four system scenarios (PRESERVE_AND_REPAIR, BALANCED, ONE_STRONG_REST_BALANCED, TIERED_DESCENDING) with versioned definitions |
| `src/domain/team-composition/proposal-validation.ts` | Hard constraint validation, team metrics, proposal metrics, explanation generation, input fingerprinting |
| `src/domain/team-composition/deterministic-team-composer.ts` | 6-phase composition engine (normalize → scarce roles → spine → scenario distribution → fill → improve) |
| `src/domain/team-composition/league-team-adapter.ts` | Application service: data loading, policy checks, proposal generation, transactional apply, decision recording |
| `src/domain/team-composition/index.ts` | Barrel exports |
| `src/lib/policies/composition-policy.ts` | Pre-generation scenario permission check (TIERED_DESCENDING policy gate) and post-generation structural validation |
| `src/app/(app)/o/[orgSlug]/teams/team-composition-actions.ts` | Server actions: generateLeagueTeamPreviewAction, applyLeagueTeamProposalAction |
| `src/app/(app)/o/[orgSlug]/groups/group-composition-actions.ts` | Server action: getGroupCompositionData (group, teams, players, league seasons) |
| `src/components/team/team-composition-panel.tsx` | UI: scenario selector, proposal preview, apply flow, policy acknowledgement |

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
- support priority ordering when a higher-priority team has no valid rotation path (falls
  back to self-squad-repair and/or a documented signal, never silently drops the requirement
  or lets an invalid path block a lower-priority team that does have one)
- cancelled fixture handling (excluded from draft generation and plan integrity computation)
- non-rotatable exclusion from generic backfill
- plan integrity signal generation when support/backfill fails
- plan integrity signal persistence after generation
- season/league-season fairness
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
- team composition: PRESERVE_AND_REPAIR preserves current assignments and repairs gaps
- team composition: PRESERVE_AND_FILL preserves all current team assignments strictly and only distributes unassigned players to fill empty slots
- team composition: BALANCED distributes players across teams by overall strength
- team composition: ONE_STRONG_REST_BALANCED creates one strong team and balances the rest
- team composition: TIERED_DESCENDING creates teams in descending strength order
- team composition: TIERED_DESCENDING requires coach acknowledgement (policy-gated)
- team composition: deterministic output for identical inputs
- team composition: locked assignments are preserved
- team composition: unavailable and inactive players are excluded
- team composition: goalkeeper coverage is validated
- team composition: structural validity is checked (broken formation, no-fit percentage)
- team composition: composition policy blocks TIERED_DESCENDING without acknowledgement
- event squad: all balanced with full ratings and positions
- event squad: all balanced with unrated players
- event squad: one competitive + two balanced remainder
- event squad: competitive squad fills formation needs before raw skill
- event squad: remaining players are balanced after competitive squad is removed
- event squad: unavailable/unknown/withdrawn players are excluded
- event squad: reserves are excluded unless included
- event squad: locked players are preserved on regeneration
- event squad: manual seed + auto-balance does not overwrite locked assignments
- event squad: missing goalkeeper coverage produces planning note
- event squad: missing ratings produce uncertainty note
- event squad: no player appears in two event squads for the same event
- player attribute: null displays as Not rated, not 0 or max
- player attribute: 1-10 validation rejects out-of-range values
- player attribute: composite ratings derive correctly from null-aware averages
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

TEST_DATABASE_URL is required for all test runs. Tests must never fall back to DATABASE_URL — it may point to a production database. The vitest config and `setupTestDb()` both enforce this: if `TEST_DATABASE_URL` is not set, tests fail immediately rather than risk wiping production data. Never reintroduce a DATABASE_URL fallback in test infrastructure.

Never run `prisma migrate dev` against production.

Never run `cleanTestDb()` or any test setup/teardown against a production database.

## Auth rules

Matchboard is a private coaching app. Auth is mandatory, not optional.

- Users must authenticate (Google OAuth) before accessing any app data
- Access is controlled by organisation membership (not an email allowlist)
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
- Authenticated users without an organisation membership, or with more than one, see the
  organisations page (create or join) — page components and server actions under `(app)` must
  call `requirePageActorContext()` (`src/lib/auth/actor-context.ts`), not `requireActorContext()`
  directly, so an ambiguous/missing org context redirects to `/organisations` instead of crashing
  to the generic error boundary (ADR-0082). API routes call `requireActorContext()` directly and
  return their own JSON error response instead — never redirect from a route handler.
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

### Tenant isolation (critical — do not regress)

**The Neon WebSocket adapter (`PrismaNeon`) does NOT preserve `SET LOCAL` session state between raw SQL and model queries inside `$transaction()`.** This was verified in production: `SET LOCAL` + `SHOW` works for raw SQL, but model queries inside `rawClient.$transaction()` lose the session variable and return 0 rows from all RLS-protected tables.

**Do not use `SET LOCAL app.current_organization_id` inside Prisma transactions for tenant isolation.** It does not work with the Neon adapter.

The primary tenant isolation mechanism is **Prisma where-clause injection** in `src/lib/db.ts` (`tenantRLS` extension). Every query on an RLS-scoped table has `organisationId` injected into its `where` clause (and `data` for creates). `findUnique` converts to `findFirst` to allow additional filtering.

**The extension fails closed (ADR-0087).** A query on an RLS-scoped table with no trusted organisation context (`getTenantOrganisationId()` returns nothing, or an org ID present but failing `ORG_ID_PATTERN`) throws `TenantContextError` instead of running unscoped. There are exactly two exceptions, both narrow and explicit:
- The pre-existing `organisationMembership` self-read-by-`userId` case (ADR-0052), used only during auth resolution before an organisation is known.
- `runWithSystemPrivilege(reason, fn)` (`src/lib/tenancy/tenant-async-storage.ts`) — an explicit, reason-required opt-in for a genuinely privileged system operation with no tenant/user identity to scope by (today: one call site, the internal live-match snapshot reconciliation endpoint). Do not reach for this as a convenience escape for a route/action/script that should just call `requireActorContext()` or `runWithTenantOrganisationId()` first — prefer scoping by an already-trusted ID (`runWithTenantOrganisationId()`) over a privilege escape wherever one is available (see `recordEventForActor()`, `resolveOrgFilterForMachine()`, `scripts/bootstrap-organisation.ts` for the pattern).

`withTenantContext()` (`src/lib/tenancy/tenant-client.ts`) establishes real tenant context via `runWithTenantOrganisationId()` around the transaction it wraps — despite its pre-ADR-0087 name, it previously only wrapped a `$transaction()` and never actually set context, so callers without their own explicit `where: { organisationId }` filter ran unscoped. Do not reintroduce a "wraps a transaction but doesn't set context" helper.

**`setTenantOrganisationId()` never propagates to a function's own caller once that function has itself awaited anything — this needs no concurrency to reproduce (ARR-0029 "Bug 3").** This is correct, documented Node.js `AsyncLocalStorage` behavior, not a defect: `enterWith()` scopes "the remainder of the current execution," and once an async function has awaited something, its continuation is a child of wherever it was called from, not an ancestor — a child's `enterWith()` mutation can never become visible to the parent once the child's promise resolves. `requireActorContext()`/`requirePageActorContext()` must always `await` a DB lookup before knowing the organisation, so their own `setTenantOrganisationId()` call can only ever scope their *own* remaining internal queries — never a caller's. **Every call site must therefore call `setTenantOrganisationId(ctx.organisationId)` itself, immediately after resolving `ctx`, before any other query** — this is not optional boilerplate, it is the only thing that makes tenant scoping actually work for that call site's own queries. `src/lib/db.ts`'s `tenantRLS` extension also has a defense-in-depth fallback (`getExplicitOrgId()`): when ALS context is absent, it trusts an `organisationId` already present in the query's own `where`/`data` (the "Prisma where-clause injection" pattern below) — but that only helps queries that already carry one explicitly, so it is a backstop, not a substitute for the `setTenantOrganisationId()` call at each entry point. (Never mix scoped `run()`-style calls — `runWithTenantOrganisationId()`, `withTenantContext()` — with a *later* `setTenantOrganisationId()`/`enterWith()` in the same continuation either; that composition has its own separate, real failure mode. Within a single request's auth-resolution call graph, `setTenantOrganisationId()` is called exactly once, as early as the organisation identity is known, with every later query in that graph — `requireActorContext()`, `resolveOrganisationAccess()`, `getEffectiveGroupAccess()` — relying on that single already-set context. A function that does its own `run()`-scoped work and returns without any caller-visible `enterWith()` afterward, e.g. `resolveOrgFilterForMachine()` or `recordEventForActor()` which wraps its *entire* remaining body in one `run()` call, remains safe.)

Database RLS policies serve as defence-in-depth. They are **permissive when `app.current_organization_id` is not set** (null or empty), trusting application-layer filtering — this remains true at the database layer; it no longer describes the primary application-level `tenantRLS` extension, which now fails closed instead. When the session variable IS set, RLS still enforces as an additional layer.

See ADR-0057 for the where-clause-injection design and ADR-0087 for the fail-closed behavior and `runWithSystemPrivilege()`.

### Production migrations

- **Schema-changing PRs must follow expand/contract discipline (ADR-0105).** Vercel deploys new
  application code to production immediately on push, completely independent of the
  approval-gated migration pipeline below — a migration can sit pending for a human's approval
  for an arbitrary amount of time while the code that assumes it already applied is already live.
  A migration that only adds nullable/optional structure, paired with code that reads the new
  structure defensively (tolerates it being absent), is always safe regardless of which lands
  first and needs no special sequencing. A migration that removes/renames/retypes something, or
  that pairs with code that assumes new required structure is already present, must be split into
  a separate "expand" PR (safe migration + defensive code) followed by a later "contract" PR (code
  now requires the new shape, old structure dropped) — never both in one PR. See ADR-0105 for the
  full rule, worked examples, and why deploy-gating was considered and deliberately deferred
  instead.
- **Never run `prisma migrate dev` against production.**
- Production migrations run through the `.github/workflows/production-db-migrate.yml` pipeline
  (ADR-0084), not manually from a local machine. It always uses `npm run db:migrate` (`prisma
  migrate deploy`) with `DATABASE_URL`/`DIRECT_URL` targeting Neon — the same command, run in CI
  instead of by hand.
- The pipeline runs automatically after CI succeeds on a push to `main`, and can also be triggered
  manually via `workflow_dispatch` as a fallback. Either way, its `check` job (unattended) detects
  whether any migration is actually pending — using `prisma migrate status`'s exit code, not
  `prisma migrate diff --exit-code` (confirmed unreliable against this repo's migration history —
  see ADR-0084) — and scans pending migration SQL for destructive operations
  (`scripts/check-pending-migrations.mjs`). The `migrate` job that actually applies pending
  migrations only runs when something is pending, and targets the `production-db` GitHub
  Environment, whose `required_reviewers` protection rule gates it regardless of trigger type —
  automating the trigger does not remove the human approval checkpoint.
- Migrations must not run as part of the Vercel build process.
- The `postinstall` script runs `prisma generate` only — not migrations.
- Before a migration reaches the production pipeline, CI's `migration-upgrade-from-populated-state`
  job (ADR-0090, `scripts/verify-migration-upgrade.sh`) applies it to a disposable Neon branch
  forked from the persistent `test` branch (which carries real, populated data at its current
  migration state) — catching a migration that's safe against an empty schema (the separate
  `migration-from-zero` job) but unsafe against existing rows, before it ever reaches the
  human-approval gate below. This does not replace `check-pending-migrations.mjs`'s
  destructive-keyword scan; both run.
- If a migration's own SQL fails partway through applying to production, Prisma marks it FAILED
  in its bookkeeping and refuses to attempt anything else until resolved — this is a different
  state from a normal pending migration, and the pipeline's `check` job deliberately does not
  treat it as one (`scripts/check-pending-migrations.mjs` detects and reports it distinctly). Do
  not run `prisma migrate resolve` by hand against production credentials. Trigger
  `production-db-migrate.yml` manually with the `resolve_migration`/`resolve_mode` inputs instead
  — this runs the same command through the same approval-gated pipeline (see ADR-0084's
  2026-08-23 History entry for the incident that added this). Fix the underlying SQL bug in the
  same change, not just the bookkeeping — resolving without fixing the SQL fails again identically
  on the next apply attempt.

### Hard rules

- **Never push directly to `main`.** All changes must go through a branch and pull request. No exceptions.
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
- The `/api/health` endpoint returns `{ ok, version, environment }` — it must not expose business data (player counts, etc.)
- Rate limiting is distributed, backed by the `RateLimitBucket` Postgres table (`src/lib/rate-limit.ts`) via an atomic `INSERT ... ON CONFLICT` upsert — not an in-process `Map` (ARR-0019, resolved 2026-08-22)
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
| `src/lib/selection/generate-round.ts` | Round-level orchestrator (includes Phase 7: policy evaluation) |
| `src/lib/selection/generate-selection.ts` | Per-match selection |
| `src/lib/selection/resolve-round-support.ts` | Cross-match support and squad repair resolution |
| `src/lib/selection/resolve-round-conflicts.ts` | Same-round player conflicts |
| `src/lib/selection/route-core-match-drops.ts` | Core match drop routing |
| `src/lib/selection/rotation-path-policy.ts` | Movement eligibility validation |
| `src/lib/selection/load-rotation-paths.ts` | Shared helpers: merge team-level RotationPath with group-level GroupMovementPath edges |
| `src/lib/groups/group-pool-resolver.ts` | Group player pool resolution, group movement path queries, group-based player eligibility |
| `src/lib/groups/cross-group-movement-authorizer.ts` | Cross-group movement authorization with role compatibility checks |
| `src/lib/groups/group-path-bridge.ts` | Convert GroupMovementPath edges to team-level RotationPathEdge format for selection engine |
| `src/lib/selection/validate-generated-round-invariants.ts` | Post-generation invariant checks |
| `src/lib/selection/save-generated-draft.ts` | Persist draft selections and movement ledger entries |
| `src/lib/selection/migrate-double-load-roles.ts` | Migration: merge standalone DOUBLE_LOAD rows into base role rows with controlledDoubleLoad=true |
| `src/lib/selection/migrate-squad-repair-roles.ts` | Migration: role=CORE with "squad repair" explanation → role=BACKFILL |
| `src/lib/selection/backfill-movement-ledger.ts` | Normalization: create MovementLedger entries for existing non-core selections without ledger entries |
| `src/lib/selection/round-finalization-transitions.ts` | Owning writes for the Plan-phase finalize/un-finalize transition (ADR-0088): shared selection/movement-ledger/round-record writes called by all four functions below, scoped by `{ matchRoundId }` or `{ matchId }` |
| `src/lib/selection/finalize-match-round.ts` | Finalize a round |
| `src/lib/selection/finalize-single-match.ts` | Finalize a single match within a round |
| `src/lib/selection/unfinalize-match-round.ts` | Un-finalize a round (revert to DRAFT) |
| `src/lib/selection/unfinalize-single-match.ts` | Un-finalize a single match (revert to DRAFT) |
| `src/lib/selection/availability-impact.ts` | Availability change impact analysis (affected rounds, unfinalization needed) |
| `src/lib/selection/edit-impact-preview.ts` | Manual edit consequence preview (dry-run add/remove, plan integrity diff) |
| `src/app/(app)/matches/emergency-repair-actions.ts` | Server actions: availability impact, manual edit preview, emergency repair options |
| `src/lib/selection/emergency-repair-options.ts` | Pre-kickoff emergency repair options generator (ranked, reuses manual-edit mutation as eligibility gate) |
| `src/lib/selection/get-planning-period-fairness.ts` | Fairness calculation (FINALIZED only) |
| `src/lib/seasons/league-season.ts` | Date-derived SPRING/FALL assignment, labels, date ranges |
| `src/lib/rounds/round-engagement.ts` | Round engagement enforcement and override validation |
| `src/lib/selection/get-consecutive-support-count.ts` | Consecutive support round tracking |
| `src/lib/selection/refresh-draft-selection.ts` | Regenerate draft for a match or round |
| `src/lib/selection/populate-all-drafts.ts` | Populate all convenience workflow |
| `src/lib/selection/persist-warnings.ts` | Persist plan integrity signals after generation |
| `src/lib/selection/movement-candidate.ts` | Movement candidate CRUD, validation, queries |
| `src/lib/selection/compute-plan-integrity.ts` | Compute plan integrity signals for a round (includes policy-derived signals) |
| `src/lib/selection/signal-category.ts` | Plan integrity signal category definitions (Blocked, Decision required, Planning note) |
| `src/lib/selection/reconcile-integrity.ts` | Reconcile stale integrity signals from canonical state |
| `src/lib/selection/explanation-generation.ts` | Generate selection explanations |
| `src/lib/selection/explanation-enrichment.ts` | Enrich explanations with coaching intent and context |
| `src/lib/selection/selection-eligibility.ts` | Selection eligibility checks (rotation path, availability, non-rotatable) |
| `src/lib/selection/selection-types.ts` | Selection engine type definitions |
| `src/lib/selection/selection-warnings.ts` | Warning/signal generation for plan integrity |
| `src/lib/selection/override-reason-utils.ts` | Override reason category utilities |
| `src/lib/selection/get-season-overview.ts` | Season overview data for matrix view |
| `src/lib/selection/get-floating-history.ts` | Floating (non-core) history data |
| `src/lib/selection/get-core-match-drop-history.ts` | Core match drop history data |
| `src/lib/selection/selection-fairness.ts` | Fairness scoring logic |
| `src/lib/selection/rotation-candidate-evaluation.ts` | Rotation candidate evaluation and scoring |
| `src/lib/selection/rotation-candidate-ranking.ts` | Rotation candidate ranking (includes bounded combination-evidence signal) |
| `src/lib/selection/combination-scoring.ts` | Bounded, intent-aware combination-evidence scoring signal and factual explanation strings |
| `src/lib/evidence/football-match-ref.ts` | Canonical `FootballMatchRef` discriminated union identifying a match's source (League/Event) for the shared learning pipeline (ADR-0104) |
| `src/lib/evidence/post-match-learning.ts` | `runPostMatchLearning(ref)` — the one shared post-match learning orchestrator used by League and Event report completion |
| `src/lib/evidence/adapters/league-evidence-adapter.ts` | Builds a League `FootballMatchRef` (`buildLeagueMatchRef`), resolving `leagueSeasonId` via the match's round |
| `src/lib/evidence/adapters/event-evidence-adapter.ts` | Builds an Event `FootballMatchRef` (`buildEventMatchRef`), resolving `evidenceLeagueSeasonId` via football-group + date-range overlap (learning context only, never League competition membership) |
| `src/lib/evidence/combination-topology.ts` | Derives all six canonical combination families (Partnership/Triangle/Line/Corridor/Functional Unit/Full Configuration) from the actual position timeline |
| `src/lib/evidence/combination-goal-attribution.ts` | Places goals/assists on the timeline (live events when available, `Goal.minute` as approximate fallback) for combination evidence |
| `src/lib/evidence/combination-aggregation.ts` | Cross-match combination evidence aggregation, persistence, season summaries, historical backfill, opponent-scoped evidence (`getOpponentCombinationEvidence`), planned-pairing filtering (`selectRelevantPartnerships`) |
| `src/components/opponents/opponent-combination-evidence-section.tsx` | Factual combination evidence recorded in matches against one opponent, shown on the opponent detail page |
| `src/lib/policies/types.ts` | Policy input/result type definitions |
| `src/lib/policies/core-invariants.ts` | Non-overridable core invariant checks |
| `src/lib/policies/build-policy-input.ts` | Build normalized policy input from app data |
| `src/lib/policies/default-matchboard-policy.ts` | Default Matchboard eligibility/warning/scoring policy |
| `src/lib/policies/selection-policy-adapter.ts` | Policy adapter interface, composite pipeline, factory |
| `src/lib/policies/rego-policy-adapter.ts` | OPA/Rego Wasm adapter for custom Rego policies |
| `src/lib/policies/policy-pack.ts` | Policy pack metadata validation, resolution, diagnostics, and artifact hashing |
| `src/lib/policies/policy-evaluation.ts` | Evaluate policy pipeline, filter blocked players, apply score adjustments, coach-facing reason formatting |
| `src/lib/policies/policy-signal-mapper.ts` | Map policy results to plan integrity signals, merge with existing signals |
| `src/lib/policies/policy-version.ts` | Policy artifact hash/version tracking for audit and diagnostics |
| `src/lib/policies/policy-decision-log.ts` | Policy decision summary builder for logging |
| `src/lib/workbench/workbench-types.ts` | Workbench request/result/fixture/diagnostics types |
| `src/lib/workbench/workbench-service.ts` | Workbench service: load fixtures, run policy evaluation, compare default vs Rego |
| `src/lib/workbench/policy-diff.ts` | Diff policy results (default vs Rego), summarize workbench input |
| `src/app/api/workbench/diagnostics/route.ts` | GET workbench diagnostics (policy version, Rego status) |
| `src/app/api/workbench/run/route.ts` | POST workbench dry-run policy evaluation |
| `src/app/api/workbench/fixtures/route.ts` | GET available workbench fixtures |
| `src/app/(app)/workbench/page.tsx` | Workbench UI page |
| `test/fixtures/workbench/*.json` | Workbench fixture data (anonymized) |
| `scripts/workbench-dry-run.mjs` | CLI dry-run script for workbench fixtures |
| `src/lib/events/event-validation.ts` | Event pool validation and `applyPolicyWarnings()` helper |
| `src/lib/match-date-utils.ts` | hasMatchPassed/hasLeagueMatchPassed — server-side date comparison for report availability |
| `src/lib/matches/match-helper-eligibility.ts` | League Match helper effective roster (`Selection ∪ MatchHelperAssignment`), candidate list, eligibility check (ADR-0077) |
| `src/app/(app)/matches/match-helper-actions.ts` | Server actions: add/remove League Match helper, list helpers/candidates |
| `src/components/matches/match-helpers-panel.tsx` | "Add helper" UI on the League match detail Squad tab |
| `src/lib/assistant/types.ts` | Assistant work item types and priority ordering (includes review_assigned, review_changes_requested, incomplete_report, unknown_attendance) |
| `src/lib/assistant/get-assistant-command-centre.ts` | Compute assistant work items from league, event, and review state (includes audit work items, delayed planned rotation changes) |
| `src/lib/rounds/round-progress.ts` | Derives additive round progress (Planning/Partially played/All matches played/Reporting/Complete) from round matches — never a replacement for the mandatory round status labels |
| `src/lib/selection/player-lock.ts` | Player lock ("Pin") domain service: create/list/delete, read by generate-selection.ts |
| `src/app/(app)/teams/player-lock-actions.ts` | Player lock ("Pin") server actions |
| `src/lib/assistant/get-event-work-items.ts` | Compute event-related assistant work items |
| `src/lib/data-integrity/audit-data-integrity.ts` | Integrity audit: mandatory checks + candidate stubs |
| `src/lib/data-integrity/reconcile-canonical-derived-data.ts` | Reconcile derived projections from canonical sources |
| `src/lib/data-integrity/types.ts` | Audit and reconciliation types |
| `src/app/api/admin/audit/route.ts` | GET `/api/admin/audit` — run integrity audit |
| `src/app/api/admin/reconcile/route.ts` | POST `/api/admin/reconcile` — reconcile derived projections |
| `src/app/(app)/teams/movement-candidate-actions.ts` | Server actions for movement candidate CRUD |
| `src/lib/events/event-squad-generation.ts` | Event squad generation engine (all modes) |
| `src/lib/events/event-types.ts` | TypeScript types for event squad generation; `getEffectiveEventTeamGameFormat()` centralized per-squad effective format resolver |
| `src/lib/events/event-validation.ts` | Event pool validation and `applyPolicyWarnings()` helper |
| `src/lib/events/event-balance.ts` | Balance summary calculation |
| `src/lib/events/event-match-eligibility.ts` | Canonical eligibility service: `getEligibleEventMatchPlayers()`, `assertEligibleEventMatchPlayer()` |
| `src/lib/events/event-match-time.ts` | Event match time window calculation, overlap detection, support availability |
| `src/lib/events/event-match-support.ts` | Event match support candidate logic, conflict detection |
| `src/lib/formatters/game-format.ts` | Human-readable game format labels (3-a-side, 5-a-side, etc.) |
| `src/app/(app)/events/actions.ts` | Server actions: pool management, squad assignment, generation |
| `src/app/(app)/events/event-match-actions.ts` | Server actions: event match CRUD, edit, cancel, reopen |
| `src/app/(app)/events/event-support-actions.ts` | Server actions: support assignment add/remove/update, conflict-enriched list, candidate eligibility query |
| `src/app/(app)/events/event-squad-commit-actions.ts` | Server actions: squad validation, lock, unlock, aggregate status |
| `src/app/(app)/events/[eventId]/event-lineup-actions.ts` | Server actions: event match lineup CRUD, auto-fill, formation change |
| `src/app/(app)/events/[eventId]/event-match-lineup-panel.tsx` | Event match lineup panel with formation selector, dropdown-per-slot assignment, auto-fill |

### Coaching intelligence files

| File | Purpose |
|------|---------|
| `src/lib/coaching/types.ts` | Coaching domain constants and types: intent categories, readiness signals, matchday responsibilities, feedback categories, disallowed language |
| `src/lib/coaching/coaching-intent.ts` | Coaching intent CRUD and scope resolution (match → round → league season cascade) |
| `src/lib/coaching/readiness-signals.ts` | Readiness signal CRUD, validation, and warnings |
| `src/lib/coaching/match-execution-feedback.ts` | Legacy match execution feedback validation/disallowed-language helpers — CRUD functions are unreachable residue (see "Post-match reflection and feedback") |
| `src/lib/coaching/team-reflection.ts` | Team reflection CRUD and upsert |
| `src/lib/coaching/matchday-responsibility.ts` | Matchday responsibility assignment, validation, and description |
| `src/lib/coaching/index.ts` | Barrel export for coaching domain |
| `src/lib/selection/readiness-scoring.ts` | Readiness scoring modifiers for selection engine |
| `src/components/players/player-readiness-panel.tsx` | Readiness signals editor panel on player profile |
| `src/components/matches/coaching-intent-selector.tsx` | Coaching intent dropdown selector |
| `src/components/matches/matchday-responsibility-selector.tsx` | Matchday responsibility dropdown selector |
| `src/components/matches/legacy-match-feedback-section.tsx` | Read-only historical display of legacy Post-match feedback rows — no active write path; renders nothing when a match has no legacy rows |
| `src/components/player-development/football-observation-section.tsx` | Football observations — the canonical player-development observation write path (post-match) |
| `src/components/matches/team-reflection-section.tsx` | Team reflection rating form |
| `src/components/matches/match-combination-evidence-panel.tsx` | Factual, match-scoped combination evidence (Partnership/Triangle) shown on the post-match page once the report is LOCKED — no confidence label (single-match confidence can never reach ESTABLISHED) |
| `src/app/(app)/players/[playerId]/coaching-actions/actions.ts` | Readiness signal server actions |
| `src/lib/planned-rotation/development-thread.ts` | Development thread domain service (CRUD, lifecycle, observations) |
| `src/app/(app)/matches/development-thread-actions.ts` | Development thread server actions |
| `src/lib/coaching/team-focus.ts` | Team focus domain service (CRUD, lifecycle, max 3 active per team) |
| `src/components/team/team-focus-panel.tsx` | Team focus editor panel on team workspace |
| `src/lib/coaching/quick-observation.ts` | Quick observation domain service: capture-first/classify-later CRUD, convert to development thread/team reflection/opponent observation, keep-as-note, discard |
| `src/app/(app)/matches/quick-observation-actions.ts` | Quick observation server actions |
| `src/components/players/player-quick-observations-panel.tsx` | Quick observation capture/list panel on player profile |

### Transactional email files

| File | Purpose |
|------|---------|
| `src/lib/email/provider.ts` | `TransactionalEmailProvider` interface, `EmailProviderResult`, `SendEmailRequest`, helper functions |
| `src/lib/email/brevo-provider.ts` | Brevo SDK adapter |
| `src/lib/email/console-provider.ts` | Console logging adapter for local dev |
| `src/lib/email/fake-provider.ts` | In-memory test adapter |
| `src/lib/email/provider-factory.ts` | Provider factory: Brevo when API key present, Console otherwise |
| `src/lib/email/templates/index.ts` | Template registry and renderer |
| `src/lib/email/templates/organisation-invitation.ts` | Organisation invitation email template |
| `src/lib/email/outbox.ts` | `enqueueNotification()`, outbox batch processing, retry with exponential backoff |
| `src/lib/email/webhook-handler.ts` | Brevo webhook signature verification and delivery status processing |
| `src/app/api/cron/notification-outbox/route.ts` | Cron endpoint for outbox processing |
| `src/app/api/webhooks/brevo/route.ts` | Webhook endpoint for Brevo delivery status callbacks |

### Review and attention files

| File | Purpose |
|------|---------|
| `src/lib/review/review-service.ts` | `createReviewRequest()`, `resolveReviewRequest()`, `supersedePendingReviews()`, `getPendingReviewsForReviewer()`, `getReviewHistory()` |
| `src/app/(app)/reviews/actions.ts` | Review server actions: request, resolve, cancel, get pending, get history |
| `src/lib/attention/get-attention-entries.ts` | `getAttentionEntries()` — attention projection from live domain state |
| `src/app/(app)/o/[orgSlug]/attention/page.tsx` | Attention page (server) |
| `src/app/(app)/o/[orgSlug]/attention/attention-client.tsx` | Attention page client component |
| `src/app/(app)/o/[orgSlug]/attention/actions.ts` | Attention server actions |
| `src/app/(app)/o/[orgSlug]/reviews/page.tsx` | Reviews list page (server) |
| `src/app/(app)/o/[orgSlug]/reviews/review-list-client.tsx` | Reviews list client component with resolve/cancel UI |

### Command palette files

Command registry architecture (UI/UX programme Phase 2.6): global commands are declared once in
`src/lib/commands/registry.ts`, not inline inside the palette component or its API route.
`availability(context)` runs server-side against a real `ActorContext` before a command is ever
sent to the client — client-side keyword search is a UX layer on top, never a substitute for
authorization. Contextual (current route/entity) and selection-aware commands (PROGRAMME.md §15,
§16) are a deliberate follow-up, not yet modelled.

| File | Purpose |
|------|---------|
| `src/lib/commands/types.ts` | `CommandDefinition`, `ResolvedCommand` types |
| `src/lib/commands/registry.ts` | The canonical command registry and `getAvailableCommands(context)` |
| `src/app/api/command-palette/route.ts` | GET route: resolves the registry against the caller's `ActorContext`, plus the organisation-switch list |
| `src/components/shell/command-palette.tsx` | Palette UI: `Cmd/Ctrl+K`, grouped results, keyword search, live player/team entity search |
| `src/components/shell/top-context-bar.tsx` | Renders the palette and its visible trigger |

### Formation/tactics files

| File | Purpose |
|------|---------|
| `src/lib/formations/types.ts` | Grid coordinates, role types, broad positions, constants, `getGridPositionPercent()` |
| `src/lib/formations/system-formations.ts` | System formation definitions (3v3–11v11) |
| `src/lib/formations/validate.ts` | Formation validation for match use |
| `src/lib/formations/slot-defaults.ts` | `suggestSlotDefaults()` for auto-fill on grid cell click |
| `src/lib/formations/snapshot.ts` | `createFormationSnapshot()` for lineup creation |
| `src/lib/formations/suggest.ts` | `suggestFormationForMatch()`, `suggestLineupForFormation()`, `preserveAssignmentsOnChange()` |
| `src/lib/formations/lineup-compatibility.ts` | `getPlayerSlotCompatibility()`, `sortPlayersBySlotCompatibility()`, `getPlayersForLineup()` |
| `src/lib/formations/normalize.ts` | `findFormationDataIssues()` — formation data validation/normalization |
| `src/lib/formations/seed.ts` | `seedSystemFormations()` — DB seeding from system-formations data |
| `src/components/formations/pitch-formation.tsx` | `PitchFormationBuilder` (editor), `PitchLineupView` (lineup), `SlotEditDialog` |
| `src/components/formations/player-picker.tsx` | `PlayerPicker` dialog for slot assignment |
| `src/components/formations/formations-builder.tsx` | `FormationsBuilderClient` — create/edit formation page component |
| `src/components/matches/match-tactics-panel.tsx` | `MatchTacticsPanel` — tactics tab in match detail |
| `src/app/(app)/rules/formation-actions.ts` | Server actions: CRUD for formations and slots, duplicate, archive |
| `src/app/(app)/matches/lineup-actions.ts` | Server actions: create lineup, assign/remove player, toggle lock, confirm, archive, revert, bench |
| `src/app/(app)/matches/suggest-actions.ts` | Server actions: suggest formation, suggest lineup, apply, clear, fill |

### Simulation files

| File | Purpose |
|------|---------|
| `src/lib/simulation/simulation-types.ts` | Simulation request/result types, fairness signals, conflict types, participation types |
| `src/lib/simulation/simulation-service.ts` | `runSeasonSimulation()` — dry-run league simulation using real generation engine |
| `src/lib/simulation/simulation-event-service.ts` | `simulateEvent()` — dry-run event squad simulation using `generateEventSquads` |
| `src/lib/simulation/simulation-context-builder.ts` | `buildLeagueSimulationContext()` — load DB data for league simulation |
| `src/lib/simulation/simulation-fairness.ts` | `computeSimulationFairness()`, `detectGkCoverageGaps()` — fairness flag detection |
| `src/lib/simulation/simulation-conflicts.ts` | `detectSimulationConflicts()`, `detectGkConflicts()`, `detectUnavailablePlayerConflicts()` |
| `src/app/api/simulation/run/route.ts` | POST `/api/simulation/run` — simulation API endpoint |
| `src/app/(app)/simulation/page.tsx` | Simulation UI page |

### Historical audit and planned-vs-actual files

| File | Purpose |
|------|---------|
| `src/lib/audit/audit-types.ts` | Audit types: planned-vs-actual, participation summary, season review, audit work items |
| `src/lib/audit/planned-vs-actual.ts` | `getPlannedVsActualForMatch()`, `getPlannedVsActualForRound()`, `getAuditWorkItems()`, `getSeasonReview()` — planned vs actual comparison and season review |
| `src/lib/audit/player-history.ts` | `getPlayerHistory()` — per-player timeline across rounds with planned vs actual |
| `src/lib/audit/opponent-history.ts` | `getOpponentHistory()` — per-opponent match history with results |
| `docs/adr/0022-historical-audit-and-planned-vs-actual.md` | ADR: historical audit architecture decisions |

### Visual Decision Review (Insights) files

| File | Purpose |
|------|---------|
| `src/lib/insights/insights-types.ts` | Insight surface type definitions (cell statuses, filters, rows, deltas, conflicts) |
| `src/lib/insights/opportunity-matrix.ts` | `getOpportunityMatrix()` — player × round participation matrix with planned vs actual statuses |
| `src/lib/insights/opportunity-matrix-helpers.ts` | Pure helper functions for role-to-status mapping (testable without server-only) |
| `src/lib/insights/load-timeline.ts` | `getLoadTimeline()` — player × round load timeline with actual/helper/planned statuses |
| `src/lib/insights/load-timeline-helpers.ts` | Pure helper functions for load cell classification and attention flags |
| `src/lib/insights/squad-coverage.ts` | `getSquadCoverage()` — goalkeeper and position coverage per squad with warnings |
| `src/lib/insights/squad-coverage-helpers.ts` | Pure helper functions for GK classification, position classification, coverage warnings |
| `src/lib/insights/policy-warning-review.ts` | `getPolicyWarningReview()` — policy warning groups from Warning table mapped to signal categories |
| `src/lib/insights/policy-warning-review-helpers.ts` | Pure helper functions for warning severity classification and display labels |
| `src/lib/insights/planned-vs-actual-delta.ts` | `getPlannedVsActualDeltas()` — planned vs actual comparison per match |
| `src/lib/insights/planned-vs-actual-helpers.ts` | Pure helper functions for delta type classification and display labels |
| `src/lib/insights/conflict-review.ts` | `getConflictReview()` — overlapping selections, helper conflicts, double-planned players |
| `src/lib/insights/conflict-review-helpers.ts` | Pure helper functions for conflict severity classification and display labels |
| `src/lib/insights/insights-overview.ts` | `getInsightOverview()` — aggregate insight summary counts |
| `src/app/api/insights/opportunity/route.ts` | GET `/api/insights/opportunity` — opportunity matrix API |
| `src/app/api/insights/overview/route.ts` | GET `/api/insights/overview` — insight overview API |
| `src/app/api/insights/load/route.ts` | GET `/api/insights/load` — load timeline API |
| `src/app/api/insights/coverage/route.ts` | GET `/api/insights/coverage` — squad coverage API |
| `src/app/api/insights/policy-warnings/route.ts` | GET `/api/insights/policy-warnings` — policy warning review API |
| `src/app/api/insights/planned-vs-actual/route.ts` | GET `/api/insights/planned-vs-actual` — planned vs actual delta API |
| `src/app/api/insights/conflicts/route.ts` | GET `/api/insights/conflicts` — conflict review API |
| `src/app/(app)/insights/page.tsx` | Insights overview page |
| `src/app/(app)/insights/insights-client.tsx` | Insights overview client component |
| `src/app/(app)/insights/opportunity/page.tsx` | Opportunity Matrix page |
| `src/app/(app)/insights/opportunity/opportunity-matrix-client.tsx` | Opportunity Matrix interactive client component |
| `src/app/(app)/insights/load/page.tsx` | Load Timeline page |
| `src/app/(app)/insights/load/load-timeline-client.tsx` | Load Timeline interactive client component |
| `src/app/(app)/insights/coverage/page.tsx` | Squad Coverage page |
| `src/app/(app)/insights/coverage/squad-coverage-client.tsx` | Squad Coverage interactive client component |
| `src/app/(app)/insights/policy-warnings/page.tsx` | Policy Warning Review page |
| `src/app/(app)/insights/policy-warnings/policy-warning-review-client.tsx` | Policy Warning Review interactive client component |
| `src/app/(app)/insights/planned-vs-actual/page.tsx` | Planned vs Actual page |
| `src/app/(app)/insights/planned-vs-actual/planned-vs-actual-client.tsx` | Planned vs Actual interactive client component |
| `src/app/(app)/insights/conflicts/page.tsx` | Conflict Review page |
| `src/app/(app)/insights/conflicts/conflict-review-client.tsx` | Conflict Review interactive client component |
| `src/lib/insights/opportunity-quality.ts` | I-002: `getOpportunityQuality()` — one factual record per planned opportunity (team, opponent, role, position, realised attendance) |
| `src/lib/insights/opportunity-quality-helpers.ts` | Pure helpers: support-burden counts, attendance label formatting |
| `src/app/api/insights/opportunity-quality/route.ts` | GET `/api/insights/opportunity-quality` — opportunity quality API |
| `src/app/(app)/insights/opportunity-quality/page.tsx` | Opportunity Quality page |
| `src/app/(app)/insights/opportunity-quality/opportunity-quality-client.tsx` | Opportunity Quality interactive client component |
| `src/lib/insights/opportunity-gap.ts` | I-003: `getOpportunityGap()` — descriptive planned-vs-realised gap per player, not a debt score |
| `src/lib/insights/opportunity-gap-helpers.ts` | Pure helpers: gap sorting, has-gap predicate |
| `src/app/api/insights/opportunity-gap/route.ts` | GET `/api/insights/opportunity-gap` — opportunity gap API |
| `src/app/(app)/insights/opportunity-gap/page.tsx` | Opportunity Gap page |
| `src/app/(app)/insights/opportunity-gap/opportunity-gap-client.tsx` | Opportunity Gap interactive client component |
| `src/lib/insights/position-exposure.ts` | I-004: `getPositionExposure()` — planned lineup slots vs realised positions; unused lineup assignments are not realised exposure |
| `src/lib/insights/position-exposure-helpers.ts` | Pure helpers: frequency counting, top-position lookup, evidence-completeness formatting |
| `src/app/api/insights/position-exposure/route.ts` | GET `/api/insights/position-exposure` — position exposure API |
| `src/app/(app)/insights/position-exposure/page.tsx` | Position & Formation Exposure page |
| `src/app/(app)/insights/position-exposure/position-exposure-client.tsx` | Position & Formation Exposure interactive client component |
| `src/lib/insights/player-combinations.ts` | I-005: `getPlayerCombinations()` — co-selection/co-appearance frequency per player pair; frequency is not effectiveness. Enriched with partnership subtype, minutes together, and confidence from `CombinationEvidence` when available |
| `src/lib/insights/player-combinations-helpers.ts` | Pure helpers: order-independent pair keying |
| `src/app/api/insights/player-combinations/route.ts` | GET `/api/insights/player-combinations` — player combinations API |
| `src/app/(app)/insights/player-combinations/page.tsx` | Player Combinations page |
| `src/app/(app)/insights/player-combinations/player-combinations-client.tsx` | Player Combinations interactive client component |
| `src/lib/insights/continuity-review.ts` | I-006: `getContinuityReview()` — round-over-round retained/new players and formation repeats per team; no prescribed ideal balance |
| `src/lib/insights/continuity-review-helpers.ts` | Pure helpers: continuity ratio, formation-change formatting |
| `src/app/api/insights/continuity/route.ts` | GET `/api/insights/continuity` — continuity review API |
| `src/app/(app)/insights/continuity/page.tsx` | Continuity vs Exploration page |
| `src/app/(app)/insights/continuity/continuity-review-client.tsx` | Continuity vs Exploration interactive client component |
| `src/lib/insights/operational-health.ts` | I-007: `getOperationalHealth()` — 9 concrete grouped facts (incomplete lineups, stale assignments, missing reports, unresolved reviews, unowned upcoming work, expiring support access, availability conflicts, invalid rotation paths, finalisation checkpoints); no composite score |
| `src/lib/insights/operational-health-helpers.ts` | Category labels, total-count helper |
| `src/app/api/insights/operational-health/route.ts` | GET `/api/insights/operational-health` — operational health API |
| `src/app/(app)/insights/operational-health/page.tsx` | Operational Health page |
| `src/app/(app)/insights/operational-health/operational-health-client.tsx` | Operational Health interactive client component |

### Player Pathways files

| File | Purpose |
|------|---------|
| `src/lib/pathways/pathways-types.ts` | Player Pathways type definitions (cell status, context, row, filters) |
| `src/lib/pathways/pathways-helpers.ts` | Pure helper functions for role-to-context mapping, cell status, summary metrics, labels |
| `src/lib/pathways/get-player-pathways.ts` | Server data function: derive pathway data from selections, availabilities, matches |
| `src/app/api/insights/player-pathways/route.ts` | GET `/api/insights/player-pathways` — API route with auth, org validation |
| `src/app/(app)/insights/player-pathways/page.tsx` | Player Pathways server page |
| `src/app/(app)/insights/player-pathways/player-pathways-client.tsx` | Player Pathways interactive client component (matrix, filters, view modes) |

### Live Match Reporting files

| File | Purpose |
|------|---------|
| `src/lib/live-match/live-match-types.ts` | Live match type definitions (clock state, events, sessions, periods, constants) |
| `src/lib/live-match/live-match-domain.ts` | Domain validation, event type classification, fair play labels, period labels |
| `src/lib/live-match/live-match-session.ts` | Server functions: start, get, end, heartbeat live sessions |
| `src/lib/live-match/live-match-event-store.ts` | Server functions: `recordEventForActor()` (actor-scoped core, SPEC.md §19), `recordEvent()` (browser wrapper), get events, get recent events, `estimateCurrentMatchSeconds()` (server-side match-time estimate, no clock anchor is persisted) |
| `src/lib/live-match/event-live-match-session.ts` | Server functions: start, get, end, heartbeat event live sessions |
| `src/lib/live-match/event-live-match-event-store.ts` | Server functions: record event events, get event match events, get recent event events |
| `src/lib/live-match/match-clock.ts` | Pure clock logic: create, advance, pause, resume, adjust, format |
| `src/lib/live-match/period-config.ts` | Period configuration: league and event period models, labels, durations |
| `src/lib/live-match/live-match-context.ts` | Shared context types for LiveMatchClient (league and event) |
| `src/components/live-match/live-match-client.tsx` | Shared live match client component (score, clock, goal/rotation/fair play/marked moment) |
| `src/components/live-match/league-live-match-client.tsx` | League match live client adapter (league server actions, period config) |
| `src/components/live-match/event-live-match-client.tsx` | Event match live client adapter (event server actions, single-period config) |
| `src/app/(app)/matches/[matchId]/live/live-actions.ts` | Server actions: session lifecycle, event recording, pre-match package |
| `src/app/(app)/matches/[matchId]/live/live-report-handoff.ts` | Server action adapter (ADR-0088): validates session/match/org consistency, then delegates to `endLiveSession()` and `seedReportFromLiveSession()` — does not reimplement either write |
| `src/lib/reports/report-mutations.ts` | League post-match report domain mutations: `seedReportFromFinalizedSquad` (direct entry, UNKNOWN attendance), `seedReportFromLiveSession` (live-session handoff, PRESENT attendance + derived goals/assists/fair-play/rotations, ADR-0088), `submitReport`/`lockReport`/`completeReport`/`reopenReport` |
| `src/lib/reports/report-domain.ts` | Report transition validation shared by League and Event (ARR-0030 resolution): `canTransitionTo`, `isReportLocked`, `hasUnknownAttendance` operate purely on the shared `MatchReportStatus` enum and a generic attendance shape, with no League-specific coupling |
| `src/app/(app)/events/[eventId]/event-live-actions.ts` | Server actions: event live session lifecycle, event recording, pre-match package |
| `src/app/(app)/events/[eventId]/event-live-report-handoff.ts` | Server action adapter (ADR-0088): validates session/match/org consistency, then delegates to `endEventLiveSession()` and `seedEventReportFromLiveSession()` |
| `src/lib/reports/event-report-mutations.ts` | Event report domain mutations: `seedEventReportFromLiveSession` (ADR-0088, Run->Learn handoff) and `completeEventReport` (ADR-0104/ARR-0030 resolution: DRAFT/REPORTED->LOCKED transition, opponent resolution, shared `runPostMatchLearning()`) |
| `src/app/(app)/events/event-football-observation-actions.ts` | Server actions: save/get football observations for an Event match (mirrors the League post-match action file; mandatory for Event player-evidence parity, ADR-0104) |
| `src/lib/live-match/local/live-local-store.ts` | IndexedDB local-first event persistence with sync status |
| `src/lib/live-match/local/live-sync.ts` | Client-side sync service: local-first write, background server sync |

### Live match realtime session files (live-match-realtime-programme, in progress)

Evolves live-match reporting into a distributed `MatchSession` model — Neon remains system
of record, IndexedDB remains the device-safety layer, a Cloudflare Durable Object becomes
the temporary per-match coordination actor. See ADR-0086 for the Stage 3 architecture
decision and `.matchboard-work/live-match-realtime-programme/` (local, gitignored) for the
full spec and phased rollout. Stages 1–2 are pure Next.js application code; Stage 3
introduces the actual Cloudflare Worker/Durable Object; Stage 4 adds the signed Worker→Vercel
internal persistence API (see `docs/development/live-match-realtime.md`) so canonical events
now actually reach Neon through the realtime path, not just through HTTP. "Follow live" (a
read-only viewer capability, maintainer-directed scope beyond the original SPEC.md —
ADR-0086's amendment) layers on top of Stage 3: a second coach with at least `GROUP_VIEWER`
access to the match's group can watch live broadcasts without any reporting controls, while
the reporting coach's page best-effort broadcasts events to the Worker purely as a
side-channel — Neon persistence still happens via the existing HTTP path as the source of
truth; Stage 4's internal API is a separate, additional path the Durable Object itself now
uses for its own accepted events, not something "Follow live" depends on.

| File | Purpose |
|------|---------|
| `src/lib/live-match/realtime/protocol.ts` | RPC envelope types, error code set, method allowlists, protocol version |
| `src/lib/live-match/realtime/protocol-schemas.ts` | Zod validation for the RPC envelope; `parseIncomingMessage`/`parseRawSocketMessage` |
| `src/lib/live-match/realtime/realtime-messages.ts` | Business payload types (`MatchSessionSnapshot`, `ClockAnchor`, command/callback shapes) |
| `src/lib/live-match/realtime/realtime-state.ts` | Client-side realtime version tracking (`RealtimeVersionTracker`) |
| `src/lib/live-match/realtime/realtime-client.ts` | Browser `RealtimeMatchClient` abstraction: connect/reconnect, RPC call/response matching, callback dispatch |
| `src/lib/live-match/realtime/realtime-ticket.ts` | Realtime connection ticket signing/verification (jose HS256, mirrors `machine-token.ts`'s pattern) |
| `src/app/api/live-match/[matchId]/realtime-ticket/route.ts` | Issues short-lived realtime connection tickets; reuses live-match session authorization |
| `workers/live-match/wrangler.jsonc` | Worker/Durable Object config: SQLite-backed DO storage, `production`/`test` environments |
| `workers/live-match/src/index.ts` | Worker entry: WebSocket upgrade validation, Origin allowlist, matchId shape, routes to the object |
| `workers/live-match/src/match-session-object.ts` | `MatchSessionObject` Durable Object: RPC dispatch, hibernation, presence, storage |
| `workers/live-match/src/state.ts` | Pure MatchSession decision logic (event classification, authenticate/record/end-session outcomes) |
| `workers/live-match/src/rpc.ts` | RPC envelope construction helpers used by the Durable Object |
| `workers/live-match/src/auth.ts` | Worker-side ticket verification re-export, Origin/matchId validation |
| `workers/live-match/src/worker-types.ts` | Worker `Env` bindings |
| `src/lib/live-match/realtime/fetch-ticket.ts` | Client-side `fetchRealtimeTicket(matchId, mode)` helper, shared by the reporting broadcast side-channel and the "Follow live" viewer |
| `src/components/live-match/follow-live-client.tsx` | Read-only "Follow live" viewer — `getSnapshot()` + callback handlers only, never calls `recordEvent`/`endSession` |
| `src/app/(app)/matches/[matchId]/live/follow/page.tsx`, `src/app/(app)/o/[orgSlug]/matches/[matchId]/live/follow/page.tsx` | "Follow live" route: global redirect + org-scoped page enforcing `requireMatchGroupAccess()` server-side before rendering |
| `src/lib/live-match/realtime/internal-signature.ts` | Shared HMAC sign/verify (Web Crypto `crypto.subtle`) — used by both the Worker (signs) and Vercel (verifies) |
| `src/lib/live-match/realtime/internal-auth.ts` | Vercel-side `verifyInternalRequest()` — raw-body HMAC verification for internal endpoints |
| `src/app/api/internal/live-match/events/route.ts` | `POST` — HMAC-only internal endpoint; calls `recordEventForActor()`, never a browser API |
| `src/app/api/internal/live-match/snapshot/route.ts` | `GET` — HMAC-only internal endpoint; canonical session/events for Stage 6 reconciliation |
| `workers/live-match/src/internal-client.ts` | Worker-side: signs and sends persistence/snapshot requests to Vercel |

Group-role-aware live match authorization (added alongside "Follow live", closing a
pre-existing gap — see ADR-0086's amendment): `requireMatchGroupMutationRole(ctx, matchId)`
(`src/lib/auth/actor-context.ts`) requires `GROUP_COACH` specifically on the match's group,
not merely any `GroupAccess` row — `requireMatchGroupAccess()` alone (any role) was
insufficient to gate live match mutation, since a `GROUP_VIEWER`-role coach with an
org-mutation-capable role (e.g. COACH) could otherwise start/record/end live sessions for a
group they were only granted read-only access to. Call both together for any live-match
mutation; `requireMatchGroupAccess()` alone remains correct for the read-only "view" path
(both `GROUP_COACH` and `GROUP_VIEWER` may follow live).

"Follow live" vs "Live reporting" — coach-facing terminology:

| Concept | Use | Never use |
|---------|-----|-----------|
| Reporting coach's active recording session | Live reporting | Broadcasting, streaming |
| Read-only remote viewing of an active session | Follow live | Watch mode, spectate, viewer mode |
| A coach following along | Following live | Viewer, spectator, observer |

## Stale references removed

- `docs/domain.md` — deleted, do not reference
- `docs/spec-ux-overhaul.md` — superseded by `docs/specs/ux-overhaul.md`
- `src/lib/formations.ts` — deleted, legacy row/col model; use `src/lib/formations/index.ts` barrel or direct `@/lib/formations/types` imports
- `src/lib/policies/json-policy-dsl.ts` — deleted, proprietary JSON policy DSL runtime (removed in Stage 4)
- `src/lib/policies/json-policy-loader.ts` — deleted, JSON policy file loader (removed in Stage 4)
- `policies/default/matchboard.default.policy.json` — deleted, default policy rules now in `default-matchboard-policy.ts`
- `policies/examples/stricter-goalkeeper-coverage.policy.json` — deleted, superseded by Rego examples
- `policies/examples/equal-opportunity.policy.json` — deleted, superseded by Rego examples
- `src/lib/selection/evaluate-controlled-double-load.ts` — deleted, quarantined legacy code with zero consumers
- `src/lib/selection/repair-dropout.ts` — deleted, unused dropout repair with zero consumers
- `src/lib/selection/get-weekly-player-coverage.ts` — deleted, unused weekly coverage with zero consumers
- `src/lib/selection/rebuild-plan-integrity.ts` — deleted, unused rebuild with zero consumers
- `src/lib/selection/movement-candidate-drift.ts` — deleted, unused drift detection with zero consumers

## Assistant Manager Workflow Rules

When implementing workflow, selection, squad review, player profile, team review, or match review changes, follow the mandatory coding-agent workflow in `docs/development/coding-agent-working-session.md`.

Key rules:
- Update supporting docs before implementation.
- Do not duplicate selection-engine logic in UI components.
- Use player IDs in stored payloads and external/public payloads.
- Do not store player names inside assistant work items, explanations, recommendations, decision records, or cross-team impact payloads.
- Do not introduce ability scores, best-XI language, permanent weak/strong labels, or public player ranking.
- Overrides must require a reason.
- Player-development and assistant-manager actions must create an auditable `DecisionRecord`.
  Selection-engine actions (finalize, un-finalize, manual override, draft clear/regenerate) are
  audited separately, via `logSecurityEvent()` and its named helpers (`logFinalization()`,
  `logManualOverride()`, etc. — `src/lib/security/audit-log.ts`), not `DecisionRecord`.
- Use the `git-branch-commit-pr` workflow.
- Do not commit internal work logs, scratch notes, or handover documents.

## User documentation

Matchboard has a public documentation site and a matching in-app contextual Help drawer,
introduced by the `user-documentation-experience` programme (ADR-0103).

### Architecture

- **Canonical content**: `content/docs/**/*.mdx`, one file per page, using
  [Fumadocs](https://fumadocs.dev) (`fumadocs-core`, `fumadocs-mdx`, `fumadocs-ui`). Every MDX
  file requires `title` and `description` frontmatter.
- **Public route**: `/docs/**`, rendered by `src/app/docs/[[...slug]]/page.tsx` via
  `src/lib/docs/source.ts`'s loader. Public and requires no authentication or organisation
  context — `"/docs"` and `"/api/search"` are the narrow, explicit `PUBLIC_ROUTES` entries
  (`src/lib/env.ts`) that make this work; do not widen that exemption to cover other routes.
  `/docs` and every route under it must never query tenant/player/match/user data — only the
  canonical MDX content tree.
- **Search**: `src/app/api/search/route.ts`, a self-hosted `fumadocs-core/search/server`
  index over the same canonical content — no third-party search service, no data leaves the
  server.
- **In-app Help**: `src/components/shell/help-drawer.tsx` renders a same-origin `<iframe>` to
  a compact `/docs/embed/**` rendering of the contextually-relevant docs page — one canonical
  content source, never a duplicated prose copy inside a component. `/docs/embed/**` is a second
  rendering mode of the same `content/docs/**` MDX (`docs/[[...slug]]/layout.tsx` branches on
  `params.slug[0] === "embed"`), skipping `DocsLayout`'s sidebar/top-nav chrome, which has
  nowhere useful to navigate inside the drawer's ~440px panel; "Open full documentation" still
  links to the real `/docs/**` page. `embed-link.tsx` rewrites internal `/docs/**` cross-links in
  MDX prose to `/docs/embed/**` so browsing stays inside the compact embed. The drawer itself is
  portalled to `document.body` (`react-dom`'s `createPortal`) — it is mounted from
  `top-context-bar.tsx`, a descendant of the app shell's `backdrop-blur-2xl` `<header>`, and
  `backdrop-filter` establishes a new containing block for `position: fixed` descendants, so
  without the portal the drawer's "fixed inset-0" overlay collapsed to the header's own ~52px box
  instead of the viewport (ADR-0103's 2026-08-28 amendment). `src/lib/help/help-context.ts`'s
  `resolveHelpContextId()` maps the current route to a `HelpContextId`/docs target; add new
  contexts there, not via ad hoc string matching in components. The Help button lives in
  `top-context-bar.tsx`; the command palette's "Help" entry (`src/lib/commands/registry.ts`)
  opens full docs instead, since the palette's `CommandDefinition` only supports href-based
  navigation.
- **CSP for the embed**: `src/lib/security/csp.ts`'s `getContentSecurityPolicy(pathname)` sets
  `frame-ancestors 'self'` (and `X-Frame-Options: SAMEORIGIN`) only for `/docs/**` responses, so
  the Help drawer's iframe can render them — every other route keeps `frame-ancestors 'none'`
  (`X-Frame-Options: DENY`), its existing clickjacking protection. Do not widen this beyond
  `/docs/**` or change `'self'` to a wildcard.
- **Documentation dataset**: `scripts/seed-docs-dataset.ts` (+ `seed-docs-scenarios.ts`) seeds a
  dedicated, distinct-from-E2E-fixtures Fjordvik FK universe (`npm run db:seed:docs`, requires
  `MATCHBOARD_ENV=test`). Derived state (draft selections, finalized history, evidence) is
  produced by calling the real domain operations (`generateMatchRound`, `finalizeMatchRound`,
  `completeReport`, `rebuildActualTimeline`, `generateEventSquads`), not by hand-inserting rows
  that merely resemble their output. Its dates are anchored to real "now" (not a fixed calendar
  date) so the League season reads as genuinely current — there is no server-side "frozen time"
  seam, and one must not be added without a new ADR (PROGRAMME.md §10.2 deliberately rejected
  rewriting broad domain time handling for screenshots).
- **Screenshots**: `scripts/docs-screenshots.ts` (`npm run docs:screenshots`, optionally
  `-- --id <scenario-id>`) is a standalone Playwright capture runner — deliberately separate
  from `e2e/*.spec.ts`, never run through the `@playwright/test` runner, so it can never affect
  Browser Acceptance Tests. It authenticates via the same Auth.js test-agent flow as
  `e2e/auth.setup.ts`, refuses any non-local base URL, and writes to
  `public/docs/screenshots/**`. These are documentation content assets
  (`page.screenshot()`), never `expect(page).toHaveScreenshot()` visual-regression baselines —
  do not add exact pixel/byte comparison to `npm run validate` for them.

### User documentation files

| File | Purpose |
|------|---------|
| `content/docs/**/*.mdx` | Canonical documentation content (public site and in-app Help share this one source) |
| `src/lib/docs/source.ts` | Fumadocs content source/loader (`defineDocs` + `loader`) |
| `src/app/docs/[[...slug]]/layout.tsx` | Public docs shell: `RootProvider` + `DocsLayout` (full site) or a bare `RootProvider` (`/docs/embed/**`, no DocsLayout chrome), forced dark theme. Lives at the `[[...slug]]` segment (not `docs/layout.tsx`) so it can read `params.slug` |
| `src/app/docs/docs.css` | Docs-only Tailwind/Fumadocs theme, scoped to the `/docs` route segment |
| `src/app/docs/[[...slug]]/page.tsx` | Renders one docs page from the loader; strips a leading `embed` slug segment and trims TOC/breadcrumb/footer chrome for `/docs/embed/**` |
| `src/app/docs/[[...slug]]/embed-link.tsx` | Rewrites `/docs/**` cross-links in MDX prose to `/docs/embed/**` when rendered in embed mode |
| `src/app/api/search/route.ts` | Public docs search (`fumadocs-core/search/server`, self-hosted) |
| `src/lib/help/help-context.ts` | `HelpContextId` registry: route → docs target mapping |
| `src/components/shell/help-drawer.tsx` | In-app Help drawer (`HelpDrawer`) and its trigger button (`HelpButton`) |
| `scripts/seed-docs-dataset.ts`, `scripts/seed-docs-scenarios.ts` | Fjordvik FK documentation dataset seed |
| `scripts/docs-screenshots.ts` | Standalone Playwright documentation screenshot generator |
| `public/docs/screenshots/**` | Committed documentation screenshot assets |
| `scripts/check-docs.mjs` | Documentation integrity validation (part of `npm run validate`) |

### Maintenance rule (mandatory)

**A user-facing behaviour change must update the affected `content/docs/**/*.mdx` page(s) and
regenerate any documentation screenshot the change makes inaccurate, in the same change.** This
follows the same "documentation alignment is mandatory" principle as `AGENTS.md`/
`features/matchboard.feature`/ADRs elsewhere in this file — public docs and in-app Help are
supporting documentation, not optional.

- Changed selection/workflow/domain behaviour → update the relevant page(s) under
  `content/docs/`.
- Changed UI that appears in a committed screenshot → regenerate it with
  `npm run db:seed:docs && npm run docs:screenshots -- --id <affected-scenario-id>` (or with no
  `--id` to regenerate everything) and review the new image as content before committing it
  (DECISIONS.md D23 — generation is automatic, acceptance is not).
- New primary user-facing capability → add or extend a page under `content/docs/`; do not leave
  a shipped capability undocumented.
- Removed/renamed capability → update or remove the affected page(s); `node scripts/check-docs.mjs`
  (part of `npm run validate`) fails on a broken internal `/docs/**` link, a missing referenced
  screenshot, or an orphaned screenshot asset, but it cannot detect stale *prose* — that is a
  human/agent review responsibility every time behaviour changes.
- New authenticated route or feature shell that deserves a contextual Help entry → add a
  `HelpContextId` and route-prefix mapping in `src/lib/help/help-context.ts`, not inline string
  matching elsewhere.

## Standing engineering policy

Every change request in this repository must satisfy these requirements, even when not explicitly requested.

### Documentation alignment is mandatory

Every product/code change must update relevant supporting documents when affected. This includes, where applicable: README, feature files, architecture notes, ADRs, agent instructions, setup/development docs, domain model docs, workflow docs, migration docs, and brand/assets docs.

A request does not need to mention documentation. Documentation alignment is part of the task.

Rules:
- Implemented behavior: document as current.
- Partial behavior: document as partial.
- Future idea: document as future/roadmap only if the repo has a deliberate place for it.
- Removed behavior: remove or rewrite stale docs.

### Version management is mandatory

Every substantive Matchboard change must include a version-impact assessment before completion. If the change is releasable product/platform work, increment the canonical application version exactly once according to `docs/VERSIONING.md`. Matchboard remains in the `0.x.y` range until the product owner explicitly authorises `1.0.0`.

Canonical version source: `package.json` → `version`. All other consumers derive from this value.

Version bump commands:
- `npm run version:patch` — PATCH increment (0.x.y → 0.x.(y+1))
- `npm run version:minor` — MINOR increment (0.x.y → 0.(x+1).0)

These update `package.json`, `src/lib/version/index.ts`, and `package-lock.json`. They do NOT create commits, tags, or releases.

Classification:
- **Minor**: new feature, new workflow, new domain concept, breaking pre-1.0 change, significant behaviour change, schema change with new product capability.
- **Patch**: bug fix, security hardening, performance improvement, routing fix, UI correction, accessibility fix, test improvement, dependency upgrade, internal refactoring, small UX refinement, tooling/CI change.
- **None**: typo-only docs, comment-only changes, formatting, purely explanatory ADR/documentation.

Mixed change sets use the highest applicable increment. One bump per change set, not per commit.

Coding-agent completion workflow:
1. Determine the current version from `package.json`.
2. Classify the change set as `none`, `patch`, or `minor`.
3. Apply exactly one version bump if needed using `npm run version:patch` or `npm run version:minor`.
4. Run the normal validation/tests.
5. Report the previous and new versions in the completion summary.

CI validates version format, pre-1.0 guard, and `package.json`/module consistency via `npm run version:verify`.

### Quality checks must pass before completion

Every change must leave the repo in a clean state. Pre-existing failures are not acceptable just because the current change did not introduce them.

Required before completion:
- `npm run lint` passes
- `npm run typecheck` passes
- `npm test` passes
- `npm run build` passes
- `npm run version:verify` passes

If a check cannot run, document why.

### Cleanup is mandatory

Every change must include a small cleanup pass. Remove or update:
- dead code
- stale components
- unused functions
- unused imports
- obsolete docs
- stale feature notes
- obsolete ADR references
- stale generated files
- unused assets
- unused test fixtures
- obsolete local scripts
- stale DB seed data or migration references where safe

Do not remove runtime-needed files. Do not delete data/migrations blindly. If cleanup is unsafe, leave a short note explaining why.

### Repository hygiene

Before finalizing any change, run:
- `git status --short`
- `git ls-files --others --exclude-standard`
- `git ls-files --ignored --exclude-standard`

Check for: meaningful files not tracked, generated junk accidentally tracked, local files that should be ignored, runtime assets missing from git, docs/assets that should not be committed. Update `.gitignore` when appropriate.

### For every Matchboard change

1. Inspect current app/repo state before editing.
2. Implement the requested behavior.
3. Update supporting docs affected by the behavior.
4. Update or add ADRs only for meaningful architecture decisions.
5. Remove dead/stale code, docs, assets, fixtures, and references.
6. Fix lint/type/test/build failures, including pre-existing ones.
7. Verify git tracked/untracked/ignored files.
8. Ensure no local/generated junk is committed.
9. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
10. Report what changed and what was cleaned up.

### README maintenance

The root README is part of the definition of done. Before completing any implementation task, compare the resulting application, architecture, development workflow, deployment model and supported operations against `README.md`. Update it whenever the implementation changes what is currently true. Never leave README describing superseded behavior as current behavior.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
