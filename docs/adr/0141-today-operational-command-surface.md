# ADR-0141: Today operational command surface, coordinated inline recommendations, and browser-local revisit state

## Status

Accepted

## Context

Today already aggregates a large part of Matchboard's operational state, but its current presentation still exposes several important facts as dashboard summaries and repeated counts. A coach can be told that two decisions are required without seeing enough information to understand or resolve the two decisions.

Matchboard already owns stronger underlying domain data:

- raw round plan-integrity signals;
- deterministic Round Board assignment context;
- squad targets and current selections;
- rotation paths and automatic movement roles;
- current player availability;
- situational projection;
- match/report lifecycle state;
- persisted canonical live-match events and clock state;
- weekly coaching context;
- recent-match presentation.

The route should use those facts without inventing a new decision engine.

The Touchline direction also requires operational workbenches to avoid dashboard tile soup and to keep one dominant current action while providing sufficient context for coach judgement.

## Decision

Today becomes a situational operational command surface.

### Explicit decisions

Raw unresolved plan-integrity obligations are rendered as concrete coach decisions. Aggregate `N decisions required` summaries may support headings but do not replace the actual signal rows.

### Inline assignment recommendation

For `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY`, Today may offer an inline player-to-match assignment only when the current recommendation is deterministic and can be applied through the existing selection domain without an override or additional coach judgement.

The recommendation reuses canonical Round Board assignment context, current squad targets/counts, current availability, rotation paths and automatic movement-role derivation.

No AI model and no new independent recommendation algorithm are introduced.

### Coordinated recommendations

When more than one player requires an assignment, Today computes recommendations sequentially against a projected planning state so one recommendation reserves the target capacity considered by later recommendations.

Projected reservations do not mutate domain state.

Each real assignment still requires one explicit coach action.

A recommendation that depends on an unapplied earlier recommendation is shown but is not directly actionable until current domain state is recomputed.

### Stale-state protection

Every direct recommendation carries a deterministic state fingerprint.

The server rebuilds the current recommendation before mutation and only applies it when player, target, role, eligibility and fingerprint still match.

The actual mutation continues through the existing selection domain owner.

### Dismiss today

Secondary non-blocking decisions can be hidden locally for the current Matchboard display date.

Dismissal is browser-local presentation state only. It does not resolve or mutate the domain obligation and automatically expires when the date or decision fingerprint changes.

Blockers and the primary Next Action cannot be dismissed.

### Since your last visit

Today may compare a compact browser-local previous snapshot with the current route state to show deterministic changes since the previous visit.

The snapshot contains identifiers and states, not names, notes, recommendation prose or free text.

This is not a persistent audit log and is not cross-device.

### Live Now

Today derives a bounded live summary from durable canonical League live-session state in Postgres.

Canonical sequenced events are reduced by the existing shared live reducer.

The persisted session clock is interpreted by existing clock helpers.

Today does not contact the realtime Durable Object and does not become another realtime client.

### Visual atmosphere

Today uses static theme-specific transparent SVG football-atmosphere assets committed with the frontend.

They are decorative and require no user-upload or object-storage capability.

The existing five-item information architecture remains unchanged.

## Consequences

Today becomes more information-rich while reducing generic dashboard summaries.

The route performs additional bounded/batched data loading for recommendation detail and durable live summary.

Direct actions are intentionally conservative. Ambiguous or override-requiring cases continue into Round Board.

Recommendation explanations are constrained to current factual data and material canonical reasons.

Browser-local dismiss and revisit state are not synchronized across devices.

No Prisma migration is required.

No external image/storage system is required.

## Alternatives rejected

### Keep count-only dashboard presentation

Rejected because it exposes obligations without helping the coach understand or resolve them.

### Create a Today-specific AI recommendation engine

Rejected because Matchboard already owns deterministic planning rules and speculative suggestions would reduce trust.

### Persist dismissals and visit history immediately

Rejected because dismissal and revisit context are presentation concerns in this phase and do not justify durable domain models.

### Apply several recommendations in one operation

Rejected because projected coordination exists to improve recommendations, not remove coach control.

### Query the realtime Worker from Today

Rejected because Postgres is the durable system of record and Today does not require realtime-subscription semantics.

### Add a generic Quick Actions section

Rejected because safe commands belong inside the decision or operational object that gives them meaning.

## Relationship

Extends ADR-0124 adaptive contextual composition.

Uses ADR-0128 structured recommendation-reason principles.

Uses canonical live architecture and sequencing decisions in ADR-0138.

Supersedes the prior Today-specific Atlas composition where this ADR differs from it.

Does not alter the five-item information architecture or other route compositions.
