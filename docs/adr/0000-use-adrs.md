---
type: ADR
id: "0000"
title: Use ADRs for architectural decisions
status: active
date: 2026-05-29
supersedes:
superseded_by:
tags: [process]
---

## Context

Matchboard needs a way to record architecturally significant decisions so that future work does not silently contradict them.

## Decision

Store architectural decisions in `docs/adr/` as append-only records. Each ADR covers one decision, has a unique numeric ID, and is never rewritten except for typo fixes. New ADRs may supersede old ones.

## Alternatives considered

- Option 1: No formal ADR process (decisions live only in code comments and AGENTS.md — easily forgotten or contradicted)
- Option 2: External wiki (not version-controlled alongside code)

## Consequences

- Positive: Decisions are discoverable, traceable, and enforceable across sessions
- Negative: Requires discipline to create ADRs before architecture-affecting changes
- Neutral trade-offs: ADRs are lightweight records, not full design documents