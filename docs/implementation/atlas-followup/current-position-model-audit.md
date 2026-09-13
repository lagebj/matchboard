# Current Position Model Audit — Atlas Follow-up Phase F0

Audit performed against `main` prior to any Atlas Follow-up implementation work. Required
contract: `.matchboard-work/matchboard_atlas_followup_roundboard_players_pitch_positions_2026-09-12/07_EVOLVING_PLAYER_POSITION_MODEL.md`.

## Headline finding

**There is one canonical source of truth (good — no dual-truth split to resolve), but zero
automatic evidence-driven mutation exists anywhere.** The evidence infrastructure the bundle
expects to "connect" (actual match positions, position-context evidence, observations) already
exists and is extensively used for *read-only/advisory presentation and scoring* — never to
mutate `Player.primaryPosition`/`secondaryPosition`/`tertiaryPosition`. This matches and
re-confirms AGENTS.md's own existing finding under ADR-0120 ("Position learning (verified, not
assumed)"): *"A repository search found no existing mechanism that automatically mutates
`Player.primaryPosition`/`secondaryPosition`/`tertiaryPosition` from evidence anywhere in this
codebase."* That statement remains true today, re-verified independently for this audit.

## 1. Canonical source of truth

`prisma/schema.prisma`, `model Player`:

```prisma
primaryPosition           String
secondaryPosition         String?
tertiaryPosition          String?
```

**No `PlayerPosition` relation model exists.** These are the only fields anywhere in the schema
representing a player's declared position, and they are the sole source of truth — there is no
second, independently-writable representation to reconcile. (The similarly-named
`primaryPositionSnapshot`/`secondaryPositionSnapshot`/`tertiaryPositionSnapshot` fields at line
~1873 belong to a finalized-selection/history snapshot model, not `Player` — they are a
point-in-time copy taken for historical integrity, not a second live truth. Out of scope for this
bundle; unaffected by anything here.)

## 2. Mutation events — every write path found

Exactly two, both manual, both coach-initiated:

1. **Player creation** — `src/app/(app)/players/actions.ts` (`createPlayerAction` and
   equivalent): `primaryPosition` is a required form field; `secondaryPosition`/`tertiaryPosition`
   optional. Sets the initial declared values via `db.player.create()`.
2. **Manual coach edit** — two paths, both requiring `requireMutationRole()` +
   `requirePlayerGroupAccess()`:
   - `src/app/(app)/players/[playerId]/inline-actions.ts`'s `updatePlayerFieldAction()` — the
     inline-edit mechanism (`InlineEditSelect` in `player-position-profile.tsx`), one field at a
     time, validated against `playerPositionValues` (`src/lib/player-form-options.ts`).
   - The full player-edit form in `src/app/(app)/players/actions.ts` (`updatePlayerAction`,
     `db.player.update()` around line 330) — same three fields, submitted together.

**No other write path exists.** Every other file the initial grep matched on `primaryPosition:`
is a *reader* (select clause, destructuring, type definition, or a scoring/eligibility function
that consumes the declared value — e.g. `src/domain/positions/`, `src/lib/formations/suggest.ts`,
`src/lib/selection/*`, `src/lib/best-lineup/*`, event squad generation, exports, insights). None
of these write back to `Player.primaryPosition`/etc. This was directly verified by searching for
every `db.player.update(` call site combined with a `primaryPosition`/`secondaryPosition`/
`tertiaryPosition` field in its `data:` object — only the two paths above exist.

## 3. Evidence inputs — what exists today, and what it currently feeds

All of the following exist and are mature, but **none of them write to the Player position
fields**:

- **`ActualPositionInterval`** (`prisma/schema.prisma`) — the canonical actual on-field position
  record (ADR-0096/ADR-0104/ADR-0113). Has `playerId`, `position` (a position code string),
  `startedAtMs`/`endedAtMs` (duration — directly usable for "minutes at this position"), `source`
  (`ActualIntervalSource` enum), and is rebuilt idempotently by `rebuildActualTimeline()`/
  `rebuildEventActualTimeline()` on report completion for both League and Event (ADR-0104's
  shared `runPostMatchLearning()` pipeline). This is exactly the "actual completed-match
  positional usage" evidence source §5 of the contract requires — it already exists, is already
  duration-aware, and already fires for both League and Event on the same committed-evidence
  timing the contract requires (§11: "only when canonical match evidence is committed"). **It is
  currently read by**: `src/lib/insights/position-exposure.ts` (I-004), `src/lib/evidence/
  position-context-evidence.ts` (ADR-0120), `src/lib/evidence/combination-topology.ts`, and the
  `PitchExposure` viz widget — all presentation/advisory, never a `Player` write.
