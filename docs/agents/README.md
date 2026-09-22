# Matchboard agent reference index

This directory contains the detailed Matchboard product, domain, security, and architecture guidance that used to live inline in the repository root `AGENTS.md`.

Read this file before planning or changing code in a domain area. Then load only the relevant reference modules for the task.

## Required read order

1. Root `AGENTS.md`
2. `docs/development/coding-agent-working-session.md`
3. The relevant module(s) below
4. Canonical sources when behavior changes: `features/matchboard.feature`, `SECURITY.md`, `docs/adr/`, `docs/arr/`, and affected terminology docs

## Module map

- `product-operating-model.md` — Matchboard product boundary, season workflow, canonical routes, and the operating model that keeps product behavior coherent.
- `coaching-domain-model.md` — teams, players, matchday responsibilities, readiness signals, presence/absence, and learning expectations.
- `selection-planning-and-fairness.md` — selection engine behavior, positional rules, fairness, movement ledger, draft generation, and plan-integrity signals.
- `event-and-league-behavior.md` — league seasons, rounds, events, match status, and squad planning parity.
- `ux-and-terminology.md` — UX composition, navigation, Touchline rules, PWA constraints, product language, and in-app documentation expectations.
- `security-privacy-and-tenancy.md` — authn/authz boundaries, tenant isolation, provider configuration, secret handling, and security review requirements.
- `data-architecture-and-operations.md` — persistence, schema constraints, deployment assumptions, provider actions, and architectural boundaries.
- `testing-and-quality.md` — validation commands, documentation alignment, cleanup, and the quality bar before completion.

## How to use this folder

- Do not load every module into every session.
- Load only the modules triggered by the affected domain:
  - selection and planning → `selection-planning-and-fairness.md`
  - player/team/coach workflow → `coaching-domain-model.md`
  - events, fixtures, rounds, leagues → `event-and-league-behavior.md`
  - UI, navigation, PWA, terminology → `ux-and-terminology.md`
  - auth, privacy, tenancy, provider config → `security-privacy-and-tenancy.md`
  - schema, storage, migration, deployment → `data-architecture-and-operations.md`
  - validation and cleanup → `testing-and-quality.md`
- Keep this index as the canonical entry point; do not reintroduce giant `@` imports of large documents into auto-loaded instruction files.

## Canonical references

- `features/matchboard.feature` — behavioral source of truth for domain rules and expected outcomes.
- `docs/adr/` — durable design decisions and active architecture decisions.
- `docs/arr/` — verified structural mismatches and implementation residue that still needs explicit handling.
- `SECURITY.md` — security posture, app controls, and provider guidance.
- `security/README.md` — the AI credential broker subsystem (converged from `matchboard-security`,
  ADR-0150): components, trust boundaries, credential lifecycle, and deployment model.
- `docs/domain/terminology.md` and adjacent glossary docs — approved product vocabulary.
- `docs/VERSIONING.md` (ADR-0059) — mandatory application version-bump classification and workflow; see `docs/development/coding-agent-working-session.md`'s "Version management" section.

If a task changes behavior, schema, security posture, or UX semantics, update the relevant files together and keep them aligned before completion.
