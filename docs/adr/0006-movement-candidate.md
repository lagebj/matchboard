---
type: ADR
id: "0006"
title: MovementCandidate — temporary player-specific movement suitability
status: active
date: 2026-06-01
supersedes:
supededed_by:
tags: [domain-model, selection-engine, storage-model]
---

## Context

Matchboard has RotationPath (permitted movement direction) and match selection (concrete fixture decision), but no concept of player-specific candidate suitability for movement. RotationPath answers "Is movement allowed?" but not "Which specific players are currently reasonable candidates for that movement?"

Without MovementCandidate, coaches cannot express which players they consider suitable for specific movement paths. The selection engine treats all eligible players on a rotation path equally, which can lead to less appropriate automatic selections that require more manual correction.

## Decision

Add a new domain entity `MovementCandidate` — a temporary, coach-facing relationship between a player and a rotation path with a specific role (SUPPORT or DEVELOPMENT) and a structured rationale.

Key design decisions:

1. **MovementCandidate links to RotationPath, not directly to teams.** This preserves the existing hierarchy: core team = belonging, rotation path = permitted movement direction, movement candidate = current suitability.

2. **Candidate status is temporary and reviewable.** ACTIVE/PAUSED status with optional `reviewBy` date prevents drift. No permanent labels.

3. **Candidates are preferred, not required.** The selection engine prefers active candidates when generating non-core selections but falls back to any eligible player on the rotation path if no candidates exist or are exhausted. This prevents the feature from becoming a hidden ranking gate.

4. **Manual override remains possible.** Selecting a non-candidate player for non-core movement requires an override reason but is not blocked. The app supports judgement, not rigid gatekeeping.

5. **Drift detection is informational.** Stale, unreviewed, or one-directional patterns surface as Planning notes, not Blocked or Decision required conditions.

6. **Language is neutral and observable.** Rationale categories describe context (challenge_exposure, stabilise_team_function), not player identity. Never "weak player", "strong player", "promoted", "demoted".

7. **No numeric scores, skill levels, or automatic inference.** Candidates are coach-created and coach-reviewed only. Never auto-generated from match history or stats.

## Alternatives considered

- Option 1: Extend RotationPath with player lists (breaks single-path-for-role model, mixes movement authorisation with player suitability)
- Option 2: Use existing `supportSuitability`/`developmentReadiness` player attributes (these are per-player global flags, not path-specific, and don't capture the rotation path relationship)
- Option 3: No new entity — just improve the engine scoring (doesn't give coaches explicit control or reviewability)

## Consequences

- Positive: Coaches gain explicit, reviewable control over which players are considered for specific movement paths
- Positive: Selection engine can prefer candidates without blocking non-candidate players
- Positive: Drift detection helps coaches review stale or problematic patterns early
- Positive: Clear separation: RotationPath = permission, MovementCandidate = suitability
- Negative: New data model, migration, UI, and engine integration add complexity
- Negative: Coaches must create and maintain candidate records (additional workflow step)
- Neutral trade-offs: Candidate preference in generation may change automatic selection outcomes; coaches should review after introducing candidates