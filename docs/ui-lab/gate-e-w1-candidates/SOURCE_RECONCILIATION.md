# Gate E — Source Reconciliation

Status: initiation documentation for Gate E Wave 1. Produced before any Wave 1 scope decision or
implementation, per the programme's required order (recover sources → audit current state →
scope → implement).

## 1. Source bundle location and provenance

The handoff bundle was recovered on disk at:

```
.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/
```

This directory is **gitignored** (`.gitignore:111`) — it exists in this checkout but is not
tracked by git, consistent with the Gate A–D precedent (their own `SOURCE_RECONCILIATION.md`
files cite the same convention).

The handoff bundle has **two separate numbering schemes in two directories**, which the mission
brief's file list does not distinguish:

- The bundle root (`Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/`) has its own
  `00`–`09` files (`00_READ_ME_FIRST.md` … `09_SOURCE_REFERENCE_INDEX.md`), plus
  `MANIFEST_SHA256.txt` and a `previews/` directory.
- `programme_v054/` (a subdirectory) has its own, independent `00`–`26` numbering
  (`00_START_HERE.md` … `26_CANDIDATE_MANIFEST_TEMPLATE.json`).

The mission brief's required-document list (§2) names files as if they all lived in one place.
Reconciled against what actually exists on disk:

| Document named in the mission brief | Actual location | Status |
|---|---|---|
| `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` | `programme_v054/25_...csv` | FOUND |
| `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md` | `programme_v054/01_...md` | FOUND |
| `02_AUTHORITY_SCOPE_AND_APPROVALS.md` | bundle root (`Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/02_AUTHORITY_SCOPE_AND_APPROVALS.md`) — **not** `programme_v054/02_...`, which is actually `02_GATE_A_FOUNDATION_DESIGN_SPEC.md` | FOUND (wrong directory assumed by the brief) |
| `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md` | `programme_v054/13_...md` | FOUND |
| `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` | `programme_v054/17_...md` | FOUND |
| `21_FIXTURE_CAPTURE_AND_AUTHORITY.md` | `programme_v054/21_...md` | FOUND |
| `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md` | `programme_v054/23_...md` | FOUND |
| `24_CONFLICT_AND_BLOCKER_REGISTER.md` | `programme_v054/24_...md` | FOUND |
| `26_CANDIDATE_MANIFEST_TEMPLATE.json` | `programme_v054/26_...json` | FOUND (superseded — see §4) |
| `09_SEASON_REVIEW.md` ("if present") | **Does not exist anywhere in this bundle.** A file of that exact name exists only in a different, unrelated, older bundle: `.matchboard-work/matchboard_contextual_coach_workspace/09_SEASON_REVIEW.md`. That bundle is not part of this handoff and is not cited as authoritative here. | NOT PRESENT in the Gate E bundle — not substituted |

All nine required documents were ultimately located and read in full (eight inside
`programme_v054/`, one — `02_AUTHORITY_SCOPE_AND_APPROVALS.md` — at the bundle root). This is not
a source-recovery failure; the §2 "missing source" procedure does not apply. The one genuine gap
(`09_SEASON_REVIEW.md`) is immaterial to Wave 1's actual scope decision (§3 below — Season Review
is not selected for Wave 1).

## 2. Authority scope (from `02_AUTHORITY_SCOPE_AND_APPROVALS.md`, bundle root)

- Only a **UI Lab-only design PR** is authorised: `src/app/dev/ui-lab/**` route/fixture/local
  presentation code, nonproduction tests, narrowly targeted `scripts/ui-lab-visual-review.mjs`
  changes, and candidate-provenance documentation. No production route, `src/components/**`,
  `src/domain/**`, engine, auth/permissions, Prisma schema/migration, real player data, provider
  connection, app shell/global CSS, deployment workflow, or security-policy change.
- `DESIGN_DIRECTION_ACCEPTED` ≠ `CANDIDATE_GOLDEN` ≠ `APPROVED_GOLDEN` ≠ `VERIFIED_PRODUCTION`. A
  passing capture pipeline proves only that a capture completed, never human approval.
- Repo policy: branch → validate → PR → CI → human gate. No direct push to `main`, no forced
  merge, no self-approval.

## 3. Gate E register — exact rows