- **`PlayerDevelopmentObservation`** — the football-observation vocabulary (14 skill codes per
  AGENTS.md). Has no dedicated position-only sub-type; general development observations. This is
  the "explicit position observations" source named in contract §5, but there is no evidence it
  currently carries structured per-position confidence/polarity beyond its existing general
  observation fields — needs confirmation at implementation time whether a position-specific
  observation subtype should be introduced or whether general observations are sufficient input.
- **Confidence/threshold vocabulary that already exists and is reusable** (contract §9's
  fallback thresholds should NOT be layered on top of these if reused, per the contract's own
  instruction to prefer existing thresholds):
  - `ConfidenceLevel = "INSUFFICIENT" | "EMERGING" | "ESTABLISHED"`
    (`src/lib/evidence/combination-topology.ts`), reused across match-phase patterns (Bundle 2),
    position-context evidence (ADR-0120), transition-structure evidence (Bundle 7).
    `classifyMatchPhaseConfidence()` is the shared classifier — occurrence-count-based
    (`<2`/`2-3`/`4+` in some call sites, `<3`/`3-5`/`6+` matches in others depending on the
    evidence type; each caller documents its own threshold, there is no single global constant).
  - `src/lib/evidence/position-context-evidence.ts` already answers "what has historically
    happened at THIS position for THIS player, at team-season scope" with the confidence
    classifier above — the closest existing analogue to what an effective-position-profile's
    per-position support/confidence computation needs, though it answers a different question
    (match-outcome context, not "how strongly does this position fit the player").
