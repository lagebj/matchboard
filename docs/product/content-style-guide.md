# Content Style Guide

> **Status:** Canonical for new UI copy. This document defines *how* to write visible product language. For *which words* to use, see `docs/product/glossary.md` (structured term definitions) and `docs/domain/terminology.md` (UK football word-choice rules, enforced by `npm run terminology:check`). For domain-specific "use / never use" tables (movement language, opponent language, parent-facing exports, etc.), `AGENTS.md` remains authoritative — this guide indexes them below rather than duplicating them, to avoid two sources of truth drifting apart. Consolidating those tables into this document is deferred to Phase 2.20 (design-system cleanup), not attempted here.

## UI language rules

- Nouns name objects. Verbs describe actions. Do not blur the two (e.g. a button reads "Move player," not "Player move").
- Use active voice: "Finalise the round," not "The round will be finalised."
- Use present tense: "Generates draft selections," not "Will generate draft selections."
- Prefer concrete football/product vocabulary over abstract or generic wording.
- Avoid technical/internal terminology in visible copy (enum names, internal field names, database concepts) — see `docs/product/glossary.md`'s "Internal identifiers" cross-references and `docs/domain/terminology.md`'s "Internal identifiers" section for what stays internal-only.

### Prefer concrete action verbs

Good:

- Create lineup
- Move player
- Finalise round
- Add match
- Invite coach

Avoid vague actions:

- Submit
- Execute
- Process
- Manage
- Configure
- OK

If an existing button/action label uses one of the vague verbs above, replace it with the specific domain action it performs when that surface is next touched. Do not do a blanket find-and-replace pass — see `PROGRAMME.md`'s "no giant rewrite" rule.

## Errors

Error messages should explain, when known:

1. what failed;
2. why;
3. what the user can do next.

Do not claim a cause if it is not actually known — a generic "Something went wrong" is preferable to a fabricated specific reason.

## Success feedback

Use success feedback selectively. For reversible actions, prefer an inline confirmation with Undo over a generic success toast:

```
Player moved to Blue
[Undo]
```

instead of a plain "Success" toast that gives no way back. See `PROGRAMME.md` §35 for when Undo is preferred over a confirmation dialog, and the reverse (destructive/irreversible/historically-significant actions still need real confirmation, not Undo).

## Empty states

Every meaningful empty state should answer three questions:

- What this area represents.
- Why it is empty.
- What can be done about it.

Example:

```
No matches in this round

Add a match to start planning the round.

[Add match]
```

## Disallowed language — index of existing canonical tables

The following domain-specific "use / never use" tables already exist in `AGENTS.md` and remain authoritative there. This is an index, not a copy — check the linked section directly, since these lists are maintained alongside the behavioural rules they support:

- **Movement and role language** (Sent as support vs. Demoted, Development movement vs. Promoted, Squad repair vs. Backfill, etc.) — `AGENTS.md` § "Domain language for movement and roles."
- **Opponent/encounter language** (Opponent team vs. Bad team, Post-match observation vs. Opponent evaluation, Fair Play concern vs. Red flag, etc.) — `AGENTS.md` § "Opponent teams and encounter observations" → "Required user-facing terminology for opponent features."
- **Coach-facing vs. parent-facing language** (what may/must never appear in parent exports: no "low readiness," "support burden," "confidence rebuild," etc.) — `AGENTS.md` § "Coach-facing vs parent-facing language."
- **Event product language** (Event squad vs. Temporary team, Competitive squad vs. A team, Not rated vs. Unrated, etc.) — `AGENTS.md` § "Event squad planning" → "Product language."
- **Prohibited navigation/product copy** (command center, decision inbox, workspace, entity, etc.) — `AGENTS.md` § "Prohibited copy."
- **Status vocabulary** (exactly: Not generated, Draft, Blocked, Ready, Finalized/Finalised) — `AGENTS.md` § "Status vocabulary."
- **Feedback language** (never: lazy, selfish, bad attitude, weak player, etc.) — `AGENTS.md` § "Post-match reflection and feedback."

When writing new copy, check both this guide's general rules above and the relevant domain-specific table linked here before shipping visible text.