From `programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`, filtered to `gate=E*`. Every row
carries `status=Needs golden`, `direction_status=DIRECTIONAL_ONLY`,
`official_golden_status=NOT_READY`, `source_commit=b070df73664d816f1b0ebc61d54487a24044972e`.

| ID | Surface | Required state | Viewports/themes | Primary acceptance question | Owner refs |
|---|---|---|---|---|---|
| E01 | League / Fixtures and results | Scheduled+completed | Desktop dark + mobile light | Current planning round identifiable among historical/upcoming; period navigation + context restoration (XR-T01 XR-S02) | league-season-rail, match rows |
| E02 | Events / Event day | Upcoming+completed | Desktop dark + mobile dark | Multi-match event-day progression across squads/states with persistent event and match identity (XR-T01 XR-S01 XR-V02) | event-detail, event-day-timeline |
| E03 | Season Review / Story-first season evidence | Sparse+rich samples | Desktop dark + mobile light | 3–5 only if substantiated stories; distribution, evidence sample and comparators, details on demand (XR-A01 XR-A02 XR-A04 XR-V01) | season-review view model, ADR-0157 |
| E04 | Opponent Detail / Previous encounter context | History known/unknown | Desktop dark + mobile light | Opponent memory actionable in Match Preparation | opponent memory, ADR-0152 |
| E05 | Team Detail / Tab-specific task | Focus/movement/history | Desktop dark + mobile light | Less repeated header/cards, preserve admin features | league team pages |
| E06 | Settings and rules / Administrative workflow | Forms/edge states | Desktop light + mobile dark | Efficient density within same tokens, no false actions | settings, group/rules pages |
| E07 | Season review / Assistant Coach seasonal themes | At least two time windows versus insufficient sample | Desktop + mobile | Time-based team themes with sample/caveat, no made-up causal claims | Team season profile; recurring theme facts; cycle review |
| E08 | Events and League / Structured squad proposal | Valid/invalid alternative, existing squads, provider failure | Desktop + mobile | Squad proposal refers to unsided player roles but validates every exact match slot via canonical eligibility and suitability (XR-P02) | Event planning; League squad selection; Assistant Coach |

Eight rows, E01–E08. No scenario ID gap exists in this block (unlike Gate D's D05 gap). No row is
invented here; this table is copied verbatim from the CSV.

## 4. `26_CANDIDATE_MANIFEST_TEMPLATE.json` is superseded

The v0.5.4 manifest template (`programmeRevision: "0.5.4"`, flat `captures`/`approval` shape) is
**not used verbatim**. The schema actually enforced by the live Visual Authority Gate
implementation (as used in every merged Gate A–D `candidate_manifest.json`, most recently PR #847)
is newer and is the one this wave's `candidate_manifest.json` follows — per repository convention
(ADR-0159's comment-ledger model) and the identical precedent already recorded in
`docs/ui-lab/gate-d-w1-candidates/SOURCE_RECONCILIATION.md` §2.

## 5. Other load-bearing constraints carried into Wave 1

- **XR-T01/XR-S02** (`13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md`): temporal orientation and
  object-first composition — directly scoped to E01 by the register's own acceptance question and
  by §"Workstream integration" ("Gate E: verify XR-T01, XR-A01/A02/A04 in League/Events/Season").
- **XR-I01/XR-I02** (`17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`): round/match decisions remain
  local to their own workspace; League's own focused-round/history rows are read/navigate-only in
  this wave (no mutation surface is introduced).
- **ARR-0035** (repository, not bundle): `buildLeagueOperatingViewModel()`'s own
  `focusedRound.matches[].href`/`roundBoardHref` are bare unscoped paths
  (`/matches/{id}`, `/rounds/{id}`), and `src/components/fixtures/fixtures-page.tsx` is explicitly
  named in ARR-0035's open-residue file list. This is pre-existing, already-tracked architectural
  residue, not a defect introduced by this wave — see `BLOCKERS.md`.
- **ADR-0144** (League operating surface): the real `buildLeagueOperatingViewModel()`/
  `LeagueSurface` this wave reuses unmodified.

## 6. Source-recovery outcome

No source-recovery failure occurred. All nine required documents were found (one at a different
path than the brief assumed, one genuinely absent from this bundle and not substituted from an
unrelated bundle). This document does not fall back to the "missing source" procedure.
