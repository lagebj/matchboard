# Matchboard Documentation

## What lives where

| Area | Owns | Status |
|------|------|--------|
| `adr/` | Architecture Decision Records — append-only decision history. New ADRs supersede old ones. Never modify existing ADRs. | Active |
| `admin/` | Admin-facing operational guides (policy management, deployment). | Active |
| `development/` | Developer workflow documents (coding-agent sessions, contribution rules). | Active |
| `domain/` | Canonical domain concepts: source-of-truth register, selection explainability, terminology. These documents define what the system *is*, not how to build it. | Active |
| `policies/` | Selection policy system documentation: architecture, rule migration inventory, Rego/Wasm pipeline, configuration. `README.md` is the primary policy reference. | Active |
| `product/` | Product-level framing: navigation model, manager workflow. These define user-facing concepts, not implementation details. | Active |

## Source authority (what wins when documents disagree)

1. **AGENTS.md** (project root) — the single authoritative source for domain rules, vocabulary, workflow, UI architecture, and selection engine boundaries.
2. **Feature file** (`features/matchboard.feature`) — the behavioral source of truth for selection rules, domain behavior, and expected outcomes.
3. **Domain docs** (`docs/domain/`) — canonical definitions of domain concepts (source-of-truth register, explainability, terminology).
4. **ADRs** (`docs/adr/`) — architectural decisions that are binding until superseded by a newer ADR.
5. **Product docs** (`docs/product/`) — user-facing framing. Overridden by AGENTS.md and feature file if they disagree.
6. **Policy docs** (`docs/policies/`) — policy system reference. Overridden by ADRs and implementation if they disagree.
7. **Admin docs** (`docs/admin/`) — operational guides. Overridden by policy docs and ADRs if they disagree.
8. **Development docs** (`docs/development/`) — workflow rules. Never override domain or product authority.

If code, schema, tests, AGENTS.md, and the feature file disagree, fix the mismatch. If two docs disagree, the higher-authority source wins.

## What does NOT belong here

- **Implementation plans** — Temporary planning documents for in-flight work do not belong in committed docs. Delete them when the work is done. If a planning document contained durable conclusions, fold those conclusions into AGENTS.md, the feature file, domain docs, or an ADR before deleting the plan.
- **Completed specs** — Spec files for already-implemented features should be deleted after implementation. Durable conclusions belong in canonical sources, not in spec archives.
- **UX workflow drafts** — One-time design drafts that have been implemented and superseded by AGENTS.md should be deleted.
- **Audit checklists** — One-time audit documents (branding, graphics) should be deleted after completion.
- **Scratch notes** — Never commit scratch notes, handover documents, or temporary planning files.

## ADRs

ADRs in `docs/adr/` preserve architectural decisions and their supersession history. They are append-only: never modify an existing ADR, only add new ones or create superseding ADRs. Read relevant ADRs before making structural code changes.

ADR numbering follows the pattern `NNNN-short-title.md`. See `docs/adr/README.md` for ADR rules.