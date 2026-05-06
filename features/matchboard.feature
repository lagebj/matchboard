Feature: Matchboard football operations workspace

  Matchboard is a local-first web app for youth football match-round selection.
  Matchboard generates selections per match round.
  A match round is the operational planning unit.
  The season or planning period is the fairness and load-balancing context.

  Matchboard plans squads for already-created matches.
  It does not auto-create fixtures or schedule a season.
  It is not a full scheduling system or a club-management system.

  Team support is priority 1 across the entire system.
  If a team requires support, that support must be fulfilled before development movement, fairness optimization, cosmetic balancing, or generic rotation.
  If required support cannot be fulfilled, the model must generate a warning and must not silently weaken the team.

  Squad repair follows support movement and follows a strict priority order.
  When a player is moved from their core team as support, their team may need squad repair.
  Squad repair priority: (1) own core team player moved as support if matches are on different dates and the player can play both, (2) players from teams connected by an active DEVELOPMENT rotation path to the receiving team, (3) any other player from another team with an active BACKFILL rotation path to the receiving team where nonRotatable is false.
  Non-rotatable players must never be used as generic squad repair.
  If no valid squad repair exists, the app must generate a warning instead of silently weakening the team.

  A player should normally only be selected once per match round unless an explicit controlled double-load rule allows otherwise.
  Controlled double-load requires: matches on different dates, minimum rest spacing between matches, explicit player permission or configuration, fairness debt tracking, and rotation across eligible players over time.

  Matchboard must feel like a football management cockpit, not an admin CRUD app.
  The main workflow must be inspired by Football Manager-style interaction patterns:
  persistent navigation, object-based screens, dense information panels, needs action, round checks, squad views, tactics board, and matchday workflow.

  The app must not optimize for winning.
  The app must optimize for match function, player development, fairness, support coverage, team continuity, and explainable coach decisions.

  The app must treat teams as configurable planning units.
  It must not hardcode Team A, Team B, Team C, goalkeepers, strongest team, weakest team, or fixed hierarchy.
  Those meanings are configured by the coach through teams, rules, paths, priorities, and player flags.

  The app must not expose the primary coach workflow as raw database tables.
  Tables are allowed for audit, history, export preview, and dense configuration, but the main workflow must use football operations workspaces.

  Background:
    Given the app has a local database
    And the coach can configure seasons
    And the coach can configure planning periods
    And the coach can configure teams
    And the coach can configure players
    And each player has exactly one core team
    And each match belongs to exactly one team
    And match selections are generated per match round from configured rules
    And every finalized selection stores a snapshot of rule configuration, availability, warnings, explanations, and manual overrides


  Rule: System boundary

    Matchboard plans squads for already-created matches.
    It does not create fixtures, schedule a season, manage a club, or act as a full scheduling system.

    Scenario: Matchboard does not auto-create fixtures
      Given the coach has created matches for a match round
      When the app generates selections
      Then the app must only generate selections for the existing matches
      And the app must not create new matches or fixtures on its own

    Scenario: Matchboard is not a scheduling system
      Given a season and planning period exist
      When the coach uses the app
      Then the app must not automatically schedule matches across the season
      And the app must require the coach to create matches manually

    Scenario: Matchboard is not a club management system
      Given the coach uses the app
      Then the app must not manage club membership, registration, payments, or communication
      And the app must not provide authentication or multi-user workflows


  Rule: Main domain hierarchy

    The app uses Season, Planning Period, Match Round, Match, Selection, Movement Ledger, Rule Configuration, Warning, and Manual Override as the core planning hierarchy.

    Scenario: Matchboard uses planning hierarchy
      Given a season exists
      And a planning period belongs to the season
      And a match round belongs to the planning period
      And a match belongs to the match round
      When the coach opens the match round
      Then the app must show the match round inside its planning period
      And the app must show every match belonging to the match round

    Scenario: Planning period tracks fairness across match rounds
      Given planning period "Spring Block 1" contains match rounds "R1", "R2", and "R3"
      When the coach opens planning period review
      Then the app must include selections, movements, drops, warnings, match fit feedback, and overrides from all match rounds in the planning period

    Scenario: Finalized match round stores snapshot
      Given match round "R1" has generated selections
      When the coach finalizes match round "R1"
      Then the app must store selected players
      And the app must store availability at finalization time
      And the app must store rule configuration version
      And the app must store warnings
      And the app must store manual overrides
      And the app must store movement ledger entries
      And the app must preserve enough information to explain the finalized round later

    Scenario: Coach can finalize a single match within a round
      Given match round "R1" contains matches "M1" and "M2"
      And match "M1" has draft selections
      And match "M2" has draft selections
      When the coach finalizes match "M1"
      Then match "M1" selections must be locked as FINALIZED
      And match "M2" selections must remain as DRAFT
      And match round "R1" must remain in DRAFT state

    Scenario: Finalizing all matches auto-finalizes the round
      Given match round "R1" contains matches "M1" and "M2"
      And match "M1" has draft selections
      And match "M2" has draft selections
      When the coach finalizes match "M1"
      And the coach finalizes match "M2"
      Then match round "R1" must be in FINALIZED state

    Scenario: Per-match finalization respects match-scoped hard blockers
      Given match round "R1" contains matches "M1" and "M2"
      And match "M1" has a HARD_BLOCK warning
      And match "M2" has no blockers
      When the coach finalizes match "M2"
      Then the app must finalize match "M2" successfully
      And match "M1" must remain unfinalized

    Scenario: Per-match finalization with hard blockers requires override reason
      Given match round "R1" contains matches "M1" and "M2"
      And match "M1" has a HARD_BLOCK warning
      When the coach finalizes match "M1" without an override reason
      Then the app must require an override reason
      When the coach provides an override reason and finalizes match "M1"
      Then match "M1" must be finalized with the override reason stored

    Scenario: Finalized match in finalized round cannot be re-finalized
      Given match round "R1" has been finalized
      When the coach attempts to finalize a match in "R1"
      Then the app must reject the finalization

    Scenario: Unfinalized drafts can change freely
      Given match round "R1" is in draft state
      When the coach regenerates selections
      Then the app may replace draft selections
      And the app must show what changed after regeneration

    Scenario: Finalized selections are protected from silent mutation
      Given match round "R1" has been finalized
      When the coach edits a finalized selection
      Then the app must create an audit entry
      And must record the reason for the change
      And must preserve the original finalized snapshot

    Scenario: Coach can un-finalize a round to recalculate
      Given match round "R1" has been finalized
      When the coach un-finalizes round "R1"
      Then all selections in "R1" must revert to DRAFT status
      And movement ledger entries must revert to draft
      And ruleConfigVersion and overrideReason must be cleared on affected selections
      And the round status must be re-derived from warnings

    Scenario: Coach can un-finalize a single match within a finalized round
      Given match round "R1" has matches "M1" and "M2" and both are finalized
      When the coach un-finalizes match "M1"
      Then selections for "M1" must revert to DRAFT status
      And selections for "M2" must remain FINALIZED
      And the round must remain FINALIZED because other matches are still finalized

    Scenario: Un-finalizing the last finalized match reverts round status
      Given match round "R1" has match "M1" and "M1" is finalized
      When the coach un-finalizes match "M1"
      Then round "R1" must no longer be FINALIZED
      And round "R1" status must be re-derived from warnings

    Scenario: Un-finalize requires confirmation
      Given match round "R1" has been finalized
      When the coach attempts to un-finalize round "R1"
      Then the app must ask for confirmation before reverting finalized selections


  Rule: Player identity

    Players need stable backend identity independent of team membership.

    Scenario: Player code is generated automatically
      When the coach creates a player
      Then the app must generate a stable player code automatically
      And the player code must be stored as a backend reference identifier
      And the player code must not be derived from the player's current core team

    Scenario: Player code is hidden from normal UI
      Given a player exists
      When the coach uses normal app screens
      Then the app does not need to show the player code
      And the player code must remain available for backend reference, import, export, debugging, and history

    Scenario: Player code remains stable when core team changes
      Given player "p1" exists with player code "P001"
      When the coach changes player "p1" core team
      Then player "p1" must still have player code "P001"


  Rule: Team registry

    Teams are operational planning units.
    Teams may represent internal development contexts, but the app must not infer hierarchy from team name.

    Scenario: Coach creates a team
      When the coach creates a team
      Then the team must have a name
      And the team may have target squad size
      And the team may have minimum accepted squad size
      And the team may have maximum squad size
      And the team may have minimum core player count
      And the team may have support priority
      And the team must be available for player core-team assignment

    Scenario: Coach edits a team
      Given a team exists
      When the coach edits the team
      Then the app must save updated team configuration
      And future match generation must use the updated configuration
      And finalized historical selections must remain explainable using the rule version active at finalization time

    Scenario: Coach cannot remove a team that is still in use
      Given a team is referenced by active players, rotation paths, matches, selections, movement ledger, or finalized history
      When the coach removes the team
      Then the app must block removal
      And explain that existing references must be cleared or archived first

    Scenario: Coach can remove an unused team
      Given a team is not referenced by players, paths, matches, selections, movement ledger, or history
      When the coach removes the team
      Then the team must no longer be available for player assignments
      And the team must no longer be available for match creation
      And the team must no longer be available for new rotation paths


  Rule: Player registry

    Player registry stores football profile data, planning flags, positions, availability, and history.

    Scenario: Coach creates a player
      Given at least one team exists
      When the coach creates a player
      Then the coach must assign exactly one core team
      And the app must generate a stable player code
      And the player must become available for future match planning unless inactive or unavailable

    Scenario: Coach edits a player
      Given a player exists
      When the coach edits the player profile
      Then the app must save updated profile details
      And future rule generation must use the updated profile details
      And finalized historical selections must remain explainable

    Scenario: Coach can remove a player from the active registry
      Given a player exists
      When the coach removes the player
      Then the player must no longer appear in the active player registry
      And the player must not be available for future match selection
      And historical finalized selections must remain explainable

    Scenario: Removed player remains in historical finalized selections
      Given player "p1" was selected in finalized match round "R1"
      When the coach removes player "p1" from the active registry
      Then match round "R1" must still show player "p1" in historical selection
      And the app must mark the player as inactive or removed in current context


  Rule: Player positions

    Players have primary, secondary, and tertiary positions.
    Primary position must be considered first.
    Secondary and tertiary positions are fallback options.
    Position values are configurable later, but the default supported position list is GK, CB, CM, W, and ST.

    Scenario: Player positions use supported position list
      Given a player exists
      When the coach records positions
      Then primary position must be one of "GK", "CB", "CM", "W", or "ST"
      And secondary position must be "None" or one of "GK", "CB", "CM", "W", or "ST"
      And tertiary position must be "None" or one of "GK", "CB", "CM", "W", or "ST"

    Scenario: Primary position is required
      Given a player exists
      When the coach saves the player profile
      Then the player must have a primary position

    Scenario: Optional positions can be cleared
      Given a player has secondary or tertiary position recorded
      When the coach changes that field to "None"
      Then the app must save that field as empty
      And the player profile must show that no optional position is recorded

    Scenario: Position does not imply non-rotatable
      Given player "p1" has primary position "GK"
      And player "p1" is not marked non_rotatable
      When the app evaluates rotation eligibility
      Then player "p1" must still be treated as rotatable unless explicitly marked non_rotatable


  Rule: Player football profile details

    Player profile may store details useful for coaching and tactics without making those details automatic selection law.

    Scenario: Player profile stores footedness and best side
      Given a player exists
      When the coach records footedness and side preference
      Then preferred foot must be one of "Left" or "Right"
      And secondary foot must be one of "Left", "Right", or "Weak"
      And best side must be one of "Left", "Center", or "Right"

    Scenario: Player profile stores coach notes
      Given a player exists
      When the coach writes a private player note
      Then the note must be stored on the player profile
      And the note must only be visible in coach view

    Scenario: Player profile stores support instruction notes
      Given a player exists
      When the coach records a support instruction
      Then the instruction may be shown when the player is selected for support
      And the instruction must not be shown in parent/player export unless explicitly included by the coach

    Scenario: Player profile stores development instruction notes
      Given a player exists
      When the coach records a development instruction
      Then the instruction may be shown when the player is selected for development
      And the instruction must remain coach-facing by default


  Rule: Player attribute ratings

    Attribute ratings are useful for profile overview and coaching judgement.
    They must not automatically override explicit planning flags such as support suitability, development readiness, non_rotatable, or reduced_match_load_allowed.

    Scenario: Player profile stores detailed attributes
      Given a player exists
      When the coach records player attributes
      Then the profile must store technical attributes for "Ball Control", "Passing", "First Touch", and "1v1 Attacking"
      And the profile must store tactical attributes for "Positioning", "1v1 Defending", and "Decision Making"
      And the profile must store mental attributes for "Effort", "Teamplay", and "Concentration"
      And the profile must store physical attributes for "Speed" and "Strength"

    Scenario: Attribute ratings use one-to-five scale
      Given a player exists
      When the coach records player attributes
      Then every tracked attribute must be a whole number between 1 and 5
      And the player form must block values outside that range

    Scenario: Attribute averages are derived for profile display
      Given a player has recorded attributes
      When the player profile is viewed
      Then the profile must show category averages
      And the profile may show an overall average
      And the profile may visualize the overall average with stars

    Scenario: Attribute ratings do not automatically override explicit support suitability
      Given a player has high attribute ratings
      And the player has support suitability "avoid"
      When the app ranks support candidates
      Then the explicit support suitability must take precedence over raw attribute average

    Scenario: Attribute ratings do not automatically override development readiness
      Given a player has high attribute ratings
      And the player has development readiness "not_ready"
      When the app ranks development candidates
      Then the explicit development readiness must take precedence over raw attribute average


  Rule: Match registry

    Matches belong to match rounds.
    Match metadata must be available in planning, exports, history, and matchday mode.

    Scenario: Match stores home-or-away status
      Given the coach creates or edits a match
      When the coach records home-or-away status
      Then the match must store either "Home" or "Away"
      And match detail, match overview, exports, and matchday mode must show that status

    Scenario: Match type uses supported list
      Given the coach creates or edits a match
      Then match type must be chosen from "League", "Friendly", "Cup", or "Development"

    Scenario: Match stores opponent name
      Given the coach creates or edits a match
      When the coach records opponent name
      Then the match must store the opponent name
      And the opponent name must appear in match overview, match detail, matchday mode, and export

    Scenario: Match stores game format
      Given the coach creates or edits a match
      When the coach records game format
      Then game format must be one of "7-a-side", "9-a-side", or "11-a-side"
      And the game format must control available tactics board formations and pitch slot count

    Scenario: Coach can remove an unfinalized match
      Given a match exists without finalized selection history
      When the coach removes the match
      Then the match must be removed from the schedule
      And it must no longer appear in match round planning

    Scenario: Removing finalized match requires explicit confirmation
      Given a match has finalized selection history
      When the coach removes the match
      Then the app must require confirmation
      And must preserve enough historical information for planning-period review unless the coach explicitly deletes history


  Rule: Match round is the weekly selection unit

    The selection engine must treat a match round as the planning unit.
    A player can only be selected once in the same match round unless controlled double-load applies.
    The round-level pipeline runs in strict order: per-match core selection, round-level required support resolution, round-level conflict resolution, development routing, squad repair, controlled double-load evaluation, and post-pipeline validation.

    Scenario: Coach creates match round containing several team matches
      Given teams exist in the team registry
      When the coach creates a match round
      And the coach adds one match for each participating team
      Then the match round must store every included match
      And each match must keep its team, opponent, date, home-or-away status, match type, and game format

    Scenario: App generates all selections in a match round together
      Given match round "R1" contains matches for Team A, Team B, and Team C
      When the coach generates selections for match round "R1"
      Then the app must evaluate all matches in the match round together
      And the app must resolve player conflicts across all matches before finalizing any match selection

    Scenario: Round-level pipeline runs in strict phase order
      Given match round "R1" contains matches for Team A, Team B, and Team C
      When the app generates match round "R1"
      Then the app must first select core players per match
      And then resolve required support across all matches
      And then resolve cross-match player conflicts
      And then route development movements
      And then repair squads weakened by support movement
      And then evaluate controlled double-load candidates
      And then validate generated invariants and persist warnings

    Scenario: Round-level generation fills minimum core before rotation
      Given match round "R1" contains matches for Team A, Team B, and Team C
      And Team A has minimum core players 8
      And Team A has 12 available core players
      When the app generates match round "R1"
      Then the app must first select at least 8 Team A core players for Team A
      And then resolve support assignments across all matches
      And then route development movements and squad repair
      And then evaluate controlled double-load

    Scenario: Player can only be selected once per match round
      Given player "p1" has Team A as core team
      And match round "R1" contains a Team A match and a Team B match
      When player "p1" is selected for Team B
      Then player "p1" must not be selected for Team A in match round "R1"
      And player "p1" must be unavailable for all other matches in match round "R1"

    Scenario: Controlled double-load allows second selection with guard conditions
      Given player "p1" has Team A as core team
      And match round "R1" contains a Team A match on Saturday and a Team B match on Sunday
      And controlled double-load is enabled for the rotation path from Team A to Team B
      And minimum rest spacing between matches is met
      When the app evaluates controlled double-load for match round "R1"
      Then player "p1" may be selected for both Team A and Team B
      And the second selection must be marked as controlled double-load
      And fairness debt must be tracked for player "p1"

    Scenario: Controlled double-load rejected when rest spacing not met
      Given player "p1" has Team A as core team
      And match round "R1" contains a Team A match and a Team B match on the same date
      And controlled double-load is enabled for the rotation path from Team A to Team B
      When the app evaluates controlled double-load for match round "R1"
      Then player "p1" must not be selected twice
      And the app must reject the double-load because rest spacing is not met

    Scenario: Controlled double-load rejected when not explicitly enabled
      Given player "p1" has Team A as core team
      And match round "R1" contains a Team A match on Saturday and a Team B match on Sunday
      And controlled double-load is not enabled for any path in match round "R1"
      When the app evaluates controlled double-load for match round "R1"
      Then player "p1" must not be selected for both matches
      And the app must treat same-round uniqueness as the default rule

    Scenario: Match-round uniqueness overrides date spacing without controlled double-load
      Given player "p2" is selected for Team B in match round "R1"
      And player "p2" has Team A as core team
      And Team A has a match in match round "R1" at least 3 days later
      And controlled double-load is not enabled
      When match round "R1" is validated
      Then player "p2" must not be selected for Team A
      And the app must explain that match-round uniqueness applies unless controlled double-load is enabled

    Scenario: Date spacing applies outside same match round
      Given player "p3" is selected for a match in match round "R1"
      And player "p3" is considered for another match outside match round "R1"
      When the app evaluates both matches
      Then the app must apply configured date-spacing rules
      And the app must not apply match-round uniqueness unless both matches belong to the same match round


  Rule: Selection roles

    A selection can be core, support, backfill, development, confidence_rebuild, core_match_drop, reduced_match_load_drop, double_load, or manual_override.
    Backfill is the internal code role for squad repair — a player covering a squad gap caused by support movement.

    Scenario: Core selection
      Given player "p1" has Team A as core team
      When player "p1" is selected for Team A
      Then the selection role must be "core"

    Scenario: Support selection
      Given player "p2" has Team B as core team
      And Team B can support Team C through a configured rotation path
      When player "p2" is selected for Team C to make Team C functional
      Then the selection role must be "support"
      And the movement ledger must record from team "B" and to team "C"

    Scenario: Squad repair (backfill) selection
      Given Team B supplied player "b1" to Team C as support
      And Team A supplies player "a1" to Team B because Team B was weakened by that support
      When selections are finalized
      Then player "a1" selection role must be "backfill"
      And the movement ledger entry for player "a1" must reference the support movement that caused the squad repair

    Scenario: Development selection
      Given player "c1" has Team C as core team
      And Team C can supply development players to Team B
      When player "c1" is selected for Team B to receive harder match context
      Then the selection role must be "development"

    Scenario: Controlled double-load selection
      Given player "p1" is selected for Team A core in match round "R1"
      And player "p1" is also selected for Team B support in match round "R1" under controlled double-load
      When selections are finalized
      Then the second selection role must be "double_load"
      And the selection must reference the controlled double-load authorization
      And fairness debt must be recorded for player "p1"

    Scenario: Confidence rebuild selection
      Given player "p4" is selected outside their normal context to receive a safer match experience
      When the coach marks the selection purpose as confidence rebuild
      Then the selection role must be "confidence_rebuild"
      And the app must record the coach-provided reason

    Scenario: Manual override selection
      Given a coach manually changes a generated selection
      When the manual change breaks or bends a configured rule
      Then the app must require an override reason
      And the selection must be marked as "manual_override"


  Rule: Role precedence

    The round-level pipeline resolves roles in strict phase order: core selection, required support, conflict resolution, development routing, squad repair, controlled double-load evaluation, and validation.
    Support chains have precedence over development and core selections.
    Required support for higher-priority receiving teams must be resolved before lower-priority support.
    Squad repair caused by required support must be resolved before optional development.
    Development must be resolved before surplus drops are routed downstream.
    Controlled double-load is evaluated after all other movement is complete.
    Required support must be fulfilled before fairness optimization, cosmetic balancing, and generic rotation.
    If required support cannot be fulfilled, the app must generate a warning and must not silently weaken the receiving team.

    Scenario: Support is selected before development and core
      Given Team C requires support
      And player "b1" is eligible for Team C support
      And player "b1" is also eligible for Team A development
      And player "b1" is available for Team B core selection
      When the app resolves player assignment
      Then player "b1" must be considered for Team C support before Team A development
      And player "b1" must be considered for Team A development before Team B core

    Scenario: Round-level pipeline resolves phases in order
      Given match round "R1" contains matches for Team A, Team B, and Team C
      And Team C needs support
      And Team A has surplus core players eligible for development in Team B
      When the app generates match round "R1"
      Then the app must first select core players per match
      And then resolve required support assignments
      And then resolve cross-match player conflicts
      And then route development movements
      And then repair squads weakened by support
      And then evaluate controlled double-load
      And then validate invariants and persist warnings

    Scenario: Squad repair does not starve from development routing
      Given Team B needs squad repair after supplying support players
      And Team A has surplus core players eligible for both Team B squad repair and Team C development
      When the app routes core match drops
      Then Team B squad repair needs must be considered alongside Team C development needs
      And development priority must not prevent squad repair from reaching teams that lost support players

    Scenario: Development beats core when no support applies
      Given player "c1" has Team C as core team
      And player "c1" is eligible for Team B development
      And no support role applies to player "c1"
      When the app resolves match round selections
      Then player "c1" must be considered for Team B development before Team C core

    Scenario: Core is used when no higher-precedence role applies
      Given player "p1" has Team B as core team
      And player "p1" is not selected for support
      And player "p1" is not selected for squad repair
      And player "p1" is not selected for development
      When the app fills remaining squad slots
      Then player "p1" may be selected for Team B core

    Scenario: Required support is not bypassed due to fairness scoring
      Given Team C requires a minimum of 2 support players
      And player "b1" has high fairness debt and is eligible for Team C support
      And player "b2" has low fairness debt and is eligible for Team C development in another team
      And only player "b1" can fulfill the required support
      When the app resolves support assignments
      Then player "b1" must be assigned to Team C support regardless of fairness debt
      And fairness scoring must not override required support fulfillment

    Scenario: Warning is generated when required support cannot be fulfilled
      Given Team C requires a minimum of 2 support players
      And only 1 eligible support player is available
      When the app generates match round selections
      Then the app must generate a warning that Team C required support is not fulfilled
      And the app must not silently weaken Team C by accepting the shortfall without a warning

    Scenario: Warning is generated when no valid squad repair exists
      Given Team B supplied player "b1" as support to Team C
      And Team B is below target squad size after supplying support
      And no eligible squad repair candidate exists for Team B
      When the app resolves squad repair
      Then the app must generate a warning that Team B squad repair could not be fulfilled
      And the app must not silently leave Team B weakened

    Scenario: Controlled double-load is evaluated after all other phases
      Given match round "R1" has completed core, support, conflict, development, and squad repair phases
      And controlled double-load is enabled for some rotation paths
      When the app evaluates controlled double-load
      Then only players not yet selected in the round may be considered for double-load
      And double-load must respect date spacing, rest rules, and fairness debt tracking


  Rule: Rule severity

    Rules can be hard_block, requires_override, warning, or scoring_preference.

    Scenario: Hard block requires override reason to finalize
      Given player "p1" is selected twice in the same match round
      When the app validates the match round
      Then validation must fail with severity "hard_block"
      And the coach can still finalize by providing an override reason

    Scenario: Requires override allows coach decision with reason
      Given Team C falls below minimum support count
      When the coach attempts to finalize the match round
      Then the app must require a manual override reason
      And the warning severity must be "requires_override"

    Scenario: Warning does not block finalization
      Given Team A is below target squad size but above minimum accepted squad size
      When the app validates the match round
      Then the app must show a warning
      And the app may allow finalization

    Scenario: Scoring preference affects ranking
      Given two players are eligible for the same support role
      And one player has primary position matching the support need
      When the app ranks support candidates
      Then the primary position match should rank higher as a scoring preference


  Rule: Rotation graph

    RotationPath is the single source of truth for non-core player movement.
    A player may only be selected outside their core team when an active directed RotationPath exists from the player's core team to the target team for the exact role being assigned, unless a manual override with reason is used.

    Support paths permit only SUPPORT.
    Development paths permit only DEVELOPMENT.
    Backfill paths permit only BACKFILL.
    A SUPPORT path does not permit DEVELOPMENT.
    A DEVELOPMENT path does not permit SUPPORT.
    A BACKFILL path does not permit SUPPORT or DEVELOPMENT.

    Paths are directional: from_team to to_team only.
    No configured path means no non-core automatic selection.
    Fairness scoring cannot make an invalid path valid.
    The legacy TeamSupportSource and TeamDevelopmentSource relationship tables must not drive selection eligibility or movement decisions. They exist for backward-compatible UI configuration display only and are scheduled for removal.

    Player movement between teams must follow configured rotation paths.
    Teams are nodes and paths are directed edges.
    The app must not infer movement that has not been configured.

    Scenario: Coach defines rotation paths
      Given Team A, Team B, and Team C exist
      When the coach defines these paths:
        | from_team | to_team | role        | purpose                 |
        | A         | B       | backfill    | stabilize donor team     |
        | B         | C       | support     | leadership and support   |
        | B         | A       | development | harder match context     |
        | C         | B       | development | harder match context     |
      Then players may only move along those configured paths
      And every non-core selection must reference a valid path unless manually overridden

    Scenario: Rotation paths are directional
      Given a path exists from Team C to Team B for development
      When the app generates selections
      Then Team C players may be considered for Team B development
      But Team B players must not be considered for Team C development unless a separate path exists

    Scenario: Rotation graph supports any number of teams
      Given teams Team A, Team B, Team C, Team D, Team E, and Team F exist
      And configured paths exist between some of those teams
      When the app generates selections
      Then the app must use the configured paths
      And the app must not assume built-in meaning for any team name

    Scenario: Rotation path cannot reference unknown team
      Given Team A and Team B exist
      When the coach creates a path from Team X to Team B
      Then the app must reject the path
      And explain that Team X does not exist

    Scenario: Rotation path cannot use same source and target team
      Given Team A exists
      When the coach creates a path from Team A to Team A
      Then the app must reject the path
      And explain that source and target team must differ

    Scenario: No path means no non-core automatic selection
      Given Team A has no rotation path to Team C
      When Team C needs support
      Then Team A players must not be automatically selected for Team C in any non-core role

    Scenario: Legacy support relationship tables must not drive selection
      Given Team A has a TeamSupportSource relationship to Team C
      And no active RotationPath with role SUPPORT exists from Team A to Team C
      When Team C needs support
      Then Team A players must not be selected as support for Team C based on the legacy relationship alone

    Scenario: Fairness scoring cannot override path validity
      Given player "p1" has high fairness need
      And player "p1" has no valid rotation path to Team C
      When Team C needs support
      Then player "p1" must not be selected for Team C regardless of fairness score

  Rule: Rotation path role specificity

    Each rotation path authorizes exactly one role between two teams.
    A path with role SUPPORT authorizes only SUPPORT movement.
    A path with role DEVELOPMENT authorizes only DEVELOPMENT movement.
    A path with role BACKFILL authorizes only BACKFILL movement.
    The selection engine must check path role before assigning any non-core selection category.

    Scenario: Team A has no SUPPORT path to Team C and Team B has SUPPORT path to Team C
      Given Team B has an active SUPPORT path to Team C
      And Team A has no SUPPORT path to Team C
      When Team C needs support
      Then Team A players must not be considered for Team C support
      And Team B players may be considered for Team C support

    Scenario: Team A has DEVELOPMENT path to Team C but no SUPPORT path
      Given Team A has an active DEVELOPMENT path to Team C
      And Team A has no SUPPORT path to Team C
      When Team C needs support
      Then Team A players must not be considered for support

    Scenario: Team A has BACKFILL path to Team C but no SUPPORT path
      Given Team A has an active BACKFILL path to Team C
      And Team A has no SUPPORT path to Team C
      When Team C needs support
      Then Team A players must not be considered for support

    Scenario: Team A has SUPPORT path to Team C but no DEVELOPMENT path
      Given Team A has an active SUPPORT path to Team C
      And Team A has no DEVELOPMENT path to Team C
      When a Team A player is considered for Team C development
      Then the player must not be considered for development unless a DEVELOPMENT path also exists

    Scenario: Path direction matters — reverse direction requires separate path
      Given Team B has an active SUPPORT path to Team C
      And Team C has no SUPPORT path to Team B
      When Team B needs support
      Then Team C players must not support Team B through the Team B to Team C path

    Scenario: Support failure produces warning instead of pulling from invalid team
      Given Team C needs support
      And no valid SUPPORT path candidates exist from any team
      When the round is generated
      Then no invalid players are selected as support
      And a support shortfall warning is created


  Rule: Non-rotatable players

    Players are rotatable by default.
    A coach may explicitly mark any player as non_rotatable.
    The app must not infer non_rotatable from position, role, skill level, attribute rating, or team.

    Scenario: Player is rotatable by default
      Given player "p1" has Team B as core team
      And player "p1" is not marked non_rotatable
      And Team B can support Team C
      When the app ranks support candidates for Team C
      Then player "p1" may be considered for Team C support

    Scenario: Non-rotatable player is excluded from non-core selection
      Given player "p2" has Team B as core team
      And player "p2" is marked non_rotatable
      And Team B can support Team C
      And Team B can supply development players to Team A
      When the app generates match round selections
      Then player "p2" must not be considered for Team C support
      And player "p2" must not be considered for Team A development
      And player "p2" may still be considered for Team B core

    Scenario: Position does not automatically make player non-rotatable
      Given player "p3" has primary position "GK"
      And player "p3" is not marked non_rotatable
      And player "p3" has Team B as core team
      And Team B can support Team C
      When the app ranks support candidates for Team C
      Then player "p3" may be considered for Team C support

    Scenario: Coach can override non-rotatable restriction
      Given player "p4" is marked non_rotatable
      And Team A can support Team B
      When the coach manually selects player "p4" outside their core team
      Then the app must require an override reason
      And warn that non_rotatable restriction was overridden


  Rule: Availability and reliability

    Availability beats all football logic.
    Unknown or tentative players must not satisfy critical support unless manually confirmed.

    Scenario: Unavailable player cannot be selected
      Given player "p1" is marked unavailable for match round "R1"
      When the app generates selections for match round "R1"
      Then player "p1" must not be selected

    Scenario: Unknown availability cannot satisfy required support
      Given Team C requires 3 support players
      And player "b1" is eligible for Team C support
      And player "b1" has availability "unknown"
      When the app generates selections
      Then player "b1" must not count toward Team C required support
      And the app should warn that player "b1" needs confirmation

    Scenario: Tentative player can be used only with warning
      Given player "b2" is eligible for Team C support
      And player "b2" has availability "tentative"
      When the app selects player "b2"
      Then the app must warn that the player is tentative

    Scenario: No-show affects support reliability
      Given player "b3" was selected as support and did not show up
      When the app updates player history
      Then player "b3" support reliability should be lowered
      And future critical support use should require confirmation or warning

    Scenario: Fairness ignores unavailable rounds
      Given player "p5" was unavailable for 3 match rounds
      And available for 2 match rounds
      When the app calculates fairness
      Then the app must calculate fairness from available rounds
      And not from calendar rounds


  Rule: Team squad size configuration

    Each team can have target squad size, minimum accepted squad size, maximum squad size, and minimum core players.
    Target squad size is a planning target, not a hard cap. A team may be selected above target up to maximum squad size.
    Minimum accepted squad size and maximum squad size are hard boundaries.
    Stronger teams may be configured to tolerate smaller squads than weaker teams.

    Scenario: Target squad size is a planning target not a hard cap
      Given Team C has target squad size 9
      And Team C has minimum accepted squad size 7
      And Team C has maximum squad size 11
      And Team C receives 10 core and support players
      When the app generates Team C selection
      Then Team C must be allowed to have 10 players
      And the app must not cap Team C at target squad size 9
      And the app must not exceed maximum squad size 11

    Scenario: Team can be selected below target but above minimum
      Given Team A has target squad size 11
      And Team A has minimum accepted squad size 9
      When Team A supplies players downstream
      Then Team A may be selected with 9 or 10 players
      And the app must warn that Team A is below target
      But the app must not block finalization unless Team A falls below 9 players

    Scenario: Team cannot fall below minimum accepted squad size
      Given Team B has minimum accepted squad size 10
      When the app generates Team B selection
      Then Team B must not be selected with fewer than 10 players unless manually overridden

    Scenario: Team cannot exceed maximum squad size
      Given Team C has maximum squad size 12
      When the app generates Team C selection
      Then Team C must not have more than 12 selected players unless manually overridden

    Scenario: Minimum core players must be respected
      Given Team C has minimum core players 8
      When Team C receives support players
      Then the app must not reduce Team C core players below 8 unless manually overridden

    Scenario: Donor team minimum core players must be respected during support resolution
      Given Team B has minimum core players 8
      And Team B has 10 available core players
      And Team C needs support from Team B
      When the app resolves support for Team C
      Then the app must not move Team B core players if doing so would leave Team B below 8 core players
      And Team B excluded core players may still be moved to support if available

    Scenario: Team below target re-includes own excluded core players
      Given Team A has target squad size 11
      And Team A has minimum core players 8
      And Team A starts with 8 core selected and 3 core excluded as surplus
      When the app finishes round-level rotation
      Then Team A must re-include its own excluded core players until reaching target squad size or running out of own excluded players
      And Team A must not re-include players assigned to other teams

    Scenario: Re-included players do not duplicate across matches
      Given player "b1" from Team B is routed to Team H as support
      And Team B is below target squad size after rotation
      When the app re-includes Team B excluded players
      Then player "b1" must not appear in both Team B and Team H
      And player "b1" must remain assigned to Team H


  Rule: Support counts and receiving team priority

    Teams can define minimum, target, and maximum support counts.
    The app must aim for target support, accept minimum only when target cannot be reached, and require override below minimum.
    Receiving teams can have different support priority.

    Scenario: App aims for target support count
      Given Team C has minimum support count 2
      And Team C has target support count 3
      And Team C has maximum support count 4
      And 3 eligible support players are available
      When the app generates Team C selection
      Then Team C should receive 3 support players
      And the app must not stop after selecting only 2 support players

    Scenario: App accepts minimum support count when target cannot be reached
      Given Team C has minimum support count 2
      And Team C has target support count 3
      And only 2 eligible support players are available after hard rules are applied
      When the app generates Team C selection
      Then Team C may receive 2 support players
      And the app must warn that target support was not reached

    Scenario: App requires override below minimum support
      Given Team C has minimum support count 2
      And only 1 eligible support player is available
      When the app generates Team C selection
      Then the app must flag support below minimum
      And require manual override before finalization

    Scenario: Lower-numbered support priority is resolved first
      Given Team C has support priority 1
      And Team B has support priority 2
      And both Team B and Team C need support in the same match round
      When the app generates support selections
      Then Team C support needs must be resolved before Team B support needs

    Scenario: Support priority ascending sort order
      Given Team A has support priority 10
      And Team B has support priority 30
      And Team C has support priority 100
      And all three teams need support in the same match round
      When the app generates support selections
      Then Team A support must be resolved first
      And Team B support must be resolved second
      And Team C support must be resolved last
      And lower support priority number means higher urgency


  Rule: Support chains and squad repair

    A team may support a downstream team and then receive squad repair from an upstream team.
    Support chains may cascade only through configured paths.
    A support chain must not cycle.
    Squad repair is a direct consequence of support movement.
    When a player is moved from their core team as support, their team may need squad repair.
    Squad repair must follow a strict priority order.

    Scenario: Team B supports Team C before Team B receives squad repair
      Given Team C has higher support priority than Team B
      And Team C needs 3 support players from Team B
      And Team A can supply squad repair to Team B
      When the app generates selections
      Then the app should first select eligible Team B players for Team C support
      And then select eligible Team A players to repair Team B if Team B falls below target squad size or minimum accepted squad size

    Scenario: Upstream team may be weakened within accepted floor
      Given Team B requires squad repair from Team A
      And Team A has target squad size 11
      And Team A has minimum accepted squad size 9
      When Team A supplies squad repair players to Team B
      Then Team A may be left with 9 or 10 players
      But Team A must not be left with fewer than 9 players unless manually overridden

    Scenario: Support chain fails when upstream minimum is broken
      Given Team C needs support from Team B
      And Team B needs squad repair from Team A
      And selecting Team A squad repair would leave Team A below minimum accepted squad size
      When the app generates the match round
      Then the app must not automatically complete the full repair chain
      And the app must explain which team would fall below minimum accepted squad size
      And the app must require manual override or reduced support or larger squad size

    Scenario: Donor minimum core players must be preserved during support
      Given Team B has minimum core players 8
      And Team B has exactly 8 core players currently selected
      And Team C needs 2 support players from Team B
      When the app resolves support assignments
      Then the app must not move any Team B selected core players to Team C support
      And the app must only offer Team B excluded core players for support

    Scenario: Squad repair chain cannot cycle
      Given Team A can repair Team B
      And Team B can repair Team A
      When the app resolves a squad repair chain
      Then the app must stop if a team would appear twice in the same chain
      And warn that the repair configuration creates a cycle


  Rule: Squad repair priority order

    When a player is moved from their core team as support, their team may need squad repair.
    Squad repair must follow a strict priority order.
    Non-rotatable players must never be used as generic squad repair.
    If no valid squad repair exists, the app must generate a warning instead of silently weakening the team.

    Scenario: Squad repair priority 1 — own core team player moved as support can play both matches
      Given player "b1" has Team B as core team
      And player "b1" was moved from Team B core to Team C support
      And Team B match and Team C match are on different dates
      And player "b1" can play both matches without violating same-round rules
      When the app resolves squad repair for Team B
      Then player "b1" must be considered as squad repair priority 1
      And player "b1" should be ranked above all other squad repair candidates

    Scenario: Squad repair priority 2 — development source team players
      Given Team B needs squad repair after supplying support
      And no own-core-team player is eligible for squad repair priority 1
      And player "d1" is from a team with an active DEVELOPMENT rotation path to Team B
      And player "d1" is not marked as non-rotatable
      When the app resolves squad repair for Team B
      Then player "d1" must be considered as squad repair priority 2
      And player "d1" should be ranked above generic squad repair candidates from other teams

    Scenario: Squad repair priority 2 uses DEVELOPMENT path for team direction and assigns BACKFILL role
      Given Team B needs squad repair after supplying support
      And an active DEVELOPMENT rotation path exists from Team A to Team B
      And player "d1" has Team A as core team
      And player "d1" is not marked as non-rotatable
      When the app resolves squad repair priority 2 for Team B
      Then player "d1" may be selected from Team A because the DEVELOPMENT path gates the team-to-team direction
      And player "d1" must be assigned the role "backfill" not "development"
      And the selection must reference the DEVELOPMENT path as the movement authority

    Scenario: Squad repair priority 2 does not use SUPPORT path as authority
      Given Team B needs squad repair after supplying support
      And a SUPPORT rotation path exists from Team A to Team B
      And no DEVELOPMENT path exists from Team A to Team B
      And no BACKFILL path exists from Team A to Team B
      And player "s1" has Team A as core team
      And player "s1" is not marked as non-rotatable
      When the app resolves squad repair priority 2 for Team B
      Then player "s1" must not be considered for squad repair priority 2 based on the SUPPORT path alone

    Scenario: Squad repair priority 3 — any other non-rotatable-false player with BACKFILL path
      Given Team B needs squad repair after supplying support
      And no own-core-team player is eligible for squad repair priority 1
      And no development source team player is available for squad repair priority 2
      And player "x1" is from another team with a configured BACKFILL rotation path to Team B
      And player "x1" is not marked as non-rotatable
      When the app resolves squad repair for Team B
      Then player "x1" may be considered as squad repair priority 3

    Scenario: Non-rotatable player is never used as generic squad repair
      Given Team B needs squad repair after supplying support
      And player "n1" is from another team with a configured BACKFILL rotation path to Team B
      And player "n1" is marked as non-rotatable
      When the app resolves squad repair for Team B
      Then player "n1" must not be selected as squad repair
      And the app must not use player "n1" to fill any squad repair slot

    Scenario: Squad repair must respect same-round conflict rules
      Given Team B needs squad repair
      And player "x1" is eligible for Team B squad repair by priority 3
      And player "x1" is already selected for another match in the same match round
      When the app resolves squad repair for Team B
      Then player "x1" must not be selected as squad repair
      And the app must respect same-round player uniqueness unless controlled double-load explicitly allows

    Scenario: Warning when no valid squad repair exists for weakened team
      Given Team B supplied player "b1" as support to Team C
      And Team B is below minimum accepted squad size after supplying support
      And no eligible squad repair candidate exists at any priority level
      When the app resolves squad repair
      Then the app must generate a warning that Team B squad repair could not be fulfilled
      And the app must not silently accept the shortfall


  Rule: Controlled double-load

    Same-round player uniqueness is the default rule. Controlled double-load is an explicit exception that allows a player to be selected for two matches in the same round under strict guard conditions.
    Controlled double-load must not be treated as normal rotation. It is a planned exception with fairness debt tracking.

    A controlled double-load requires all of the following:
    - The two matches are on different dates
    - Minimum rest spacing between matches is met (configurable per rotation path)
    - Controlled double-load is explicitly enabled for the rotation path or team configuration
    - The player has not exceeded the configured maximum double-load count in the planning period
    - Fairness debt is tracked for the double-loaded player
    - The player is rotated out of double-load eligibility if other eligible players exist

    Scenario: Controlled double-load allowed when all guard conditions are met
      Given player "p1" has Team A as core team
      And match round "R1" contains a Team A match on Saturday and a Team B match on Sunday
      And controlled double-load is enabled for the rotation path from Team A to Team B
      And rest spacing between Saturday and Sunday meets the minimum requirement
      And player "p1" has not exceeded the maximum double-load count in the planning period
      When the app evaluates controlled double-load for match round "R1"
      Then player "p1" may be selected for both matches
      And the second selection role must be "double_load"
      And fairness debt must be recorded for player "p1"

    Scenario: Controlled double-load rejected when matches are on the same date
      Given player "p1" has Team A as core team
      And match round "R1" contains a Team A match and a Team B match on the same date
      And controlled double-load is enabled for the rotation path from Team A to Team B
      When the app evaluates controlled double-load for match round "R1"
      Then player "p1" must not be selected for both matches
      And the app must reject the double-load because matches are on the same date

    Scenario: Controlled double-load rejected when rest spacing is not met
      Given player "p1" has Team A as core team
      And match round "R1" contains a Team A match on Saturday morning and a Team B match on Saturday afternoon
      And controlled double-load is enabled for the rotation path from Team A to Team B
      And minimum rest spacing is 24 hours
      When the app evaluates controlled double-load for match round "R1"
      Then player "p1" must not be selected for both matches
      And the app must reject the double-load because rest spacing is not met

    Scenario: Controlled double-load rejected when not explicitly enabled
      Given player "p1" has Team A as core team
      And match round "R1" contains a Team A match on Saturday and a Team B match on Sunday
      And controlled double-load is not enabled for any path in match round "R1"
      When the app evaluates controlled double-load for match round "R1"
      Then player "p1" must not be selected for both matches
      And same-round uniqueness must apply as the default rule

    Scenario: Controlled double-load rejected when player exceeds maximum count
      Given player "p1" has already been double-loaded twice in this planning period
      And the maximum double-load count per player per planning period is 2
      And controlled double-load is enabled for the rotation path
      And matches are on different dates with sufficient rest spacing
      When the app evaluates controlled double-load for the current match round
      Then player "p1" must not be selected for double-load
      And the app must prefer another eligible player who has not exceeded the maximum

    Scenario: Controlled double-load rotates across eligible players
      Given player "p1" and player "p2" are both eligible for double-load in the same match round
      And player "p1" has been double-loaded once in the planning period
      And player "p2" has never been double-loaded
      When the app selects double-load candidates
      Then player "p2" should rank above player "p1"
      And double-load burden must rotate fairly across eligible players

    Scenario: Controlled double-load fairness debt is tracked
      Given player "p1" is selected for a controlled double-load in match round "R1"
      When the app calculates fairness for the planning period
      Then player "p1" fairness debt must include the extra match load from double-load
      And the extra load must be factored into future selection and rotation decisions

    Scenario: Controlled double-load cannot bypass rotation path validation
      Given player "p1" has Team A as core team
      And no rotation path exists from Team A to Team B
      And controlled double-load is enabled globally
      When the app evaluates controlled double-load for a Team A to Team B movement
      Then player "p1" must not be double-loaded to Team B
      And rotation path validation applies to double-load just as it does to all other non-core movement

    Scenario: Non-rotatable player cannot be double-loaded outside core team
      Given player "p1" is marked as non-rotatable
      And controlled double-load is enabled for a rotation path from Team A to Team B
      When the app evaluates controlled double-load
      Then player "p1" must not be selected for double-load outside their core team


  Rule: Core match drops and downstream routing

    A core_match_drop happens when a core team has more available core players than target squad size.
    A core_match_drop candidate should be routed downstream through valid configured paths when possible.

    Scenario: Surplus core player becomes core match drop candidate
      Given Team A has target squad size 11
      And Team A has 12 available core players
      When the app generates selections
      Then 11 Team A core players should be selected for Team A
      And 1 Team A core player should be marked as core_match_drop candidate

    Scenario: Core match drop is prioritized downstream
      Given player "a1" is a Team A core_match_drop candidate
      And Team A can supply Team B through a configured downstream path
      And Team B has a valid slot
      When the app selects Team B players
      Then player "a1" should be considered before ordinary development candidates
      And player "a1" should be selected for Team B if no hard rule blocks the selection

    Scenario: Core match drop respects position fit
      Given player "a1" is a Team A core_match_drop candidate
      And player "a1" has primary position "ST"
      And Team B needs a "CB"
      And player "a2" is eligible and has primary position "CB"
      When the app selects Team B squad repair
      Then player "a2" should rank above player "a1"

    Scenario: Core match drop cannot be forced into invalid slot
      Given player "a1" is a Team A core_match_drop candidate
      And Team B has no valid slot
      When the app generates selections
      Then player "a1" must not be forced into Team B
      And the app should warn that player "a1" could not be routed downstream

    Scenario: Core match drop routing prioritizes unfilled development slots
      Given player "a1" is a Team A core_match_drop candidate
      And Team B has unfilled development slots
      And Team C has squad repair slots but no development slots
      And Team A can supply both Team B and Team C through configured paths
      When the app routes core match drops
      Then player "a1" should be prioritized for Team B development over Team C squad repair
      And the app must assign a development priority bonus when the target team has unfilled development slots


  Rule: Reduced match load

    A coach can mark a player as reduced_match_load_allowed.
    This means the player may occasionally sit out when squad pressure exists.
    The app must not infer this from skill, team, position, or attribute rating.
    A reduced-load player may not be automatically dropped twice in a row.
    After being dropped, the player must play before becoming eligible for automatic drop again.

    Scenario: Reduced-load player may be dropped once
      Given player "c1" has Team C as core team
      And player "c1" is marked reduced_match_load_allowed
      And player "c1" played in the previous match round
      And Team C exceeds target squad size because required support players are selected
      When the app chooses Team C core_match_drop players
      Then player "c1" may be selected as core_match_drop

    Scenario: Reduced-load player cannot be dropped twice before playing
      Given player "c1" has Team C as core team
      And player "c1" is marked reduced_match_load_allowed
      And player "c1" was selected as core_match_drop in the previous match round
      And player "c1" has not played since
      When the app chooses Team C core_match_drop players
      Then player "c1" must not be automatically dropped
      And player "c1" should be protected for core selection

    Scenario: Reduced-load player becomes eligible after playing again
      Given player "c1" has Team C as core team
      And player "c1" is marked reduced_match_load_allowed
      And player "c1" was selected as core_match_drop two match rounds ago
      And player "c1" played in the previous match round
      When Team C exceeds target squad size
      Then player "c1" may be considered for core_match_drop again

    Scenario: Reduced-load flag does not override manual lock-in
      Given player "c2" is marked reduced_match_load_allowed
      And player "c2" is manually locked in for Team C
      When the app generates selections
      Then player "c2" must remain selected unless a hard rule is broken

    Scenario: Reduced-load flag does not override position structure
      Given Team C needs a required position
      And player "c3" is the only selected player covering that required position
      And player "c3" is marked reduced_match_load_allowed
      When the app chooses core_match_drop players
      Then player "c3" should not be automatically dropped
      And the app should preserve required position structure


  Rule: Position-aware selection

    Primary position must be considered first.
    Secondary and tertiary positions are fallback options.
    Non-matching position is last resort and must produce warning when selected for a position-sensitive role.

    Scenario: Primary position is prioritized for support
      Given Team C needs 1 support player with position "CB"
      And player "b1" has primary position "CB"
      And player "b2" has primary position "ST"
      And both players are eligible to support Team C
      When the app ranks support candidates
      Then player "b1" should rank above player "b2"

    Scenario: Secondary position is fallback
      Given Team C needs 1 support player with position "CB"
      And no eligible player has primary position "CB"
      And player "b1" has secondary position "CB"
      And player "b2" has tertiary position "CB"
      When the app ranks support candidates
      Then player "b1" should rank above player "b2"

    Scenario: Tertiary position is fallback after secondary
      Given Team C needs 1 support player with position "CB"
      And no eligible player has primary or secondary position "CB"
      And player "b1" has tertiary position "CB"
      When the app ranks support candidates
      Then player "b1" may be selected as positional fallback

    Scenario: Non-matching position is last resort
      Given Team C needs 1 support player with position "CB"
      And no eligible player has primary, secondary, or tertiary position "CB"
      And player "b1" is eligible for support but has no "CB" position
      When the app selects player "b1"
      Then the app must warn that the selected support player does not match requested position

    Scenario: Backfill tries to replace lost position
      Given player "b1" has Team B as core team
      And player "b1" has primary position "CB"
      And player "b1" is selected to support Team C
      And Team B needs squad repair from Team A
      And player "a1" has primary position "CB"
      And player "a2" has primary position "ST"
      When the app selects Team B squad repair
      Then player "a1" should rank above player "a2"


  Rule: Player suitability and readiness

    Support suitability and development readiness are explicit coach-controlled fields.
    The app must not infer these solely from skill level or attributes.

    Scenario: Support selection prefers strong support suitability
      Given player "b1" has support suitability "strong"
      And player "b2" has support suitability "avoid"
      And both players are eligible for Team C support
      When the app ranks support candidates
      Then player "b1" should rank above player "b2"

    Scenario: Player with support suitability avoid is last resort
      Given player "b2" has support suitability "avoid"
      And Team C needs support
      When other eligible support players are available
      Then player "b2" should not be selected automatically

    Scenario: Development rotation requires readiness
      Given player "c1" has development readiness "not_ready"
      And Team C can supply development players to Team B
      When the app ranks development candidates
      Then player "c1" should not be selected unless manually overridden

    Scenario: Weak but hungry player can be development ready
      Given player "c2" has current skill level "low"
      And player "c2" has development readiness "ready"
      And player "c2" has regular attendance
      And player "c2" has strong effort
      When the app ranks Team C to Team B development candidates
      Then player "c2" may be considered for development rotation


  Rule: Support cooldown and rotation fairness

    Support roles must rotate.
    A player who supported the same path in the previous configured cooldown window should not be selected for that same path again.

    Scenario: Support player is blocked by path cooldown
      Given player "b1" supported Team C from Team B in match round "R1"
      And support cooldown for path Team B to Team C is 1 match round
      When the app generates match round "R2"
      Then player "b1" must not be automatically eligible for Team B to Team C support
      And player "b1" may be eligible for Team B core selection

    Scenario: Support cooldown applies per path
      Given player "b1" supported Team C from Team B in match round "R1"
      And Team B can also support Team D
      When the app generates match round "R2"
      Then player "b1" must not be eligible for Team B to Team C support
      But player "b1" may be eligible for Team B to Team D support if allowed by configuration

    Scenario: App rotates support players when alternatives exist
      Given player "b1" supported Team C last match round
      And player "b2" is eligible to support Team C
      When the app selects Team C support
      Then player "b2" should rank above player "b1"

    Scenario: First match round must still produce rotation
      Given this is the first match round in a planning period
      And no historical selections exist
      And Team C needs support from Team B
      And Team B has eligible support players
      When the app generates the match round
      Then the app must still assign support players to Team C
      And cooldown must not prevent rotation because no previous round exists

    Scenario: Consecutive support rounds penalize the player in ranking
      Given player "p1" has been selected as SUPPORT for 2 consecutive finalized rounds
      And player "p2" is equally eligible for SUPPORT
      And player "p2" has 0 consecutive support rounds
      When the app ranks SUPPORT candidates
      Then player "p2" must rank above player "p1"

    Scenario: Consecutive support penalty increases with more consecutive rounds
      Given player "p1" has been selected as SUPPORT for 3 consecutive finalized rounds
      And player "p2" has been selected as SUPPORT for 2 consecutive finalized rounds
      When the app ranks SUPPORT candidates
      Then player "p2" must rank above player "p1"

    Scenario: Consecutive support penalty does not apply for 1 or 0 rounds
      Given player "p1" has been selected as SUPPORT for 1 finalized round
      When the app ranks SUPPORT candidates
      Then player "p1" must receive no consecutive support penalty

    Scenario: Consecutive support penalty only affects SUPPORT candidates
      Given player "p1" has been selected as SUPPORT for 3 consecutive finalized rounds
      And player "p1" is now a DEVELOPMENT candidate
      When the app ranks DEVELOPMENT candidates
      Then player "p1" must receive no consecutive support penalty

    Scenario: Consecutive support penalty does not prevent selection when no other candidate exists
      Given player "p1" has been selected as SUPPORT for 3 consecutive finalized rounds
      And no other eligible support candidates exist
      When the app selects Team C support
      Then player "p1" must still be selected as support


  Rule: Planning period fairness

    The app must track fairness using available rounds, not calendar rounds.
    Players must not build selection debt for rounds where they were unavailable.
    Fairness optimization must not override required support fulfillment.
    Fairness is a scoring preference, not a hard rule.

    Scenario: Fairness scoring must not override required support
      Given Team C requires a minimum of 2 support players
      And player "b1" has high fairness debt meaning player "b1" has served many support rotations
      And player "b1" is the only eligible candidate to fulfill Team C required support
      When the app resolves support assignments
      Then player "b1" must be assigned to Team C support
      And fairness optimization must not prevent required support from being fulfilled

    Scenario: Unavailable rounds do not create fairness debt
      Given player "p1" was unavailable for 3 match rounds
      And player "p1" was available for 2 match rounds
      When the app calculates fairness
      Then the app must calculate fairness from available rounds only
      And the 3 unavailable rounds must not count against player "p1" fairness balance

    Scenario: Player with fewer support duties is preferred
      Given player "b1" and player "b2" are eligible to support Team C
      And player "b1" has supported Team C 2 times in the active planning period
      And player "b2" has supported Team C 0 times in the active planning period
      When the app ranks support candidates
      Then player "b2" should rank above player "b1"

    Scenario: Development candidate with no exposure is preferred
      Given player "c1" and player "c2" are eligible for Team B development
      And player "c1" has received 0 development rotations in the active planning period
      And player "c2" has received 2 development rotations in the active planning period
      When the app ranks development candidates
      Then player "c1" should rank above player "c2"

    Scenario: Player with too few core matches is protected
      Given player "b1" is eligible to support Team C
      And player "b1" has fewer than minimum core matches while available in the active planning period
      When the app ranks Team C support candidates
      Then player "b1" should be deprioritized for support
      And player "b1" should be prioritized for Team B core selection

    Scenario: Player repeatedly used downwards is flagged
      Given player "b1" has played more support matches than core matches in the active planning period
      When the coach opens planning period review
      Then the app must flag player "b1" for support burden review

    Scenario: Player repeatedly used upwards is flagged
      Given player "c1" has played more development matches than core matches in the active planning period
      When the coach opens planning period review
      Then the app must flag player "c1" for hidden promotion review

    Scenario: Player with no core matches is flagged
      Given player "p1" was available for several match rounds
      And player "p1" has no core selections in the active planning period
      When the coach opens planning period review
      Then the app must flag player "p1" for core exposure review


  Rule: Team burden and continuity

    The app must protect teams, not only individual players.
    A donor team can be hollowed out even if individual rotation seems fair.

    Scenario: Donor team burden is tracked
      Given Team B has donated players to Team C in every match round of the active planning period
      When the app opens Team B health
      Then the app must show high donor burden
      And recommend squad repair or reduced optional movement if configured

    Scenario: High-priority downstream support still wins
      Given Team C has highest support priority
      And Team B has high donor burden
      And Team C still requires support
      When the app generates the next match round
      Then Team C support must still be prioritized
      And the app should try to reduce Team B burden through Team A squad repair

    Scenario: Team continuity warning
      Given Team B has more than configured maximum player changes from previous round
      When the app validates the match round
      Then the app must warn that Team B continuity is low

    Scenario: Team receives too little support over time
      Given Team C has missed target support in several match rounds in the active planning period
      When the coach opens Team C health
      Then the app must flag repeated support shortage


  Rule: Manual locks and overrides

    Coaches can lock players in or out.
    Manual locks are applied before automatic generation but still validated against hard rules.

    Scenario: Locked-out player cannot be selected
      Given player "p1" is manually locked out of match round "R1"
      When the app generates selections
      Then player "p1" must not be selected

    Scenario: Locked-in player is preserved
      Given player "p2" is manually locked in for Team C support
      When the app generates selections
      Then player "p2" must remain selected unless a hard rule is broken

    Scenario: Manual override requires reason category
      Given the coach manually overrides a rule
      When the coach saves the override
      Then the app must require a reason category
      And may allow free-text explanation
      And must store who changed it and when

    Scenario: Manual override cannot select player twice
      Given player "p3" is selected for Team C support
      When the coach manually selects player "p3" for Team B core in the same match round
      Then the app must reject the selection
      And explain that a player can only be selected once per match round


  Rule: Late dropout repair

    The app must repair generated selections with minimal disruption when a selected player drops out.

    Scenario: Late dropout replaces same role from same source
      Given player "b1" drops out from Team C support
      And player "b2" is eligible for the same Team B to Team C support path
      When the coach runs repair mode
      Then the app should replace "b1" with "b2"
      And avoid changing unrelated selections

    Scenario: Repair mode can reduce target to minimum
      Given Team C target support count is 3
      And Team C minimum support count is 2
      And a support player drops out
      And no eligible replacement exists
      When the coach runs repair mode
      Then the app may reduce Team C support to 2
      And warn that target support was not reached

    Scenario: Repair mode explains impossible repair
      Given Team C falls below minimum support after dropout
      And no eligible replacement exists
      When the coach runs repair mode
      Then the app must explain why repair failed
      And require manual override or manual selection change

    Scenario: Repair mode changes as little as possible
      Given match round "R1" has a draft selection
      And one selected player drops out
      When the coach runs repair mode
      Then the app should only change selections affected by the dropout
      And must preserve unrelated selections unless a hard rule requires change


  Rule: Rule configuration validation

    Bad rule configuration must be caught before match generation.

    Scenario: Support requirement must have valid source path
      Given Team C has minimum support count 2
      And no rotation path allows any team to support Team C
      When the app validates rule configuration
      Then the app must reject the configuration
      And explain that Team C requires support but has no valid support source

    Scenario: Minimum core plus minimum support cannot exceed maximum squad
      Given Team C has minimum core players 9
      And Team C has minimum support count 3
      And Team C has maximum squad size 11
      When the app validates rule configuration
      Then the app must reject the configuration
      And explain that minimum core plus minimum support exceeds maximum squad size

    Scenario: Target squad cannot be below minimum accepted squad
      Given Team A has target squad size 9
      And Team A has minimum accepted squad size 10
      When the app validates rule configuration
      Then the app must reject the configuration
      And explain that target squad size cannot be lower than minimum accepted squad size

    Scenario: Backfill configuration cannot create unresolved cycle
      Given Team A can supply squad repair to Team B
      And Team B can supply squad repair to Team A
      When the app validates squad repair configuration
      Then the app must warn that the configuration creates a potential cycle


  Rule: Explanation and audit

    The app must explain selections, non-selections, warnings, relaxed rules, and manual changes.

    Scenario: App explains why player was selected
      Given player "b1" is selected for Team C support
      When the coach opens selection explanation
      Then the app must show the valid path
      And the support need
      And position fit
      And cooldown status
      And planning period burden
      And consequences for player "b1"'s core team

    Scenario: App explains why player was not selected
      Given player "c1" was not selected in match round "R1"
      When the coach opens non-selection explanation
      Then the app must show structured reasons for non-selection

    Scenario: App explains relaxed rule
      Given Team C target support is 3
      And Team C selected support count is 2
      When the coach opens warnings
      Then the app must explain which rule was relaxed
      And why the target could not be reached

    Scenario: App shows what changed after regeneration
      Given match round "R1" already has a draft selection
      When the coach regenerates the match round
      Then the app must show which players were added
      And which players were removed
      And which roles changed
      And which warnings changed


  Rule: Match fit feedback

    The app does not predict opponent strength.
    Coaches may record post-match fit feedback after a match.
    Match fit feedback informs review but does not automatically change future selections.

    Scenario: Coach records match fit
      Given match "M1" has been completed
      When the coach records match fit as "too_hard"
      Then the app must store match fit value
      And make it available in planning period review

    Scenario: Match fit uses supported values
      Given a completed match exists
      When the coach records match fit
      Then match fit must be one of "too_easy", "good_fit", "too_hard", "chaotic", "support_overpowered", "support_too_low", or "unknown"

    Scenario: Match fit does not automatically change rules
      Given Team C match "M1" was recorded as "too_hard"
      When the app generates the next match round
      Then the app must not automatically change Team C support targets
      And the app should show previous match fit as review context

    Scenario: Missing match fit does not block future selection
      Given match "M1" has no recorded match fit
      When the app generates the next match round
      Then the app must continue using configured rules
      And treat match fit as "unknown"


  Rule: Coach setup workflow

    Matchboard is set up by adding teams, players, and matches.
    Setup Registries (Teams, Players, Matches) are table-first dense data views.
    The coach can then populate all draft squads.
    Populate all groups matches by round and generates draft selections per round.
    The coach reviews warnings by round, fixes issues per match, may manually adjust draft squads, and finalizes one round at a time.
    Season/planning-period history is used to keep load, support, drops, development exposure, and fairness balanced over time.

    The Today page must always show the next action based on this workflow state.

    Scenario: Setup starts by adding teams
      Given no teams exist
      When the coach opens the app
      Then the next action must be to add teams
      And the next action must link directly to team creation

    Scenario: After teams exist, add players
      Given teams exist but no players exist
      When the coach opens the app
      Then the next action must be to add players
      And the next action must link directly to player creation

    Scenario: After players exist, add matches
      Given teams and players exist but no matches exist
      When the coach opens the app
      Then the next action must be to add matches
      And the next action must link directly to match creation

    Scenario: After matches exist, populate draft squads
      Given teams, players, and matches exist
      And no draft selections have been generated
      When the coach opens the app
      Then the next action must be to populate all draft squads

    Scenario: After drafts exist with blockers, review blockers
      Given draft squads have been populated
      And some rounds have HARD_BLOCK warnings
      When the coach opens the app
      Then the next action must be to review blocked rounds

    Scenario: After drafts exist without blockers, finalize ready round
      Given draft squads have been populated
      And no rounds have HARD_BLOCK warnings
      And at least one round is not finalized
      When the coach opens the app
      Then the next action must be to finalize a ready round

    Scenario: No active work when all rounds finalized
      Given all rounds in the active planning period are finalized
      When the coach opens the app
      Then the app must show no active work


  Rule: Setup registries are table-first

    Teams, Players, and Matches are setup registries — dense, table-first data views for efficient data entry.
    Round selection remains workflow-first.
    Setup registries prioritize fast data entry, inline editing, and actionable empty states.
    Each registry has a dedicated create route that reliably opens a form.

    Scenario: Teams registry is table-first
      Given the coach opens the Teams page
      When teams exist
      Then the primary view must be a dense table of all teams
      And each table row must link to the team detail page
      And the table must show team name, core player count, squad limits, and support priority
      And a Create team action must be prominently available

    Scenario: Players registry is table-first
      Given the coach opens the Players page
      When players exist
      Then the primary view must be a dense table of all players
      And each table row must link to the player profile
      And the table must show player name, core team, primary position, and availability status
      And a Create player action must be prominently available

    Scenario: Matches registry is table-first
      Given the coach opens the Matches page
      When matches exist
      Then the primary view must be a dense table of all matches
      And the table must show match date, team, opponent, home-or-away, match type, and game format
      And each table row must link to match detail
      And a Create match action must be prominently available

    Scenario: Create team route works reliably
      Given the coach navigates to create a team
      When the create team form is shown
      Then the form must accept team name
      And the form must accept target squad size with sensible default
      And the form must accept minimum accepted squad size with sensible default
      And the form must accept maximum squad size with sensible default
      And the form must accept minimum core players with sensible default
      And the form must accept support priority
      And the form must save all submitted fields on confirm
      And the coach must see the new team in the table after creation
      And the create flow must not silently drop any submitted field

    Scenario: Create player route works reliably
      Given at least one team exists
      When the coach navigates to create a player
      Then the form must accept first name, last name, and core team assignment
      And the form must accept primary position with a sensible default
      And the form must accept preferred foot, secondary foot, and best side with sensible defaults
      And the form must accept current availability with default Available
      And the form must save all submitted fields on confirm
      And the coach must see the new player in the table after creation
      And the create flow must not silently fail when teams exist

    Scenario: Create player requires at least one team
      Given no teams exist
      When the coach attempts to create a player
      Then the app must explain that at least one team must exist first
      And the app must provide a direct link to create a team
      And the create player form must not silently disappear or fail

    Scenario: Create match route works reliably
      Given teams exist
      When the coach navigates to create a match
      Then the form must accept team, opponent name, match date, home-or-away status, match type, and game format
      And the form must assign the match to a match round based on date
      And the form must save all submitted fields on confirm
      And the coach must see the new match in the table after creation

    Scenario: Teams empty state is actionable
      Given no teams exist
      When the coach opens the Teams page
      Then the app must show an empty state message
      And the empty state must include a direct Create team action
      And the Create team action must navigate to the create team form

    Scenario: Players empty state is actionable
      Given teams exist but no players exist
      When the coach opens the Players page
      Then the app must show an empty state message
      And the empty state must include a direct Create player action
      And the Create player action must navigate to the create player form

    Scenario: Players empty state when no teams exist links to team creation
      Given no teams exist and no players exist
      When the coach opens the Players page
      Then the app must explain that a team must be created first
      And the app must provide a direct link to create a team
      And the link must navigate to the create team form

    Scenario: Matches empty state is actionable
      Given teams and players exist but no matches exist
      When the coach opens the Matches page
      Then the app must show an empty state message
      And the empty state must include a direct Create match action
      And the Create match action must navigate to the create match form

    Scenario: Matches empty state when no teams exist links to team creation
      Given no teams exist
      When the coach opens the Matches page
      Then the app must explain that teams must be created first
      And the app must provide a direct link to create teams


  Rule: Draft reset and clear actions

    Draft selections can be cleared at three levels without damaging finalized history or setup data.
    Clear all removes all non-finalized draft data across the entire planning period.
    Clear round removes draft data for one selected round.
    Clear match removes draft data for one selected match.
    All clear actions preserve finalized selections, finalized movement ledger, teams, players, matches, rounds, rules, and availability.

    Scenario: Coach can clear all draft squads
      Given active planning period has draft selections in multiple rounds
      When the coach clears all drafts
      Then every draft selection across all non-finalized rounds must be removed
      And every draft warning must be removed
      And every draft explanation must be removed
      And every draft movement ledger entry must be removed
      And provisional planning context must be removed
      And finalized selections, warnings, explanations, and movement ledger entries must remain unchanged

    Scenario: Coach can clear round draft
      Given match round "R1" has draft selections and draft warnings
      And match round "R2" has draft selections
      When the coach clears draft for match round "R1"
      Then all draft selections for matches in "R1" must be removed
      And all draft warnings for "R1" must be removed
      And all draft explanations for matches in "R1" must be removed
      And all draft movement ledger entries for "R1" must be removed
      And match round "R2" draft selections must remain unchanged
      And finalized selections must remain unchanged

    Scenario: Coach can clear match draft
      Given match round "R1" contains matches "M1" and "M2"
      And both matches have draft selections
      When the coach clears draft for match "M1"
      Then draft selections for "M1" must be removed
      And draft warnings for "M1" must be removed
      And draft explanations for "M1" must be removed
      And draft movement ledger entries for "M1" must be removed
      And match "M2" draft selections must remain unchanged
      And the round status must be recalculated after clearing

    Scenario: Clearing draft removes draft movement ledger entries
      Given match round "R1" has draft selections and draft movement ledger entries
      When the coach clears the draft for match round "R1"
      Then draft movement ledger entries for "R1" must be removed
      And finalized movement ledger entries must remain unchanged

    Scenario: Clear actions never delete finalized selections
      Given match round "R1" has been finalized
      When the coach clears all drafts or clears round "R1" draft
      Then finalized selections for "R1" must remain unchanged

    Scenario: Clear actions never delete teams, players, matches, rules, or availability
      Given teams, players, matches, and availability records exist
      When the coach clears all drafts
      Then teams must remain
      And players must remain
      And matches must remain
      And rules must remain
      And availability records must remain

    Scenario: Clear match recalculates round status
      Given match round "R1" was in READY state
      And clearing match "M1" draft removes the last selection for that match
      When the coach clears match "M1" draft
      Then match round "R1" status must be recalculated
      And affected warnings must be updated

    Scenario: Clear round recalculates provisional planning context
      Given match round "R1" draft selections were used as provisional context for later rounds
      When the coach clears round "R1" draft
      Then provisional planning context must be recalculated
      And affected round warnings must be updated

    Scenario: Clear all requires confirmation
      Given active planning period has draft selections
      When the coach triggers clear all drafts
      Then the app must require explicit confirmation
      And the confirmation must explain that only non-finalized draft data will be removed

    Scenario: Affected rounds return to not-populated state after clearing
      Given match round "R1" had draft selections
      When the coach clears round "R1" draft
      Then match round "R1" must return to not-populated state
      And the matches in "R1" must still exist


  Rule: Manual match squad editing

    Draft match squads can be manually edited before finalization.
    Selection rules are for the automatic engine only. A coach can manually override any domain rule by providing an override reason.
    Manual edits apply to draft selections only. Finalized selections cannot be edited without an explicit reopen or audit trail.
    All manual edits must recalculate match status, round status, warnings, explanations, and fairness impact.
    
    The only hard blocks for manual edits are data integrity:
    - finalized round/match
    - non-existent player/match/selection
    - player removed from the active registry

    Domain rules that require override reason (not hard blocks):
    - rotation path eligibility for non-core movement
    - same-round conflict (player selected for another match)
    - duplicate selection in the same match
    - player availability
    - squad size limits
    - non-rotatable player movement outside core team

    Manual override requires reason. The reason must be persisted with the selection. The override must appear in the finalization summary.

    Scenario: Coach adds eligible core player to empty draft match
      Given match "M1" for Team A has no assigned players
      And match round "R1" is in draft state
      And player "p1" has Team A as core team
      And player "p1" is available
      When the coach adds player "p1" to match "M1"
      Then player "p1" must be selected with role "core"
      And match "M1" squad count must increase
      And round status must be recalculated

    Scenario: Coach adds valid support player to draft match
      Given match "M1" for Team C needs support
      And match round "R1" is in draft state
      And player "b1" has Team B as core team
      And an active SUPPORT rotation path exists from Team B to Team C
      And player "b1" is available and not non-rotatable
      When the coach adds player "b1" to match "M1" as support
      Then player "b1" must be selected with role "support"
      And the selection must reference the valid SUPPORT rotation path

    Scenario: Coach cannot add support player without valid SUPPORT path
      Given match "M1" for Team C needs support
      And match round "R1" is in draft state
      And player "a1" has Team A as core team
      And no SUPPORT rotation path exists from Team A to Team C
      When the coach attempts to add player "a1" to match "M1" as support
      Then the app must reject the selection or require an override reason
      And the app must explain that no valid SUPPORT path exists from Team A to Team C

    Scenario: Coach cannot add unavailable player without override
      Given match round "R1" is in draft state
      And player "p1" is marked unavailable for match round "R1"
      When the coach attempts to add player "p1" to a match in "R1"
      Then the app must reject the selection or require an override reason
      And the app must explain that the player is unavailable

    Scenario: Coach cannot add non-rotatable player outside core team without override
      Given match round "R1" is in draft state
      And player "p1" is marked non-rotatable
      And player "p1" has Team A as core team
      When the coach attempts to add player "p1" to Team C match as support
      Then the app must reject the selection or require an override reason
      And the app must explain that non-rotatable restriction applies

    Scenario: Same-round conflict requires override reason
      Given player "p1" is already selected for match "M1" in match round "R1"
      And match round "R1" is in draft state
      When the coach attempts to add player "p1" to a different match "M2" in the same round
      Then the app must require an override reason
      And the app must not silently create a duplicate selection without reason

    Scenario: Coach removes player from draft match
      Given player "p1" is selected for match "M1" in match round "R1" as support
      And match round "R1" is in draft state
      When the coach removes player "p1" from match "M1"
      Then player "p1" selection must be removed
      And match "M1" squad count must recalculate
      And support and squad repair state must recalculate
      And a warning must be created if squad falls below minimum or support is now missing

    Scenario: Removing a player does not remove them from team registry
      Given player "p1" is selected for match "M1" in draft match round "R1"
      When the coach removes player "p1" from match "M1"
      Then player "p1" must still exist in the player registry
      And player "p1" must still belong to their core team

    Scenario: Coach changes player role in draft match
      Given player "p1" is selected for match "M1" as development
      And match round "R1" is in draft state
      And an active SUPPORT rotation path exists from player "p1" core team to match "M1" team
      When the coach changes player "p1" role to support
      Then the app must validate the SUPPORT rotation path
      And if valid, player "p1" role must change to support
      And warnings and explanations must recalculate

    Scenario: Role change validates role-specific path
      Given player "p1" is selected for match "M1" as support
      And match round "R1" is in draft state
      And no DEVELOPMENT rotation path exists from player "p1" core team to match "M1" team
      When the coach attempts to change player "p1" role to development
      Then the app must reject the role change or require an override reason
      And the app must explain that no valid DEVELOPMENT path exists

    Scenario: Coach replaces player in draft match
      Given player "p1" is selected for match "M1" as support
      And player "p2" is eligible for the same support role
      And match round "R1" is in draft state
      When the coach replaces player "p1" with player "p2"
      Then player "p1" selection must be removed
      And player "p2" must be added with the selected role
      And same-round conflicts must be validated
      And path eligibility must be validated
      And match and round status must recalculate
      And fairness impact difference must be visible

    Scenario: Finalized match cannot be edited by draft action
      Given match round "R1" has been finalized
      When the coach attempts to add, remove, or change a player in a match in "R1"
      Then the app must reject the edit
      And explain that finalized rounds cannot be modified without explicit reopen

    Scenario: Manual override requires reason
      Given the coach is adding or modifying a player selection that bypasses a domain rule
      When the coach confirms the manual override
      Then the app must require an override reason
      And the reason must be persisted with the selection
      And the override must appear in the finalization summary

    Scenario: Manual edit recalculate warnings and explanations
      Given match "M1" for Team A has draft selections
      And match round "R1" is in draft state
      When the coach edits a player in match "M1"
      Then match "M1" warnings must be recalculated
      And match round "R1" warnings must be recalculated
      And match "M1" explanations must be recalculated
      And match round "R1" status must be recalculated

    Scenario: Empty match shows prompt for manual or automatic population
      Given match "M1" for Team A has no assigned players
      And match round "R1" is in draft state
      When the coach views match "M1" in the round detail
      Then the app must show a prompt to generate the round or add players manually

    Scenario: Player picker shows eligibility information
      Given the coach is adding a player to a draft match
      When the player picker is shown
      Then the app must show player name, core team, availability, current round assignment, eligible roles, and reason eligible or ineligible
      And players must be grouped or filtered by eligibility status


  Rule: Draft regeneration

    Generated draft selections can be regenerated at three levels without touching finalized data.
    Regeneration preserves manual edits: selections marked as manually added or manually removed are kept, and only automatic selections are recalculated.
    If a match or round has only manual edits, regeneration is effectively a no-op.
    To fully regenerate a match or round that has manual edits, clear the draft first, then regenerate.

    Scenario: Coach regenerates single match draft
      Given match "M1" has automatic draft selections
      And match round "R1" is in draft state
      When the coach regenerates draft for match "M1"
      Then automatic selections for match "M1" must be recalculated
      And warnings for match "M1" must be rebuilt
      And the match must show updated selections

    Scenario: Coach regenerates round draft
      Given match round "R1" has automatic draft selections in multiple matches
      And match round "R1" is in draft state
      When the coach regenerates draft for round "R1"
      Then the round-level orchestration must rerun
      And automatic selections for all matches in "R1" must be recalculated
      And round warnings must be rebuilt

    Scenario: Coach regenerates all drafts in planning period
      Given an active planning period has draft rounds "R1" and "R2" and a finalized round "R3"
      When the coach regenerates all drafts
      Then automatic selections for "R1" and "R2" must be recalculated
      And finalized selections for "R3" must remain unchanged

    Scenario: Regeneration preserves manual edits
      Given match "M1" has both automatic selections and manually added selections
      And match round "R1" is in draft state
      When the coach regenerates draft for match "M1"
      Then manually added selections must be preserved
      And automatic selections must be recalculated

    Scenario: Regeneration does not touch finalized selections
      Given match round "R1" has been finalized
      When the coach attempts to regenerate round "R1"
      Then the app must reject the regeneration
      And finalized selections must remain unchanged

    Scenario: Regeneration shows clear button on match squad card
      Given match "M1" has draft selections
      When the coach views the match squad card
      Then the app must show a regeneration button on the card

    Scenario: Regeneration shows button in round board
      Given match round "R1" has draft selections
      When the coach views the round board
      Then the app must show a regeneration button in the round board action bar

    Scenario: Regeneration shows button on rounds list and today page
      Given an active planning period has draft rounds
      When the coach views the rounds list or today page
      Then the app must show a "Regenerate all drafts" button


  Rule: Populate all workflow

    The coach can generate drafts for all rounds in a planning period in one action.
    Populate all generates drafts per round — not match by match — preserving round-level conflict resolution.
    Populate all does not finalize rounds. Each round remains in draft state for review.
    Draft selections from earlier rounds may be used as provisional planning context for later rounds in the same populate-all run.

    Scenario: Coach populates all rounds in active planning period
      Given an active planning period contains match rounds "R1", "R2", and "R3"
      And none of the match rounds have been finalized
      When the coach triggers populate all
      Then the app must generate draft selections for each match round in chronological order
      And each round must be generated using the round-level orchestration engine
      And no round must be finalized by populate all

    Scenario: Populate all skips finalized rounds
      Given an active planning period contains match rounds "R1", "R2", and "R3"
      And match round "R1" is already finalized
      When the coach triggers populate all
      Then the app must skip match round "R1"
      And the app must generate draft selections for "R2" and "R3"
      And match round "R1" finalized selections must remain unchanged

    Scenario: Populate all preserves round-level conflict resolution
      Given match round "R1" contains matches for Team A, Team B, and Team C
      When the coach triggers populate all
      Then the app must generate "R1" selections through round-level orchestration
      And the app must resolve cross-match conflicts within "R1"
      And the app must resolve support and squad repair within "R1"
      And the app must not generate each match in isolation

    Scenario: Populate all warns on partial failure
      Given an active planning period contains match rounds "R1", "R2", and "R3"
      And match round "R2" generation fails
      When the coach triggers populate all
      Then the app must still generate draft selections for "R1" and "R3"
      And the app must report that "R2" failed with explanation
      And the app must not roll back successful round generations

    Scenario: Populate all does not finalize any round
      Given an active planning period contains match rounds in draft state
      When the coach triggers populate all
      Then every match round must remain in draft state after generation
      And the coach must explicitly finalize each round after review

    Scenario: Draft selections from earlier rounds may inform later rounds
      Given match round "R1" is generated before match round "R2" in the same populate-all run
      And player "p1" is drafted for support in match round "R1"
      When the app generates draft selections for match round "R2"
      Then the app may treat "R1" draft selections as provisional planning context
      And the app must not treat "R1" draft selections as finalized history

    Scenario: Warnings are persisted per round after generation
      Given match round "R1" has been generated
      When generation completes
      Then the app must persist all warnings for "R1" to the database
      And each warning must include severity, rule, message, and affected entities
      And the coach must be able to view warnings without regenerating

    Scenario: Warnings are read during finalization
      Given match round "R1" has persisted warnings
      And at least one warning has severity "HARD_BLOCK"
      When the coach attempts to finalize match round "R1" without an override reason
      Then the app must require an override reason
      And must show the blocking warnings
      When the coach provides an override reason and finalizes
      Then the app must allow finalization with the override reason stored

    Scenario: Warnings are read during finalization with override
      Given match round "R1" has persisted warnings
      And all warnings have severity below "HARD_BLOCK"
      When the coach finalizes match round "R1"
      Then the app must allow finalization with acknowledgment
      And must record the acknowledgment

    Scenario: Actionable warnings show as per-player icons on round board
      Given match round "R1" has HARD_BLOCK and REQUIRES_OVERRIDE and WARNING and SCORING_PREFERENCE warnings
      When the coach views the round board
      Then the app must show a warning count summary at the top
      And the app must show warning icons on player chips for players with warnings
      And WARNING and SCORING_PREFERENCE warnings must be hidden behind a toggle

    Scenario: Setup progress shows which rounds need action
      Given an active planning period contains match rounds
      When the coach opens the Today page
      Then the app must show which rounds have been generated
      And which rounds need generation
      And which rounds have unresolved blockers
      And which rounds are ready for finalization
      And which rounds are finalized

    Scenario: Next action reflects current setup state
      Given an active planning period has no generated rounds
      When the coach opens the Today page
      Then the next action must be to populate rounds or generate the first round
      Given an active planning period has draft rounds with blockers
      When the coach opens the Today page
      Then the next action must be to review blockers
      Given an active planning period has draft rounds without blockers
      When the coach opens the Today page
      Then the next action must be to finalize the ready round


  Rule: Human-readable exports

    Coaches can export finalized match information without exposing internal planning tags by default.

    Scenario: Coach can export finalized match selections
      Given one or more finalized match round selections exist
      When the coach exports finalized selections
      Then the export must include match date, team, opponent, home-or-away status, and selected player names
      And the export must be readable for humans without requiring automation

    Scenario: Coach can choose export format
      Given finalized selections exist
      When the coach exports selections
      Then the app must offer at least two human-readable export formats
      And each format must present the same finalized selection facts

    Scenario: Parent/player export hides internal planning tags
      Given finalized selections exist
      When the coach exports parent/player-facing match information
      Then the export must not include reduced_match_load_allowed
      And must not include support suitability
      And must not include development readiness
      And must not include internal warnings unless explicitly chosen by the coach

    Scenario: Coach export can include internal explanation
      Given finalized selections exist
      When the coach exports coach-facing planning information
      Then the export may include roles, warnings, movement paths, explanations, and override reasons


  Rule: Record-to-record navigation

    The app must support fast browsing without forcing the coach back to overview pages.

    Scenario: Coach can move to next player from player profile
      Given multiple active players exist
      When the coach opens one player profile
      Then the page must provide a way to move to the previous and next player without returning to the registry

    Scenario: Coach can move to previous or next match from match detail
      Given multiple matches exist in match registry ordering
      When the coach opens one match detail page
      Then the page must provide a way to move to previous and next match without returning to overview

    Scenario: Coach can move to previous or next match round
      Given multiple match rounds exist in a planning period
      When the coach opens one match round
      Then the page must provide a way to move to previous and next match round without returning to overview


  Rule: Football Manager style shell is mandatory

    The app must feel like a football operations cockpit.
    It must not feel like a generic admin system.

    Scenario: App uses persistent football operations shell
      Given the coach is using the app
      When any primary workflow route is open
      Then the app must show a persistent left navigation
      And a top context bar
      And an object header for the current football object where relevant

    Scenario: Left navigation uses football operations areas
      Given the coach is using the app
      When the main navigation is visible
      Then the navigation must include grouped areas:
        | area            |
        | Manager         |
        | Match Week      |
        | Squad           |
        | System          |
      And the navigation must not be organized primarily around database entities only

    Scenario: Top context bar shows current operational context
      Given a season, planning period, and match round exist
      When the coach uses the app
      Then the top context bar must show current season
      And current planning period
      And current match round
      And match round status
      And quick search or quick navigation

    Scenario: Object header shows current football object
      Given the coach opens a player, team, match round, or match
      Then the page must show an object header with object name
      And relevant status chips
      And primary action
      And previous/next navigation where applicable

    Scenario: Tables are secondary views only
      Given the coach opens a primary workflow screen
      Then the screen may contain compact lists or tables as supporting elements
      But the main interaction must be through cards, panels, boards, drawers, pitch layout, or assistant review sections


  Rule: Today page — next action, round status, warnings

    The Today page combines Football Manager-style needs action, round checks, warnings, and match round status.
    Round checks are not a separate destination required before the coach understands what to do.
    A separate round checks detail route may exist, but the Today page must include round checks directly.

    Scenario: Today page is the default landing page
      Given the coach opens the app
      When a season and active planning period exist
      Then the coach must land on the Today page
      And the first visible screen must show current match round status
      And needs action
      And round checks
      And warnings needing attention
      And primary actions
      And the first visible screen must not be a raw table of players, teams, matches, or selections

    Scenario: Landing page shows Football Manager-style inbox
      Given match round "R1" has unresolved decisions
      When the coach opens the landing page
      Then the app must show inbox cards grouped by:
        | group                 |
        | Availability          |
        | Support needs         |
        | Squad repair consequences |
        | Development exposure  |
        | Player load           |
        | Team burden           |
        | Rule blockers         |
      And each card must show severity
      And each card must show the affected team, player, match, or rule
      And each card must provide a direct action

    Scenario: Landing page shows round checks panel
      Given match round "R1" has generated selections
      When the coach opens the landing page
      Then the app must show a Round Checks panel
      And the panel must summarize support plan
      And squad repair chain
      And development exposure
      And player load warnings
      And decisions needed
      And finalization status

    Scenario: Round checks card shows recommendation, risk, alternative, and consequence
      Given Team C target support cannot be reached cleanly
      When the Round Checks panel shows the issue
      Then the card must show recommended action
      And risk
      And alternative action
      And consequence

    Scenario: Landing page provides direct path to next work
      Given match round "R1" has unresolved support warnings
      When the coach opens the landing page
      Then the primary action must lead to the relevant Round Board section
      And secondary action may lead to round checks detail
      And the coach must not need to search through tables to find the problem

    Scenario: Separate round checks detail route is optional but consistent
      Given the app has a round checks detail route
      When the coach opens round checks detail
      Then it must use the same sections as the landing page round checks cards
      And expand the details behind the landing page cards


  Rule: Availability overview

    Availability is a first-class planning concern.

    Scenario: Coach views availability by status
      Given players have availability statuses for match round "R1"
      When the coach opens availability overview
      Then players must be grouped by "confirmed", "tentative", "unknown", and "unavailable"

    Scenario: Availability overview highlights critical unknowns
      Given player "b1" has unknown availability
      And player "b1" is a candidate for required Team C support
      When the coach opens availability overview
      Then player "b1" must be highlighted as support-critical unknown

    Scenario: Coach updates availability from overview
      Given player "p1" has unknown availability
      When the coach marks player "p1" as confirmed available
      Then future draft generation for the match round must treat player "p1" as available

    Scenario: Availability overview is grouped, not raw table only
      Given players have availability statuses
      When the coach opens availability overview
      Then the app must show grouped status sections
      And may include compact tables inside those sections
      But must not show only one flat availability table


  Rule: Squad Planner Matrix

    The Squad Planner Matrix shows players across match rounds.
    It is used to detect hidden patterns over time.
    It may look table-like, but its purpose is visual movement and fairness overview, not raw data editing.

    Scenario: Coach views player usage across rounds
      Given a planning period has multiple match rounds
      When the coach opens Squad Planner Matrix
      Then the app must show players as rows
      And match rounds as columns
      And each cell must show the player's selection role or availability state

    Scenario: Squad Planner Matrix shows role history as visual cells
      Given a planning period has several match rounds
      When the coach opens Squad Planner Matrix
      Then players must appear as rows
      And match rounds must appear as columns
      And each cell must show a compact role marker such as "Core", "Support", "Backfill", "Development", "Drop", "Unavailable", or "Unknown"
      And role markers must be visually distinguishable

    Scenario: Matrix highlights repeated support burden
      Given player "b1" has supported Team C in several match rounds
      When the coach opens Squad Planner Matrix
      Then the app must visually highlight high support burden

    Scenario: Matrix highlights repeated drops
      Given player "c1" has been selected as core_match_drop
      When the coach opens Squad Planner Matrix
      Then the app must show the drop in the relevant match round cell

    Scenario: Matrix highlights missing development exposure
      Given player "c2" is development ready
      And player "c2" has not received development exposure in the active planning period
      When the coach opens Squad Planner Matrix
      Then the app must highlight missing development exposure

    Scenario: Squad Planner Matrix highlights drift
      Given player "b1" has high support burden
      And player "c1" has missing development exposure
      And player "c2" has repeated drops
      When the coach opens Squad Planner Matrix
      Then the app must highlight each drift pattern
      And provide a direct link to the affected player or round

    Scenario: Squad Planner Matrix is not the primary selection editor
      Given the coach opens Squad Planner Matrix
      Then the app may allow navigation to selections
      But primary match-round editing must happen in Round Board


  Rule: Match Round Board

    The Round Board is the main weekly planning workspace.
    It shows each team match in a column and supports safe drag-and-drop editing.

    Scenario: Coach sees all teams in one round board
      Given match round "R1" contains Team A, Team B, and Team C matches
      When the coach opens Round Board
      Then the app must show one column per team match
      And show an available players column listing all unassigned players
      And show selected players grouped by role in each match column
      And show round-level warnings

    Scenario: Dragging player from available column adds to match
      Given match round "R1" is in draft state
      And player "p1" is not selected for any match
      When the coach drags player "p1" from the available column to Team A match column
      Then player "p1" must be added to Team A match as core
      And player "p1" must be removed from the available column

    Scenario: Dragging player to non-core team uses rotation path role
      Given match round "R1" is in draft state
      And player "p1" belongs to Team B
      And a SUPPORT rotation path exists from Team B to Team C
      When the coach drags player "p1" from the available column to Team C match column
      Then player "p1" must be added to Team C match as support
      And player "p1" must not be added as core to Team C match

    Scenario: Dragging player to non-core team without rotation path requires override
      Given match round "R1" is in draft state
      And player "p1" belongs to Team B
      And no rotation path exists from Team B to Team C
      When the coach drags player "p1" from the available column to Team C match column
      Then the app must require an override reason

    Scenario: BACKFILL is not a user-facing role choice
      Given match round "R1" has draft selections including BACKFILL
      When the coach views the round board
      Then BACKFILL selections must appear under "Squad repair"
      And the role change options must not include BACKFILL

    Scenario: Dragging player from match column to available column removes player
      Given match round "R1" is in draft state
      And player "p1" is selected for Team A match as core
      When the coach drags player "p1" from Team A match column to the available column
      Then player "p1" must be removed from Team A match
      And player "p1" must appear in the available column

    Scenario: Round Board uses columns per team match
      Given match round "R1" contains matches for Team A, Team B, and Team C
      When the coach opens Round Board
      Then the app must show Team A, Team B, and Team C as separate match columns
      And each column must show selected count, target squad size, minimum squad size, support count, game format, and warnings
      And the screen must not require scrolling through one long table to compare teams

    Scenario: Round Board groups players by role bucket
      Given match round "R1" has draft selections
      When the coach opens Round Board
      Then each team column must group players by:
        | bucket             |
        | Core               |
        | Support received   |
        | Squad repair received  |
        | Development        |
        | Confidence rebuild |
        | Dropped            |
        | Unavailable        |
      And each player must appear in at most one bucket in the match round

    Scenario: Round Board shows cross-team consequences
      Given player "b1" is selected as support for Team C
      When the coach views Team B and Team C columns
      Then Team C must show player "b1" in support received
      And Team B must show that player "b1" is unavailable for Team B core because of support duty
      And the app must show whether Team B needs squad repair

    Scenario: Coach drags player between role buckets
      Given match round "R1" is in draft state
      When the coach drags player "p1" into Team C support bucket
      Then the app must validate the move immediately
      And show whether the move is allowed, warning-only, or blocked
      And show affected teams and players

    Scenario: Round Board supports safe drag and drop where feasible
      Given match round "R1" is in draft state
      When the coach drags player "b1" from Team B core to Team C support
      Then the app must validate the move immediately
      And show whether the move is blocked, allowed with warning, or allowed
      And show changed squad counts for affected teams
      And show any created or removed squad repair need

    Scenario: Round Board provides non-drag fallback
      Given drag and drop is not available on the device
      When the coach opens a player action menu
      Then the coach must be able to move the player to a valid role using explicit actions
      And the same validation must run as for drag and drop

    Scenario: Manual edit shows consequences
      Given player "b1" is selected as support for Team C
      When the coach removes player "b1"
      Then the app must show Team C support count change
      And affected squad repair changes
      And any new warnings


  Rule: Team overview and team health

    Teams are shown as operational units with squad limits, paths, burden, and warnings.
    The Teams page is a lightweight directory that links to team-specific detail pages.
    The all-teams page must not become a catch-all dashboard.
    Detailed team work happens on the team-specific page.

    Scenario: Coach views team overview
      Given teams and rotation rules exist
      When the coach opens Teams overview
      Then each team must be shown with core player count
      And squad size limits
      And support priority
      And active movement paths
      And current planning period burden
      And each team must link to its team detail page

    Scenario: Coach navigates to team detail
      Given Team B exists
      When the coach clicks Team B in the team overview
      Then the app must navigate to the Team B detail page
      And the detail page must show the Team B workspace

    Scenario: Coach views team health
      Given Team B has donated players in the planning period
      When the coach opens Team B detail
      Then the app must show support given
      And support received
      And squad repair received
      And rounds below target squad size
      And continuity warnings

    Scenario: Team health shows repeated match fit problems
      Given Team C has several matches recorded as "too_hard"
      When the coach opens Team C detail
      Then the app must show repeated match fit concern
      And must not automatically change future rules


  Rule: Team detail workspace

    /teams/[teamId] is the primary team workspace.
    It answers: who belongs, who is available, who is selected this round, who is moving out, who is moving in, whether the team is short, what warnings exist, and what the movement and fairness situation looks like.

    The team detail page uses neutral coaching language.
    Movement is described as "sent as support", "received support", "squad repair", and "development" — not as "demoted", "punished", "benched", or "weak player".
    The app must never use labels that imply permanent negative judgment.

    Scenario: Team detail shows team header
      Given Team B exists
      When the coach opens Team B detail
      Then the page must show team name
      And target squad size
      And minimum accepted squad size
      And maximum squad size
      And minimum core players
      And support priority

    Scenario: Team detail shows team summary strip
      Given Team B exists and has a current match round
      When the coach opens Team B detail
      Then the summary strip must show current round status
      And number of core players selected
      And number of players sent as support
      And number of players received as support
      And number of players received as squad repair
      And number of players received as development
      And current warning count

    Scenario: Team detail Squad tab shows squad roster
      Given Team B exists and has players
      When the coach opens Team B detail Squad tab
      Then the app must show all Team B core players
      And group players by planning status
      And highlight availability problems
      And show selection role for the current round if a round exists

    Scenario: Team detail Squad tab groups players by planning status
      Given Team B has players with different planning statuses
      When the coach opens Team B detail Squad tab
      Then players must be groupable by:
        | group                    |
        | Core regulars            |
        | Support candidates       |
        | Development candidates   |
        | Non-rotatable            |
        | Reduced match load       |
        | Availability problems    |
      And the app must not only show one flat player table

    Scenario: Team detail current round tab shows selection state
      Given Team B has a draft selection in the current match round
      When the coach opens Team B detail Current Round tab
      Then the app must show which players are selected as core
      And which players are sent as support to other teams
      And which players are received as support from other teams
      And which players are received as squad repair from other teams
      And which players are received as development from other teams
      And which players are dropped or unavailable
      And all movement must use neutral language:
        | movement type         | label              |
        | sent as support       | Sent as support    |
        | received support      | Received support   |
        | received squad repair | Received squad repair |
        | received development  | Received development|
        | dropped               | Dropped            |

    Scenario: Team detail current round tab shows warnings
      Given Team B has warnings in the current match round
      When the coach opens Team B detail Current Round tab
      Then the app must show warnings that affect Team B
      And each warning must show severity, rule, and message
      And warnings must link to the relevant round detail

    Scenario: Team detail movement tab shows movement history
      Given Team B has movement ledger entries across multiple match rounds
      When the coach opens Team B detail Movement tab
      Then the app must show players sent as support from Team B in each round
      And players received as support by Team B in each round
      And players received as squad repair by Team B in each round
      And players received as development by Team B in each round
      And each movement must show the match round, role, source team, target team, and selection reason

    Scenario: Team detail history tab shows past rounds
      Given Team B has finalized selections in previous match rounds
      When the coach opens Team B detail History tab
      Then the app must show finalized rounds for Team B
      And each round must show selection role breakdown
      And the app must link to the finalized round detail

    Scenario: Team detail rules and links tab shows paths and config
      Given Team B has configured rotation paths
      When the coach opens Team B detail Rules tab
      Then the app must show rotation paths involving Team B
      And squad size configuration
      And support priority configuration
      And the app must link to the full Rules page for editing

    Scenario: Team detail uses neutral movement language
      Given player "b1" has Team B as core team
      And player "b1" is selected as support for Team C in the current round
      When the coach opens Team B detail Current Round tab
      Then the app must describe the movement as "b1 sent as support to Team C"
      And the app must not describe the movement as "demoted", "benched", "weak player", "punished", or "failed"

    Scenario: All-teams page is a directory not a dashboard
      Given multiple teams exist
      When the coach opens the Teams overview
      Then the page must show each team as a link to its detail page
      And the page must not show team health details inline
      And the page must not show squad rosters inline
      And detailed team work must happen on the team detail page


  Rule: Rotation graph view

    The rotation graph shows teams as nodes and configured paths as edges.

    Scenario: Coach views configured movement graph
      Given teams and paths exist
      When the coach opens Rotation Graph
      Then each team must appear as a node
      And each movement path must appear as a directed edge
      And each edge must show role and usage count for the active planning period

    Scenario: Coach creates path from graph
      Given Team A and Team B exist
      When the coach creates a path from Team A to Team B
      Then the coach must choose path role
      And configure path limits and cooldown
      And the app must validate the path before saving


  Rule: Player Profile works like a player dossier

    Player Profile must present a player as a football planning object, not a database row.

    Scenario: Coach opens player profile
      Given player "p1" exists
      When the coach opens player "p1" profile
      Then the profile must show core team
      And primary, secondary, and tertiary positions
      And footedness and best side where recorded
      And availability history
      And role flags
      And recent match usage
      And active restrictions
      And coach notes

    Scenario: Player Profile has dossier sections
      Given player "p1" exists
      When the coach opens player "p1" profile
      Then the profile must show sections for:
        | section          |
        | Overview         |
        | Positions        |
        | Attributes       |
        | Availability     |
        | Rotation status  |
        | Match history    |
        | Notes            |
        | Explanations     |
      And the profile must not show all fields as one long form by default

    Scenario: Player Profile shows recent usage strip
      Given player "p1" has selection history
      When the coach opens player "p1" profile
      Then the app must show a recent usage strip for the latest match rounds
      And each item must show role, team, and match round

    Scenario: Player Profile explains active restrictions
      Given player "p1" is non_rotatable
      Or player "p1" has support cooldown active
      Or player "p1" cannot be reduced-load dropped again before playing
      When the coach opens player "p1" profile
      Then active restrictions must be shown in a visible panel

    Scenario: Coach reviews player movement history
      Given player "p1" has movement ledger entries
      When the coach opens player movement history
      Then the app must show each movement
      And the role
      And from team
      And to team
      And match round
      And explanation

    Scenario: Coach reviews why player was not selected
      Given player "p1" was not selected in match round "R1"
      When the coach opens player "p1" match round explanation
      Then the app must show structured reasons for non-selection


  Rule: Tactics Board supports 7-a-side, 9-a-side, and 11-a-side

    Tactics Board must let the coach see the selected squad as a football shape.
    It is not optional in the target UX.
    It is practical visualization, not a tactical simulator.
    The board must support 7-a-side, 9-a-side, and 11-a-side football.

    Scenario: Tactics Board opens with format from match
      Given match "M1" has game format "7-a-side"
      And match "M1" has a draft selection
      When the coach opens Tactics Board for match "M1"
      Then the pitch must render a 7-a-side tactical layout
      And the board must offer only 7-a-side formations for that match

    Scenario: Tactics Board supports 7-a-side formations
      Given a match has game format "7-a-side"
      When the coach opens formation selector
      Then the app must offer 7-a-side formations such as:
        | formation |
        | 2-3-1     |
        | 3-2-1     |
        | 2-2-2     |
        | 3-1-2     |
      And the pitch must have 7 starting slots including goalkeeper

    Scenario: Tactics Board supports 9-a-side formations
      Given a match has game format "9-a-side"
      When the coach opens formation selector
      Then the app must offer 9-a-side formations such as:
        | formation |
        | 3-3-2     |
        | 3-2-3     |
        | 2-4-2     |
        | 4-3-1     |
      And the pitch must have 9 starting slots including goalkeeper

    Scenario: Tactics Board supports 11-a-side formations
      Given a match has game format "11-a-side"
      When the coach opens formation selector
      Then the app must offer 11-a-side formations such as:
        | formation |
        | 4-3-3     |
        | 4-4-2     |
        | 4-2-3-1   |
        | 3-5-2     |
      And the pitch must have 11 starting slots including goalkeeper

    Scenario: Tactics Board shows selected squad on pitch
      Given a match selection exists for Team C
      When the coach opens Tactics Board
      Then the app must show selected players on a pitch layout
      And unplaced selected players on the bench
      And position fit for each placed player

    Scenario: Coach drags player onto pitch slot
      Given player "p1" is selected for the match
      When the coach drags player "p1" into a defender slot
      Then the app must place player "p1" in that slot
      And show whether the slot matches primary, secondary, tertiary, or fallback position

    Scenario: Tactics Board supports placement editing
      Given player "p1" is selected for Team C
      When the coach places player "p1" into a pitch slot
      Then the app must show whether the slot matches the player's primary, secondary, or tertiary position
      And warn if the player is fallback only

    Scenario: Tactics Board prevents more starters than format allows
      Given a match has game format "7-a-side"
      And 7 players are already placed on the pitch
      When the coach attempts to place an eighth player as starter
      Then the app must prevent the placement
      And show that additional selected players belong on the bench

    Scenario: Tactics Board warns when too few starters are placed
      Given a match has game format "9-a-side"
      And only 8 players are placed on the pitch
      When the coach opens Tactics Board
      Then the app must warn that one starting slot is unfilled

    Scenario: Tactics Board warns about missing structure
      Given no selected player covers a defensive slot
      When the coach opens Tactics Board
      Then the app must warn that defensive structure is missing

    Scenario: Tactics Board shows bench players
      Given a match selection has more selected players than pitch slots
      When the coach opens Tactics Board
      Then extra selected players must appear as bench or unplaced players

    Scenario: Tactics Board stores formation per match
      Given the coach chooses formation "3-2-1" for a 7-a-side match
      When the coach saves the tactics board
      Then the formation must be stored for that match
      And reopening the tactics board must restore the same formation and player placements

    Scenario: Tactics Board can copy formation between same-format matches
      Given Team C has a saved 7-a-side formation for match "M1"
      And match "M2" is also 7-a-side
      When the coach copies tactics from "M1" to "M2"
      Then the app may copy formation shape
      And may copy player placements only for players selected in both matches

    Scenario: Tactics Board cannot copy incompatible formation across formats
      Given match "M1" is 7-a-side
      And match "M2" is 9-a-side
      When the coach copies tactics from "M1" to "M2"
      Then the app must not copy the formation directly
      And must ask the coach to choose a compatible 9-a-side formation


  Rule: Round checks are part of Today page workflow

    Round checks are not hidden behind a separate page.
    They are shown directly on the Today page and can be expanded into a detailed view.

    Scenario: Today page round checks summarize generated round
      Given match round "R1" has generated selections
      When the coach opens the Today page
      Then the Round Checks panel must summarize support selections
      And development selections
      And squad repair chains
      And core match drops
      And reduced match load drops
      And warnings
      And decisions needed before finalization

    Scenario: Today page round checks explain support chain
      Given Team B supplied players to Team C
      And Team A supplied squad repair to Team B
      When the coach opens the Today page
      Then the Round Checks panel must explain the support chain
      And show which movement caused each squad repair

    Scenario: Round checks detail view opens from card
      Given a Round Checks card exists on the Today page
      When the coach opens the card detail
      Then the app must show the full round checks section
      And preserve recommendation, risk, alternative, and consequence

    Scenario: Round checks do not act as chatbot
      Given the coach opens the Today page
      Then round checks must show structured rule-driven review
      And must not require conversational input to be useful


  Rule: Matchday mode

    Matchday mode is a stripped view for execution, not planning.

    Scenario: Coach opens matchday mode
      Given match round "R1" is finalized
      When the coach opens Matchday Mode
      Then the app must show today's matches
      And selected squads
      And position notes
      And support instructions
      And attendance check
      And quick late-dropout repair action

    Scenario: Matchday mode hides rule editing
      Given the coach is in Matchday Mode
      Then the app must not show full rule configuration editing

    Scenario: Coach checks attendance on matchday
      Given matchday mode is open
      When the coach marks a selected player as not present
      Then the app must show whether repair is needed
      And offer late-dropout repair if configured


  Rule: Public and private visibility

    Internal planning tags must not leak into parent or player view.
    The app supports coach view and parent/player export view.

    Scenario: Coach view shows internal tags
      Given player "p1" is marked reduced_match_load_allowed
      When the coach opens player profile
      Then the app may show the internal tag

    Scenario: Parent export hides internal tags
      Given player "p1" is marked reduced_match_load_allowed
      When the coach exports parent/player match information
      Then the export must not include internal tags
      And must only show match information and selected squad details


  Rule: Rule Studio

    Rule Studio lets the coach configure rules, validate rule configuration, export rules, import rules, and inspect rule version history.

    Scenario: Coach exports rule configuration
      Given rule configuration exists
      When the coach exports rules
      Then the app must create a portable rules file
      And include teams, paths, squad limits, support limits, priorities, cooldowns, severity settings, position settings, and fairness windows

    Scenario: Coach imports rule configuration
      Given the coach imports a rules file
      When the app validates the imported rules
      Then the app must reject invalid configuration
      Or save the configuration as a new rule version if valid

    Scenario: Finalized round references rule version
      Given match round "R1" is finalized with RuleConfig version "v3"
      When the coach later changes rules to version "v4"
      Then match round "R1" must still reference RuleConfig version "v3"

    Scenario: Rule Studio shows impact before saving rule changes
      Given current draft match round exists
      When the coach changes a rule value
      Then the app should show likely impact on current draft where possible
      And must not silently regenerate finalized selections


  Rule: Human review threshold

    The app must not pretend a broken or uncertain round is solved.
    It must require human review when warning thresholds or hard conflicts are reached.

    Scenario: Human review required for unresolved blockers
      Given match round "R1" has hard blockers
      When the coach opens the round
      Then the app must show "Human review required"
      And require override reason to finalize

    Scenario: Human review required for too many warnings
      Given match round "R1" has more warnings than configured threshold
      When the coach opens the round
      Then the app must show "Human review recommended"
      And list the warnings grouped by team, player, and rule


  Rule: Table-only implementation is not acceptable

    A table-only implementation does not satisfy Matchboard UX requirements.

    Scenario: App fails UX acceptance if primary workflow is table-only
      Given the app has Landing Page, Round Board, Team Squad Overview, Player Profile, and Tactics Board routes
      When each route is inspected
      Then the Today page must use decision cards, round checks, and status panels
      And Round Board must use team columns and role buckets
      And Team Squad Overview must use team health cards and grouped player cards
      And Player Profile must use dossier sections
      And Tactics Board must use a pitch layout
      And none of these routes may be implemented as only a raw table with CRUD actions

    Scenario: Raw tables are allowed only as supporting components
      Given a primary workflow route contains a table
      Then the table must be inside a larger workspace layout
      And the screen must still provide contextual cards, panels, warnings, or action sections
      And the table must not be the only meaningful interaction model

    Scenario: App fails UX acceptance if round checks are separated from Today page workflow
      Given the coach opens the app Today page
      Then the Today page must include both needs action and round checks
      And it must not require opening a separate page to understand current round warnings and recommended next actions


  Rule: App design principle

    The app should not merely generate legal squads.
    It must create explainable squads that preserve team function, player fairness, and movement intent across time.

    Scenario: Generated round includes explanation package
      Given match round "R1" has generated selections
      When generation completes
      Then the app must provide selected squads
      And warnings
      And explanations
      And movement ledger entries
      And unresolved decisions
      And confidence level for the generated round
