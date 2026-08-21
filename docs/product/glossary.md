# Product Glossary

> **Status:** Canonical. This is the structured, per-term glossary required by the UI/UX programme. It complements, and must not duplicate or contradict, two existing canonical sources:
>
> - `docs/domain/terminology.md` — UK football word-choice rules (e.g. Football not Soccer, Squad not Roster) and `npm run terminology:check`'s enforced ban list.
> - `AGENTS.md` — full behavioural rules for each domain concept. This glossary defines terms; `AGENTS.md` defines the rules that govern them. Where they could drift, `AGENTS.md` is authoritative for behaviour.

Each entry gives: definition, scope, deprecated synonyms (never use in visible product language), singular/plural form, and the actions typically performed on it.

## Structural entities

### Organisation
- **Definition:** The top-level tenant boundary. Everything a coach manages (teams, players, matches, groups) belongs to exactly one organisation.
- **Scope:** Security/tenancy boundary, not a coaching concept the UI foregrounds routinely.
- **Deprecated synonyms:** Club (an organisation may represent a club, but the code/product concept is Organisation), Account, Workspace.
- **Singular / Plural:** Organisation / Organisations.
- **Related actions:** Create, Invite coach, Switch organisation.

### Group
- **Definition:** A football group (e.g. an age group) within an organisation, used to scope teams and players for stable base-team administration.
- **Scope:** Administrative/organisational context, not a weekly-planning concept.
- **Deprecated synonyms:** Division, Section.
- **Singular / Plural:** Group / Groups.
- **Related actions:** Create, Manage settings, Assign players to base groups.

### Player
- **Definition:** An individual football player registered in the organisation's player registry.
- **Scope:** Core domain entity; every selection, movement, rating, and feedback concept attaches to a Player.
- **Deprecated synonyms:** User (a Player is not an authenticated User — see Auth rules in `AGENTS.md`), Athlete, Kid, Child.
- **Singular / Plural:** Player / Players.
- **Related actions:** Add, Edit, Move, Change availability, View participation, View profile.

### Team
- **Definition:** A persistent competition entity within a League season context (e.g. "Under-12 Blues"). See `docs/domain/terminology.md` for the Team vs Squad distinction.
- **Scope:** League context specifically. See League team below for the disambiguated term used once the canonical IA (Today/League/Events/Players/More) ships.
- **Deprecated synonyms:** Roster (as a synonym for the persistent entity), Group (do not conflate Team with Football group).
- **Singular / Plural:** Team / Teams.
- **Related actions:** Create, Configure (squad limits, support priority), View detail.

### League team
- **Definition:** The disambiguated term for a Team in the League planning context, once the target information architecture (`League → League teams` vs `Events → Event squads`) is implemented. Until then, "Team" alone refers to this concept in most of the current UI.
- **Scope:** Introduced to resolve the ambiguity `PROGRAMME.md` §6 identifies between league-context teams and event-context squads.
- **Deprecated synonyms:** Team (ambiguous once Events also has its own team-like concept), Squad (a League team is not the same as a match Squad — see below).
- **Singular / Plural:** League team / League teams.
- **Related actions:** Same as Team, above.

