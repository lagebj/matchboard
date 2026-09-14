# Data architecture and operations

This module covers persistence, schema, deployment assumptions, and operational boundaries.

## Production and persistence posture

Matchboard is deployed through Vercel and persists data in Neon PostgreSQL. The project keeps production and archived history separate from local-only development state. Production migrations and schema changes must follow the repository's safety rules and migration workflow.

## Architecture constraints

- One business operation should have one owning implementation; adapters should not independently implement the same domain logic.
- Do not silently duplicate or bypass the canonical backend/service layers.
- Auth and authorization rely on server-side trusted context; client-supplied IDs or route values are never authority.
- Schemas and migration changes should be paired with the code that relies on the new shape.

## Live match operation sequencing

For live match reporting, the Cloudflare Durable Object coordinator is the only normal
canonical-ordering authority for new operations; Neon persists the resulting canonical events
as the durable system of record. Production sequence backfills and diagnostic tooling
(`check:live-diagnostics`, `backfill-live-event-sequence`) are explicit, opt-in maintainer
actions — they never run automatically. See `docs/development/live-match-realtime.md`.

## Change hygiene

When a task changes architecture, schema, deployment, or provider state, capture the durable rule in the relevant ADR or architecture notes. Remove stale artifacts and ensure the docs, implementation, and feature file are aligned.

## Relevant references

- `features/matchboard.feature`
- `SECURITY.md`
- `docs/development/coding-agent-working-session.md`
- active ADRs and operational docs under `docs/adr/` and `docs/arr/`
