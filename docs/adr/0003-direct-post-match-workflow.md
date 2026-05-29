---
type: ADR
id: "0003"
title: Post-match reporting is a direct workflow with single completion action
status: active
date: 2026-05-29
supersedes:
superseded_by:
tags: [workflow, post-match, reporting]
---

## Context

The current post-match workflow requires multiple sequential actions: navigate to "After match" tab → click "Open post-match report" → click "Seed from plan" → edit attendance → click "Submit report" (DRAFT→REPORTED) → click "Lock report" (REPORTED→LOCKED). This is 6+ clicks for a routine task.

The submit-then-lock two-step sequence has no routine value — the coach always wants to complete the report, not leave it in an intermediate REPORTED state. REPORTED was designed as a checkpoint before final locking, but in practice it creates friction without adding safety because completion validation already checks all required inputs.

The feedback player selector currently uses planned squad selections, not actual participants. This means players who didn't play can receive feedback, and manually added matchday participants cannot.

## Decision

1. **After match is direct**: Selecting "After match" must open or create the working report directly. When no report exists and a finalised squad exists, one action seeds the draft from the planned squad automatically. No separate "Open post-match report" or "Seed from plan" step is required.

2. **One completion action**: Replace the visible Submit+Lock sequence with a single "Complete report" action that validates all required inputs and transitions the report to the final completed state (LOCKED). The REPORTED status remains in the schema for backward compatibility but is not a normal routine user step.

3. **Feedback uses actual participants**: Post-match feedback player selection must be derived from actual participants with `attendanceStatus = PRESENT`, not from the planned squad. This includes manually added matchday participants and excludes players recorded as "Did not play".

4. **Orphan feedback prevention**: Removing a player from actual participation who has draft feedback must either require confirmation or remove the feedback transactionally. Feedback must not remain attached to a non-participant.

5. **Legacy completed states remain readable**: Existing REPORTED and LOCKED records continue to be included in statistics and results. No destructive migration is required.

## Alternatives considered

- Option 1: Keep Submit+Lock as two steps — rejected because the coach always completes the report; the intermediate state adds routine friction without safety value
- Option 2: Auto-advance REPORTED→LOCKED — rejected because it hides the transition and creates confusion about what "Submit" does
- Option 3: Keep feedback based on planned squad — rejected because feedback should reflect actual match reality, not plan

## Consequences

- Positive: 6+ clicks reduced to 2 (After match → Complete report)
- Positive: Feedback reflects actual participation
- Positive: No orphan feedback after participant correction
- Negative: REPORTED status becomes a non-routine state, may confuse future developers
- Negative: Existing tests that test Submit then Lock separately need updating
- Neutral trade-offs: LOCKED is the new default completed state for new reports

## Re-evaluation triggers

- If REPORTED status gains a practical workflow purpose (e.g. peer review before locking)
- If feedback needs to include non-participants for a specific coaching purpose