### Event team
- **Definition:** A temporary squad built for a cup/tournament/friendly-day Event. Product term used in the UI is "Event squad" (see `AGENTS.md`'s Event squad planning section); "Event team" is the IA-level disambiguation term against League team.
- **Scope:** Event planning only. Never a `Team` database row; has no league identity.
- **Deprecated synonyms:** Temporary team, Scratch team (see `AGENTS.md`'s Event squad product-language table for the full list).
- **Singular / Plural:** Event squad / Event squads.
- **Related actions:** Generate, Lock, Unlock, Regenerate, Manually adjust.

### Squad
- **Definition:** The group of players selected or available for a specific team, event, or match at a point in time.
- **Scope:** A Squad is a selection state, not a persistent entity — contrast with Team, which persists across rounds.
- **Deprecated synonyms:** Roster.
- **Singular / Plural:** Squad / Squads.
- **Related actions:** Generate, Review, Adjust, Finalise.

### Lineup
- **Definition:** The assignment of selected players to specific match positions within a formation, for one match.
- **Scope:** Match-specific; distinct from Squad (which player is available/selected) and Formation (the positional structure itself).
- **Deprecated synonyms:** Line-up (US spelling in prose; UK hyphenated form "line-up" is used in running text per `docs/domain/terminology.md`, "Lineup" is used as the product/code term — see that document's Line-up/Lineup entry for the exact split).
- **Singular / Plural:** Lineup / Lineups.
- **Related actions:** Create, Auto-fill, Assign player to slot, Lock slot, Confirm.

## Time and competition units

### Round
- **Definition:** Short form of Match round: the operational planning unit. A round may contain one or more matches and is the unit fairness/rotation is planned around within a period.
- **Scope:** League planning only; Events do not use Rounds.
- **Deprecated synonyms:** Week, Planning period (see `docs/domain/terminology.md`).
- **Singular / Plural:** Round / Rounds.
- **Related actions:** Generate, Review, Finalise, Un-finalise, Clear, Regenerate.

### Match
- **Definition:** A single played or playable football contest, belonging to a Round (league) or an Event.
- **Scope:** The atomic unit of squad planning and post-match reporting.
- **Deprecated synonyms:** Game (see `docs/domain/terminology.md`), Fixture (a Fixture is a scheduled Match, not a synonym — see Domain boundaries in that document).
- **Singular / Plural:** Match / Matches.
- **Related actions:** Add, Edit, Cancel, Reopen, Finalise, Start live match, Open post-match report.

### Event
- **Definition:** A cup, tournament, or friendly-day container, independent of League seasons, with its own squads and matches.
- **Scope:** Separate planning universe from League rounds — see `AGENTS.md`'s "Event squad planning" and "Integration boundaries" sections.
- **Deprecated synonyms:** Tournament mode, Cup mode (see `AGENTS.md`'s Event product-language table).
- **Singular / Plural:** Event / Events.
- **Related actions:** Create, Add match, Compose teams, Review squads, Finalise event.

### Season
- **Definition:** The broad football-year context, wider than a League season.
- **Scope:** Used only for the annual context; the bounded spring/autumn operational window is always "League season," never "Season" alone or "Phase" — see `docs/domain/terminology.md`.
- **Deprecated synonyms:** Phase, Planning period, Year period.
- **Singular / Plural:** Season / Seasons.
- **Related actions:** (Season itself is contextual; planning actions attach to League season.)

## Selection and movement

### Selection
- **Definition:** A single player's planned assignment to a match, with a role (Core, Support, Development, or legacy Backfill).
- **Scope:** The atomic record of the selection engine's output; one planned assignment per player per round (see `AGENTS.md`'s "One planned assignment per player per round").
- **Deprecated synonyms:** Assignment (see next entry — related but not identical), Pick.
- **Singular / Plural:** Selection / Selections.
- **Related actions:** Generate, Manually add, Manually remove, Change role, Override.

### Assignment
- **Definition:** The general concept of a player being placed into a specific context (a match Selection, a Lineup slot, an Event squad). "Selection" is the specific League/Event squad-membership record; "Assignment" is used when referring to the broader placement act, e.g. Lineup slot assignment.
- **Scope:** Cross-cutting; disambiguate with the specific entity (Selection, Lineup assignment) where precision matters.
- **Deprecated synonyms:** Placement.
- **Singular / Plural:** Assignment / Assignments.
- **Related actions:** Assign, Move, Remove.

### Movement
- **Definition:** A player's non-core selection (moving outside their core team as Support or Development), recorded in the Movement ledger.
- **Scope:** Always non-core; a Core selection is never a Movement. See `AGENTS.md`'s "Movement ledger" and "RotationPath authority" sections for the full rule set.
- **Deprecated synonyms:** Transfer, Loan (movement is temporary and round-scoped, not a transfer/loan concept).
- **Singular / Plural:** Movement / Movements.
- **Related actions:** Send as support, Development movement, Squad repair.

### Support
- **Definition:** A movement role where a player is sent from a donor team to help a team that needs it, per team support priority (see `AGENTS.md`'s "Support priority convention"). Coach-facing term: "Sent as support."
- **Scope:** Priority 1 in rule precedence — attempted before optional development movement or fairness.
- **Deprecated synonyms:** Demoted, Loan.
- **Singular / Plural:** Support (uncountable, a role) / Support assignments (countable instances).
- **Related actions:** Send as support, Receive support.

### Development
- **Definition:** A movement role where a player moves to a harder or different context for development benefit, when no required support need exists.
- **Scope:** Optional, scored preference — never overrides required Support (rule precedence).
- **Deprecated synonyms:** Promoted, Rewarded, Upgraded.
- **Singular / Plural:** Development (uncountable, a role) / Development movements (countable instances).
- **Related actions:** Development movement, Development rotation.

## Presence

### Availability
- **Definition:** A coach-recorded, per-round or per-event statement of whether a player can be selected (Available / Unavailable / Unknown / Reserve / Late addition / Withdrawn, depending on context).
- **Scope:** A planning input, set before generation. Distinct from Attendance, which is a post-match reality.
- **Deprecated synonyms:** Attendance (do not use interchangeably — see next entry).
- **Singular / Plural:** Availability (uncountable).
- **Related actions:** Mark player availability, Change availability.

### Attendance
- **Definition:** The recorded, post-match reality of whether a player actually took part (`PostMatchPlayerActual`, `PRESENT`/absence reasons). See `AGENTS.md`'s "Canonical data truth" §3-5.
- **Scope:** Actual participation, never planned selection. `UNKNOWN` attendance blocks report completion.
- **Deprecated synonyms:** Availability (do not conflate).
- **Singular / Plural:** Attendance (uncountable).
- **Related actions:** Record attendance, Complete report.

## Lifecycle / status

These four are also fully defined behaviourally in `AGENTS.md` ("Round status model", "Match status model", "Direct post-match workflow"); this entry gives the term-level definition only.

### Draft
- **Definition:** Selections/lineups that have been generated or manually edited but not yet locked. Editable.
- **Scope:** Applies to Rounds, Matches (per-match finalisation), Event squads, Lineups, Post-match reports.
- **Deprecated synonyms:** Not generated (a distinct, earlier state — see `AGENTS.md`'s Round status model; Draft implies selections exist, Not generated means none do).
- **Singular / Plural:** n/a — a state, not a countable noun.
- **Related actions:** Generate, Regenerate, Manually edit, Clear.

### Finalised
- **Definition:** Locked history. Selections/lineups/reports that cannot be silently mutated once in this state. UK spelling "Finalised" in all visible product language (see `docs/domain/terminology.md`).
- **Scope:** Applies to Rounds, Matches, Event squads (as "Locked" — see Event squad's own Draft/Locked lifecycle, a parallel but distinct vocabulary), reports.
- **Deprecated synonyms:** Finalized (US spelling), Completed (see next entry — different concept), Locked (Locked is the Event-squad-specific term; Finalised is the League round/match term).
- **Singular / Plural:** n/a — a state.
- **Related actions:** Finalise, Un-finalise.

### Completed
- **Definition:** A post-match report that has been fully filled in and locked (the LOCKED report status, reached via the single visible "Complete report" action — see `AGENTS.md`'s "Direct post-match workflow").
- **Scope:** Post-match reporting only. Do not use for round/match finalisation — that is "Finalised."
- **Deprecated synonyms:** Finalised (different concept — a match can be Finalised for planning purposes and still have an incomplete report), Submitted, Locked (ambiguous with Event squad Locked state — always say "Completed report" for this concept).
- **Singular / Plural:** n/a — a state.
- **Related actions:** Complete report.

### Cancelled
- **Definition:** A match that did not happen; bypasses post-match reporting and statistics.
- **Scope:** Match status only (`SCHEDULED` / `CANCELLED` — see `AGENTS.md`'s "Match status model").
- **Deprecated synonyms:** Canceled (US spelling), Postponed (Matchboard does not model postponement separately from date editing — see "Match schedule editing" in `AGENTS.md`).
- **Singular / Plural:** n/a — a state.
- **Related actions:** Cancel match, Reopen match.

## Workflow verbs

### Review
- **Definition:** Inspecting a draft selection, plan integrity signal, or a pending `ReviewRequest` before acting.
- **Scope:** Applies broadly (round review, event squad review, coaching decision review).
- **Deprecated synonyms:** Inspect, Check (acceptable as ordinary English, but prefer "Review" as the canonical verb where a formal review action/request exists).
- **Related actions:** Request review, Resolve review, Cancel review.

### Approve
- **Definition:** Accepting a request or condition as satisfactory (e.g. resolving a `ReviewRequest` positively).
- **Scope:** Used for review-request resolution, not for finalisation itself (finalisation uses "Finalise," not "Approve").
- **Deprecated synonyms:** OK, Accept (prefer Approve for formal review resolution).
- **Related actions:** Approve review, Resolve review.

### Reject
- **Definition:** Declining a request as unsatisfactory, requiring further changes.
- **Scope:** Review-request resolution (`review_changes_requested`).
- **Deprecated synonyms:** Decline (acceptable for Fair Play / invitation contexts specifically — see existing usage), Deny.
- **Related actions:** Request changes, Resolve review.

### Confirm
- **Definition:** A user's explicit acknowledgement of an action before it proceeds, used sparingly per `AGENTS.md`'s "Confirmation-dialog fatigue" guidance (Undo is preferred for reversible actions).
- **Scope:** Reserved for destructive, irreversible, or historically significant actions (see `PROGRAMME.md` §35).
- **Deprecated synonyms:** OK, Submit.
- **Related actions:** Confirm lineup, Confirm event squads.

### Finalise
- **Definition:** The specific action that locks League round/match selections into history, requiring an override reason if Blocked/Decision-required conditions exist.
- **Scope:** League rounds and matches only — see `AGENTS.md`'s "Per-match and round finalization".
- **Deprecated synonyms:** Finalize (US spelling), Submit, Confirm (Confirm is the generic verb; Finalise is the specific domain action), Lock (Lock is the Event-squad equivalent verb).
- **Related actions:** Finalise round, Finalise match, Un-finalise.

## Player evaluation

### Rating
- **Definition:** A coach-facing, 1-10 numeric player attribute, relative to the cohort, never an absolute scouting score. Null means "Not rated," never 0 or max (see `AGENTS.md`'s "Player attribute ratings").
- **Scope:** Internal planning context only — never in parent-facing exports.
- **Deprecated synonyms:** Score, Skill level (as a public-facing term), Ability (see next entry — related but the code/UI concept is "Rating" for numeric attributes, "Ability" for the qualitative readiness concept below).
- **Singular / Plural:** Rating / Ratings.
- **Related actions:** Edit rating, View composite attributes.

### Ability
- **Definition:** Used in ordinary English to describe what a player can do; not a distinct Matchboard data field. Where the product needs a structured, storable concept, use Rating (numeric attribute) or Readiness signal (qualitative, coaching-context) instead — see `AGENTS.md`'s "Player readiness signals".
- **Scope:** Avoid using "Ability" as if it were its own tracked field; it conflates Rating and Readiness.
- **Deprecated synonyms:** n/a — this entry exists to prevent the term being (mis)used as a distinct concept.
- **Related actions:** n/a.

### Evidence
- **Definition:** Observable-behaviour support for a suggestion or decision (e.g. `PlayerProfileSuggestionEvidence`), never a permanent ranking input.
- **Scope:** Player-development suggestions and decision-audit trails.
- **Deprecated synonyms:** Proof, Score.
- **Singular / Plural:** Evidence (uncountable).
- **Related actions:** View evidence, Attach evidence.

## Positions

### Primary position
- **Definition:** A player's main playing position, used first when matching a player to a formation slot.
- **Scope:** Best Lineup, formation slot-fit, and lineup suggestion logic all check Primary position first.
- **Related actions:** Set primary position.

### Secondary position
- **Definition:** A player's next-best position, used when no Primary-position match is available for a slot.
- **Related actions:** Set secondary position.

### Tertiary position
- **Definition:** A player's third-preference position, used as the last positional-fit tier before falling back to a permitted fallback position (`FALLBACK_POSITION_USED`).
- **Related actions:** Set tertiary position.
