---
type: ADR
id: "0004"
title: Match schedule editing preserves phase scope and round integrity
status: superseded
date: 2026-05-29
supersedes:
superseded_by: "0005"
tags: [match-editing, scheduling, integrity]
---

## Context

Matches may need rescheduling after creation due to weather, fixture changes, or organisational decisions. Currently there is no way to edit match date/time after creation. The match is tied to a MatchRound within a PlanningPeriod, and changing the date could invalidate round membership, phase scope, or existing selection integrity.

A match with a completed post-match report represents factual history that must not be casually rescheduled through normal editing.

## Decision

1. **Unplayed matches can be rescheduled**: A match without a completed post-match report (REPORTED or LOCKED) may have its date and time edited through normal match editing. Draft reports do not block rescheduling.

2. **Phase integrity**: Normal rescheduling is allowed only when the new date remains within the current Phase's date range. Moving a match outside the current phase requires the match to be moved to a phase covering the new date or the phase definition must be updated first. The app must not automatically move a match between phases.

3. **Round integrity**: When a date change leaves the match appropriately inside its current round, retain the round. When the date change crosses the app's established round boundary (e.g. different ISO week), the app must require explicit destination-round choice before save. The app must never silently change round membership or silently keep misleading round membership.

4. **Selection integrity**: Changing schedule must not regenerate or erase planned squads automatically. Existing selections are preserved, and live integrity signals are recalculated after the schedule change.

5. **Completed-match protection**: A match with a REPORTED or LOCKED post-match report must not allow date/time changes through normal editing. Historical date correction requires an explicit authorised correction workflow.

6. **Revalidation**: After a successful schedule change, revalidate /fixtures, /matches/{matchId}, affected round board routes, /assistant when active work changes, and /teams if result scope could change.

## Superseded by

ADR-0005: This ADR's point 3 (explicit destination-round choice) is superseded by ADR-0005, which replaces manual round selection with automatic Phase-scoped ISO-week round resolution. The remaining points stay active.