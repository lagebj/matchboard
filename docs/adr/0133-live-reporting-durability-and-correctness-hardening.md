# ADR-0133: Live reporting durability and correctness hardening

## Status

Accepted (programme — delivered incrementally; see "Delivery" below)

## Context

On 2026-09-09, a real League match (Rød away v Drammens BK, KO 17:30 CEST) was live-reported
in production and the experience broke coach trust. Full forensic analysis (production Neon +
Cloudflare account analytics; incident window 15:18–16:36 UTC):

| # | Symptom | Confirmed root cause |
|---|---------|----------------------|
| S1 | No "Live reporting" button on the match — coach had to hand-type `/live` | `match-detail.tsx` gates the button on `isMatchFinalized(selections)` (every `Selection` row `FINALIZED`). The round was still `DRAFT` and the match's selections only became `FINALIZED` at 15:18:56 — **because starting the session force-captured the planning baseline**. Chicken-and-egg: no visible way in before the session exists. |
| S2 / S4 | Goals disappeared / reset on screen during reporting, both teams | **218 WebSocket connections in ~64 min, 100 % ended `clientDisconnected`, median connection lifetime ~53 s** (Cloudflare). The DO itself was healthy (1081 RPCs, 0 errors). On every reconnect the client resyncs to the DO snapshot, which lags events written via the HTTP fallback and never learns about goals written directly to Neon → goals blink out. Two `EVENT_REVERSED` rows show the coach fighting the UI. |
| S3 | F5 reset the clock to "Start First Half" | `LiveMatchSession` persists **no clock/period state** (only `status`, `startedAt`, `lastHeartbeatAt`). At ~16:19 UTC the coach refreshed; period reset to `0`; four goals were recorded at `period = 0, matchSeconds = 0`; the coach then clicked Start-1st → End-1st → Start-2nd within **1.3 s** to recover. `MATCH_END` was logged at a nonsense `period = 7`. |
| S5 | After-match report was not populated by the live score | `seedReportFromLiveSession()` (`report-mutations.ts:183`) **bails to a no-op the instant any `PostMatchReport` row exists** — it does not merge live-derived goals/assists/attendance/rotations. A DRAFT report had been created at 15:02:09 (16 min before the session — almost certainly by pre-match `markMatchAbsence()` for the `NO_SHOW` player, which calls `seedReportFromFinalizedSquad()`). Result: **8 `Goal` rows hand-typed at 19:53 CEST**, `minute = NULL`; **0 `Assist` rows** (7 live `ASSIST_SET` events lost); **0 `MatchRotation` rows** (26 live rotation events lost). |
| S6 / S7 | "Start live reporting" showed on Today long after kickoff, and *after* the report was LOCKED | `get-assistant-command-centre.ts` emits `live_report_available` for any today-match with a finalized squad and **no *ACTIVE* session** — it never checks for an `ENDED` session or a `REPORTED`/`LOCKED` report. Here both are true (`ENDED` 16:36, `LOCKED` 17:58) and the item still showed. The today-window also uses server-UTC midnight (`setHours(0,…)`), so a late-evening / early-hours CEST match is mis-bucketed relative to the coach's actual day. |
| — | Evidence layer for the match is garbage | `matchSeconds` stores **milliseconds** (a goal 3m29s in → `matchSeconds = 209529`), ~1000× on every event. `PostMatchLearningRun` recorded `combinations: SKIPPED — INSUFFICIENT_POSITION_DATA`; the 7 `ActualPositionInterval` rows all have `startedAtMs = 0, endedAtMs = null`. `wallClockTime` on each event *is* correct, so the data is recoverable — nothing reads it. |

Neon compute for the production branch was **up continuously 15:12–16:33 UTC** — this was not an
infrastructure outage. 68 `LiveMatchEvent` rows *did* persist. Every failure above is
application-level.

## Decision

Treat live reporting as a **durability-critical** subsystem and harden it in that order:
correctness of the coach-visible outcome first, then the realtime transport.

### Invariants (new)

1. **A live session's canonical output must always reach the report.** Finishing live reporting
   reconciles the session's events into the match's `PostMatchReport` (goals, assists,
   attendance, rotations) **whether or not a DRAFT report already exists**. It refuses only when
   the report is already `REPORTED`/`LOCKED` (a completed report is corrected via the existing
   reopen flow, not silently overwritten).
2. **In-match clock/period state is persisted.** A reload, a device swap, or a reconnect
   reconstructs the same period and elapsed time deterministically from the server, never
   "Start First Half".
3. **`matchSeconds` has one documented unit** and every writer and reader agrees on it;
   reconstruction falls back to `wallClockTime` + `PERIOD_START` when `matchSeconds` is absent
   or implausible.
