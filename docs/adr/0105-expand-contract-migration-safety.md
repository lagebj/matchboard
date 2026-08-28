# ADR-0105: Expand/contract discipline for schema-changing PRs

## Status

Accepted

## Context

Matchboard's deploy and migration pipelines are deliberately decoupled:

- Vercel's Git integration auto-deploys new application code to Production the moment a push to
  `main` builds successfully — this is not gated on any GitHub Actions workflow.
- `production-db-migrate.yml` (ADR-0084) applies a pending migration only after CI succeeds
  *and* a human approves via the `production-db` GitHub Environment's required-reviewer
  protection rule. That approval can take minutes, hours, or longer.
- The equivalent Test pipeline (`test-db-migrate.yml`) has no approval gate by design (disposable
  data), but still runs asynchronously relative to Vercel's own deploy of `matchboard-test`.

This means a PR that adds a migration and, in the same change, deploys code that assumes the
migration has already applied, creates a live window — from the moment Vercel finishes deploying
until a human approves the production migration — where the new code queries a column/table
shape that does not yet exist in the production database.

This is not hypothetical. It reproduced concretely against the Test pipeline: between
2026-08-23 and 2026-08-28, Vercel's runtime error log for the `matchboard-test` project recorded
708 occurrences of `PrismaClientKnownRequestError` (P2022, `ColumnNotFound`) on `MatchRound`
queries, traced to exactly this class of ordering gap (see the `test-db-migrate.yml` header
comment and `docs/adr/0075`'s History for the full incident). One concrete effect of that
specific incident: `/o/[orgSlug]/rounds` threw on every request while the gap persisted,
surfacing as a recurring, initially-misdiagnosed-as-flaky E2E failure across multiple unrelated
PRs (fixed defensively — page-level error isolation — in the same change that investigated this
ADR's subject; see that PR).

Production has the identical structural gap, and — because production migrations require human
approval that can be delayed arbitrarily — a materially longer exposure window than Test's
already-demonstrated incident.

No existing ADR addresses this. ADR-0084 built the approval-gated production migration pipeline
itself but did not consider Vercel's independent, ungated deploy of the corresponding code.

## Decision

**Every PR that changes `prisma/schema.prisma` in a way that is not purely additive-and-optional
must be split so that the code deployed alongside the migration tolerates the database *before*
that migration has applied.** Concretely, using the standard expand/contract pattern:

1. **Expand**: the migration only adds new, nullable/optional structure (a new nullable column,
   a new table, a new enum value additive to an existing enum). Code deployed in the same PR (or
   before the migration is confirmed applied) must read the new structure defensively — treat it
   as possibly absent (`?? null` / optional chaining), never assume it is already populated or
   even present.
2. **Confirm**: the migration is verified applied (CI's `migration-upgrade-from-populated-state`
   job, ADR-0090, already does this pre-merge against a realistic populated-data fork; the
   production approval step confirms it for production specifically).
3. **Contract**: a *later* PR may then deploy code that requires the new structure
   unconditionally, and/or a further migration that drops old structure the code no longer
   needs.

This is the standard technique used by any team running continuous deployment against a
separately-migrated database — it needs no new infrastructure, and it applies whether or not the
deploy/migration ordering gap above is ever closed structurally. It is documented here as a
mandatory rule (AGENTS.md) rather than left as an ambient best practice, because a schema change
authored by a coding agent (this repository's default mode of change) has no other builtin
reason to consider ordering — a schema-plus-code diff that looks internally consistent as a
single unit is exactly the shape that reproduces this failure.

### What is NOT required to follow this pattern

- Additive-only migrations where the code change tolerates the field being null/absent
  (Matchboard's existing convention for most new optional columns already does this — see e.g.
  `Event.breakDurationMinutes`, `EventSquad.*Override` fields, all nullable with `?? event.X`
  fallbacks) need no special sequencing; a nullable column with defensive read code is safe
  regardless of which lands first.
- Migrations with no corresponding code change (a backfill, an index, a constraint tightening
  that the existing code already satisfies).
- Purely additive enum values consumed by code that already handles "unknown value" gracefully.

### What DOES require this pattern

- A new required (non-nullable, no default) column that code immediately treats as always
  present.
- A column rename or type change (the old and new names/types cannot both be satisfied by one
  piece of code without a transition step).
- Dropping a column or table still read by currently-deployed code.
- Any migration where a query added in the same PR would `P2022`/similarly fail against the
  pre-migration schema.

## Alternatives considered

**Gate Vercel's Production deploy on the migration pipeline (including human approval)
succeeding first**, e.g. by disabling Vercel's automatic production alias on push and having
`production-db-migrate.yml` trigger `vercel deploy --prod`/`vercel promote` only after its
`migrate` job (or a no-op-pending confirmation) completes. This would close the ordering gap
structurally rather than relying on every future change following a discipline. Not adopted now:
it changes Vercel project configuration and production release topology, and — because
production migrations require a human approval step that can be delayed indefinitely — would tie
every release containing a pending migration (including unrelated changes bundled in the same
push) to that approval's timing, a real release-velocity cost. Deliberately deferred rather than
rejected outright: revisit if this pattern-based mitigation proves insufficient in practice (e.g.
a future incident where the discipline was followed correctly but the gap still caused harm, or
where the discipline is repeatedly not followed).

## Consequences

- Schema-changing PRs require more deliberate sequencing thought than before; a genuinely
  required non-nullable column with an immediate hard dependency now needs at least two PRs
  (expand, then contract) instead of one.
- Does not eliminate the underlying deploy/migration ordering gap — a mistake (an agent or
  engineer skipping this discipline) can still reproduce the same class of incident. This is an
  accepted, explicit trade-off (see "Alternatives considered").
- No infrastructure, Vercel configuration, or CI workflow changes required.

## Migration

No code migration. `AGENTS.md`'s "Production migrations" section gains a cross-reference to this
ADR and a summary of the rule.

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-28

Record created, following investigation of a recurring Test-slot E2E flake that reproduced this
exact failure mode concretely (708 P2022 errors against `matchboard-test`, 2026-08-23→08-28).