- **`src/lib/players/player-position-resolver.ts`** — a small, separate, five-code
  (`GK/CB/CM/W/ST`) position taxonomy used for a narrower purpose (broad-position mapping,
  fit-tier PRIMARY/SECONDARY/TERTIARY/NO_FIT from the three declared scalar fields only). **This
  is the exact duplicate implementation already flagged in AGENTS.md as ARR-0040**: *"declared-
  position fit-tier logic is independently implemented a second time in
  `src/lib/players/player-position-resolver.ts` (used by the Event squad/lineup pipeline),
  duplicating `position-suitability.ts`'s `getPositionFit()`."* Confirmed still live and
  unresolved. Out of scope to fix in this bundle (ARR-0040 explicitly notes it "touches the
  production-critical Event generation pipeline, out of scope"), but the new
  `EffectivePlayerPositionProfile` builder must not become a *third* implementation of declared-
  position fit-tier logic — it should read the exact positional-semantics domain
  (`src/domain/positions/`) for suitability/tier concerns and layer evidence on top, not
  re-derive tiers itself.
- **`src/domain/positions/`** (ADR-0129) — the canonical exact-role suitability domain (12 exact
  roles, directed suitability matrix, tiers `NATURAL/STRONG/PLAUSIBLE/DEVELOPMENTAL/UNSUPPORTED`).
  This answers "how suitable is this player for exact role X given their **declared**
  positions" — it is **not** itself a position-evidence source (per contract §6, "exact-position
  suitability/transferability" must never create evidence) and must remain purely a downstream
  consumer of whatever the new effective profile decides is primary/secondary/tertiary, never a
  contributor to it.

## 4. Automatic mutation — confirmed absent

No code path anywhere recomputes or rewrites `Player.primaryPosition`/`secondaryPosition`/
`tertiaryPosition` from `ActualPositionInterval`, `PlayerDevelopmentObservation`, or any other
evidence source. There is no scheduled job, no post-report-completion hook, no "promote position"
action, and no test exercising such a mutation (`**/__tests__/*position*` tests found cover
suitability/eligibility/exposure computation, not profile mutation).

**This is not a regression or a bug** — it is the honest starting state the contract expects the
audit to establish. Per contract §9, since no existing equivalent rule was found, the fallback
`POSITION_EVOLUTION` thresholds (recentMatchWindow 6, minAppearancesForAutomaticPromotion 3,
promotionSupportMargin 0.15, persistenceUpdates 2) apply and should be implemented as a new,
centralized configuration rather than assumed to already exist.

## 5. Synchronizers

None found. No file named `sync-player-positions.ts`, `position-experience.ts`, or `suggestions.ts`
(the bundle's suggested-but-unconfirmed names) exists in the current tree. No "profile suggestion"
or "position suggestion" domain concept exists for players' declared positions specifically (there
is an unrelated `TeamBestLineup`/"Recommended lineup" suggestion mechanism, and formation-level
lineup suggestion `suggestLineupForFormation()` — both consume declared position, neither proposes
changing it).

## 6. Audit/provenance mechanism to reuse

`DecisionRecord` (`prisma/schema.prisma`) is a ready-made, generic, already-`organisationId`-scoped
audit model: `decisionType`, `entityType`, `entityId`, `action`, `reason`, `createdBy`, `createdAt`,
`beforeSnapshot: Json?`, `afterSnapshot: Json?`. This is exactly the shape contract §12 needs
("previous effective profile; new effective profile; triggering evidence batch; time;
reason/support summary") — `beforeSnapshot`/`afterSnapshot` can carry the before/after
`EffectivePlayerPositionProfile` JSON directly, `entityType: "Player"`/`entityId: playerId`,
`decisionType: "POSITION_PROFILE_EVOLUTION"` (or similar), `createdBy` set to a system/engine
identity for automatic changes vs. the coach's user id for manual edits. AGENTS.md already
documents `DecisionRecord` as the mandated mechanism for "Player-development and assistant-manager
actions" — this is squarely that category. **Reuse it; do not add a second audit table.**

## 7. Known gaps vs. the contract

| Contract requirement | Current state |
|---|---|
| One canonical source of truth | **Already satisfied** — no work needed here. |
| Coach declaration counts as evidence | Exists as the *only* current input (trivially satisfied — it's the whole model today). |
| Manual coach edits count as strong current evidence | Exists as raw overwrite; not yet modeled as "evidence within a profile" (there is no profile — the scalar fields ARE the whole state). |
| Actual completed-match usage counts as evidence | **Missing** — `ActualPositionInterval` exists and is rich enough, but nothing reads it into a position-profile decision. |
| Explicit position observations count as evidence | **Missing** — `PlayerDevelopmentObservation` exists but has no dedicated position-evidence read path. |
| Automatic evolution with hysteresis | **Missing entirely** — no automatic mutation of any kind exists. |
| No evidence from planned lineup/rotation/formation-eligibility/suitability | **Trivially satisfied today** (nothing reads those into position mutation), but must remain true once the new engine is built — this is a constraint on the *new* code, not a bug to fix in the old code. |
| Audit/provenance for automatic changes | **Missing** — no automatic changes exist yet to audit; `DecisionRecord` is ready to receive them. |
| League/Event parity | N/A yet — `ActualPositionInterval` already covers both sources identically (`matchId`/`eventMatchId` dual-nullable pattern), so building the evidence reader on top of it gets parity for free. |
| Guest players excluded | **Already satisfied structurally** — `ActualPositionInterval.playerId` is nullable with a separate `guestPlayerId`, and guest players are excluded from persistent Player evidence everywhere else in the codebase (ADR-0106) by the same dual-FK pattern; the new reader must simply query on `playerId != null` as every other evidence reader already does. |

## 8. Recommended implementation shape for Phase F3

Given the findings above, Phase F3 is **net-new build**, not repair of a broken existing engine —
there is nothing to "preserve... if it satisfies the contract" because nothing exists yet that
attempts this. Recommended ownership (matches `09_CODE_CHANGE_AND_MIGRATION_MAP.md §1`):

```text
src/lib/player-development/
  effective-position-profile.ts   — pure: combine declared + ActualPositionInterval aggregates
                                     + observation evidence into EffectivePlayerPositionProfile,
                                     apply POSITION_EVOLUTION thresholds/hysteresis
  position-evolution-config.ts    — centralized POSITION_EVOLUTION constants (contract §9)
  sync-effective-position.ts      — DB-bound orchestrator: recompute on committed-evidence events
                                     (report completion, alongside the existing
                                     runPostMatchLearning() steps — NOT a new separate trigger),
                                     write DecisionRecord, and (only when auto-promotion actually
                                     changes primary/secondary/tertiary) write Player via the same
                                     validated update path players/actions.ts already uses
```

Wire the recompute into `runPostMatchLearning()` (ADR-0104) as an additional step, since that is
already the single, idempotent, per-match, non-blocking orchestrator every other evidence type
hooks into (actual timeline → opponent evidence → player evidence → combination evidence) — adding
a fifth "position profile evolution" step here is consistent with the existing architecture and
gets League/Event parity, idempotent re-run safety, and `PostMatchLearningRun` observability for
free, rather than inventing a new trigger mechanism.

## 9. Stop conditions checked

Per `00_AUTHORITY_AND_EXECUTION_CONTRACT.md` §5: no conflicting invariant found, no existing
"materially different but intentional rule" was discovered (there is no existing rule at all to
conflict with), no schema change here creates a second writable truth (the new engine writes to
the *same* existing scalar fields via the *same* existing validated update path), and no required
data source is missing (`ActualPositionInterval` and `DecisionRecord` are both already present and
sufficient). **No stop required — proceed to Phase F3 as net-new implementation once Phases
F1/F2/Gate A are complete**, per the bundle's own sequencing (`10_IMPLEMENTATION_SEQUENCE_AND_HUMAN_GATES.md`
places F3 after Gate A).