4. **The realtime snapshot may never regress canonical state.** On reconnect the client
   reconciles the DO snapshot *against* its own local + Neon-persisted events; an event the
   client persisted via the HTTP fallback is pushed into the DO so the DO's snapshot cannot
   drop it.
5. **A finished/reported match produces no "start live reporting" prompt.** Work-item emission
   checks session lifecycle *and* report status.
6. **There is always a visible way to start live reporting** once a match's kickoff is near or
   has passed — independent of `Selection.status`.

### Work items

| # | Change | Risk | ADR-gated? |
|---|--------|------|-----------|
| **H1** ✅ | `seedReportFromLiveSession()` **merges** into an existing DRAFT report instead of bailing: score set only when currently unset, `UNKNOWN` attendance → `PRESENT` for players who appeared, and goals/assists/fair-play/rotations seeded only for categories the report has none of yet; a `REPORTED`/`LOCKED` report is left untouched (`merged: false`). Delivered in PR following this ADR. **Still to do:** honour `EVENT_REVERSED` when deriving the score (a reversed `GOAL_FOR` still counts today); a guarded one-off remediation for the incident match's lost assists/rotations (reopen → reconcile → re-lock), on explicit maintainer go-ahead. | med (core report path) | yes — this ADR |
| **H2** ✅ | Persisted clock on `LiveMatchSession` (`clockPeriod MatchPeriod @default(BEFORE)`, `clockRunning`, `clockPeriodStartedAt DateTime?`, `clockElapsedBeforeMs Int @default(0)`, `clockUpdatedAt`). `persistLiveSessionClock()` writes it on every transition (not on the per-second tick — `clockElapsedBeforeMs` + `clockPeriodStartedAt` fully determine elapsed at any later instant); the write is **forward-only** (`isForwardClockTransition()` — a reloaded/second-device client briefly holding the fresh `BEFORE` state cannot stomp a running clock) and no-ops for a non-`ACTIVE` session. `getActiveSession()`/the pre-match package carry the clock; `LiveMatchClient` rehydrates from it on mount instead of `createInitialClockState()`. Delivered in PR following this ADR. **Still to do (folded into H6):** the Durable Object's own `clockAnchor` is initialised to `BEFORE` and never advanced — the Neon hydration above already fixes the reload symptom regardless, but the DO snapshot should advance its anchor on `PERIOD_START`. | med (expand/contract migration) | yes — this ADR |
| **H3** ✅ | The `matchSeconds` column name is a misnomer — it holds **milliseconds since period start** (written from `getElapsedMs()`), and the newer readers (`actual-timeline.ts`, `lineup-state.ts`, the realtime `CanonicalLiveEvent`) already treat it as ms. A full column rename ripples into the Vercel↔Worker wire contract and 4 models — deferred as not worth the coordinated-deploy risk. Instead: authoritative `///` doc comments on all four `matchSeconds` fields (and the separate SECONDS-domain `PlannedRotationChange.approximate/actualMatchSeconds`); fixed the three readers that assumed seconds — `estimateCurrentMatchSeconds` → `estimateCurrentMatchOffsetMs` (returns ms, prefers the H2 persisted clock; its one caller now converts ms→s only for the plan's seconds-domain `actualMatchSeconds`), `rotation-vs-actual.ts`'s minutes math (`/ 60_000`), and the live-event-stream display (`formatElapsedMs(matchSeconds)`, was `× 1000`); and `actual-timeline.ts` clamps an implausible offset (`sanitizePeriodOffsetMs`, `[0, 4h]`) so one corrupt event can't push an interval decades into the match. Deleted the dead `(app)/matches/[matchId]/live/live-client.tsx` duplicate. | med | yes — this ADR |
| **H4** | `get-assistant-command-centre.ts`: exclude `ENDED` sessions and `REPORTED`/`LOCKED` reports from `live_report_available`; widen the today-window by a fixed buffer so a near-midnight CEST match is not mis-bucketed. | low | no (plain bug fix) — **delivered with this ADR** |
| **H5** ✅ | `canStartLiveReporting()` (`src/lib/matches/can-live-report.ts`, pure + unit-tested) drives the **match detail** "Start live reporting" button: offered while a session is live, once the plan is closed (`planning_closed`) or every selection is finalized, and in the hour before kickoff (`LIVE_REPORTING_LEAD_MS`) while planning is still open — no longer gated only on `isMatchFinalized(selections)`. Hidden for cancelled / `done` / `report_incomplete` / `played` (those route through "After match"). Label switches "Start live reporting" ↔ "Live reporting". Round Board has no live entry point today — a per-match column action there is a deliberate deferral (out of scope for the incident fix; the coach reaches live via match detail). | low | no |
| **H6** | Realtime reconnect churn (218 reconnects, ~53 s median connection lifetime) and its symptoms. Split into three: | | yes — this ADR |
| **H6a** ✅ | **"Goals disappeared / reset" — the actual mechanism.** `LiveMatchClient.fetchEvents` reconciled the running score from a **20-event tail** (`getRecentEvents(matchId, 20)`), so once >20 events accumulated it dropped every earlier goal and `setGoalsFor/Against` reset the on-screen score to that under-count on every 5 s poll and every reconnect broadcast — the churn just made it fire constantly. Separately, `reconcileFromServerEvents` skipped the `EVENT_REVERSED` row (its `isReversed` flag) but not the goal it reversed (`correctsEventId`), so an undone goal never left the score. Fix: reconcile from the whole match's events (`LIVE_RECONCILE_EVENT_LIMIT = 1000`, display list still capped to 15) and honour `correctsEventId` (added to `LiveEventSummary`, populated by `getMatchEvents`/`getRecentEvents`). Client-only, no worker. Delivered in PR following this ADR. | med | |
| **H6b** ✅ | **Reduce the churn.** `RealtimeMatchClient` now sends `KEEPALIVE_PING` every 25 s while connected; the DO registers a hibernation-safe `setWebSocketAutoResponse(KEEPALIVE_PING → KEEPALIVE_PONG)` on accept so the edge answers without waking the object. After the *first* pong is seen (proving the peer supports it), the client force-closes + reconnects once `KEEPALIVE_MISSED_LIMIT` (3) intervals pass with no pong — half-open detection in ~75 s instead of "next RPC or never". Fully backward-compatible: an old DO silently drops the ping (no `id`, no reply) and the missed-pong guard never arms; an old client never sends one. Constants live in the shared `realtime/protocol.ts` (the worker already imports from it). Delivered in PR following this ADR. | med | |
| **H6c** ✅ | `advanceClockAnchor()` (`workers/live-match/src/state.ts`, pure) updates `SessionMeta.clockAnchor` on every accepted period-transition event (`MATCH_START`/`PERIOD_START` → running; `PERIOD_END`/`MATCH_END` → stopped), so a reconnecting client / Follow-Live viewer gets a real clock from the snapshot instead of a permanent `BEFORE`. Worker-only. Delivered in PR following this ADR. **Residual (documented, not scheduled):** `CanonicalLiveEvent` still carries no `correctsEventId` on the realtime wire, so `reconcileFromCanonicalEvents` (Follow-Live viewer only) cannot precisely un-count a reversed goal — a *watching* second coach may briefly see a reversed goal still in the score until the next full reconcile. The **reporter** (H6a) and the **persisted report** (H1) are both correct; this is a transient view-only inaccuracy on a secondary surface. Closing it means adding `correctsEventId` to `recordEventForActor()`'s return + the protocol type + the two DO construction sites — deferred as low-value against that surface. | med | |

### Explicitly out of scope

- Replacing the DO transport or making it the sole system of record — Neon stays canonical
  (ADR-0086), the DO stays a coordination actor.
- A per-organisation timezone model — H4's buffer is a pragmatic near-midnight fix; a real
  `Europe/Oslo`-day computation is a separate, larger change.
- Offline live reporting / service worker (ADR-0123 out-of-scope stands).

## Delivery

- **H4** shipped with this ADR (`get-assistant-command-centre.ts` guard + today-window buffer +
  regression test reproducing the incident).
- **H1** shipped in the following PR (`seedReportFromLiveSession()` merge semantics + tests).
- **H2** shipped in the following PR (persisted `LiveMatchSession` clock + rehydration + forward-only guard).
- **H3** shipped in the following PR (`matchSeconds`-is-milliseconds doc + fix the three seconds-assuming readers + `sanitizePeriodOffsetMs` clamp + dead-file cleanup).
- **H5** shipped in the following PR (`canStartLiveReporting()` + match-detail entry point).
- **H6a** shipped in the following PR (whole-match score reconcile + `correctsEventId`-aware
  reversal handling — the actual "goals disappeared" fix, client-only).
- **H6b** shipped in the following PR (WebSocket keepalive ping/pong — client + DO auto-response,
  backward-compatible).
- **H6c** shipped in the following PR (DO `clockAnchor` advancement, worker-only). The
  `correctsEventId`-on-the-realtime-wire residual above is the only open item in the programme
  and is a deliberate, documented deferral — not a gap left unmet.

**Programme status: H1–H6 complete.** The one open residual (Follow-Live viewer reversal
precision) is recorded in the H6c row above.

## Consequences

- Schema changes for H2/H3 follow ADR-0105 expand/contract.
- H1 changes the meaning of "finish live reporting" for the (common) case where a DRAFT report
  already exists — from "no-op" to "reconcile". This is the intended behaviour; the previous
  behaviour was the bug.
- `docs/development/live-match-realtime.md` and AGENTS.md's live-match sections are updated as
  each slice lands.
