Feature: Matchboard football operations workspace

  Matchboard is a private coach-facing youth football operations cockpit for match-round squad planning, controlled player movement, coaching intent, matchday responsibility, warnings/explainability, finalized history, and post-match reflection across a planning period.

  It is deployed as a hosted web app on Vercel with Neon PostgreSQL backend persistence. It is not local-first, not a generic club-management platform, not a parent communication platform, and not a public player evaluation system.

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

  A player may have at most one planned match assignment per match round.
  Planned assignments represent intended match opportunity.
  Moving a player between matches transfers the assignment.
  The planning engine must never create more than one planned selection for the same player in the same match round.
  Actual additional appearances may happen through post-match reality reporting and are recorded as historical participation, not as planned assignments.

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
    Given the app has a hosted PostgreSQL database
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
      And the app must not provide public signup or multi-tenant auth
      And the app must not expose internal planning tags to parent-facing exports


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
    A player may have at most one planned selection in the same match round.
    The round-level pipeline runs in strict order: per-match core selection, round-level required support resolution, round-level conflict resolution, development routing, squad repair, and post-pipeline validation.
    No phase may create a second planned selection for the same player in the same round.

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
      And then validate generated invariants and persist plan integrity signals

    Scenario: Round-level generation fills minimum core before rotation
      Given match round "R1" contains matches for Team A, Team B, and Team C
      And Team A has minimum core players 8
      And Team A has 12 available core players
      When the app generates match round "R1"
      Then the app must first select at least 8 Team A core players for Team A
      And then resolve support assignments across all matches
      And then route development movements and squad repair

    Scenario: Generation assigns a player at most once in a round
      Given player "p1" is eligible for more than one match in match round "R1"
      When Matchboard generates draft selections for "R1"
      Then "p1" must be assigned to at most one match in "R1"
      And the app must not create a second planned selection for "p1"

    Scenario: Moving a player transfers the planned assignment
      Given player "p1" is assigned to match "M1" in draft round "R1"
      When the coach moves "p1" to match "M2" in the same round
      Then "p1" must no longer be assigned to "M1"
      And "p1" must be assigned to "M2"
      And the transfer must occur atomically
      And there must never be two active planned selections for "p1" in "R1"

    Scenario: Manual add rejects a duplicate planned assignment
      Given player "p1" is already assigned to match "M1" in match round "R1"
      When the coach attempts to manually add "p1" to match "M2" in "R1"
      Then the app must reject the add operation
      And the app must explain that a player can have only one planned match opportunity per round
      And the app must offer movement from "M1" to "M2" instead

    Scenario: Corrupted duplicate planned data is an integrity blocker
      Given persisted draft data contains player "p1" in two matches in match round "R1"
      When the coach opens the Round Board
      Then the app must show a Blocked system-integrity issue
      And the app must identify the affected player and matches
      And the app must not allow normal finalisation until the invalid state is corrected
      And this must be treated as exceptional invalid data, not a normal planning option

    Scenario: Date spacing applies outside same match round
      Given player "p3" is selected for a match in match round "R1"
      And player "p3" is considered for another match outside match round "R1"
      When the app evaluates both matches
      Then the app must apply configured date-spacing rules
      And the app must not apply match-round uniqueness unless both matches belong to the same match round


  Rule: Selection roles

    A selection can be core, support, backfill, development, confidence_rebuild, core_match_drop, reduced_match_load_drop, or manual_override.
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

    The round-level pipeline resolves roles in strict phase order: core selection, required support, conflict resolution, development routing, squad repair, and validation.
    Support chains have precedence over development and core selections.
    Required support for higher-priority receiving teams must be resolved before lower-priority support.
    Squad repair caused by required support must be resolved before optional development.
    Development must be resolved before surplus drops are routed downstream.
    No phase may create a second planned selection for the same player in the same round.
    Required support must be fulfilled before fairness optimization, cosmetic balancing, and generic rotation.
    If required support cannot be fulfilled, the app must generate a plan integrity signal and must not silently weaken the receiving team.

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
      And then validate invariants and persist plan integrity signals

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

    Scenario: Pipeline never creates duplicate planned assignments
      Given match round "R1" contains matches for Team A, Team B, and Team C
      And player "p1" is eligible for multiple matches in the round
      When the app generates match round "R1"
      Then each player must appear in at most one planned selection per match round
      And no phase may create a second planned selection for the same player


   Rule: Plan integrity signals

     Matchboard reserves prominent unresolved issue signals for conditions that directly affect planned match opportunity, selection validity, or minimum match viability.

     Prominent signals are either Blocked or Decision required.

     Conditions that make a plan less ideal but do not remove a player's planned opportunity, select an unavailable player, create invalid persisted duplicate assignments, or leave a match below minimum size are Planning notes only.

     Selection ranking and engine rationale are shown as "Why this selection" explanations and must never be counted or displayed as unresolved issues.

     Blocked conditions prevent normal finalisation until resolved or an explicitly permitted exceptional path is used.

     Decision required conditions require a conscious coach decision and recorded reason before finalisation.

     Planning notes are useful context that does not affect finalisation flow.

     Scenario: Squad below minimum size is blocked
       Given match "M1" has fewer selected players than its configured minimum accepted squad size
       When the Round Board validates the plan
       Then the match must be marked "Blocked"
       And the issue must explain the current selected count and configured minimum
       And normal finalisation must be prevented until resolved

     Scenario: Selected unavailable player is blocked
       Given player "p1" is selected for match "M1"
       And "p1" is unavailable for the round
       When the Round Board validates the plan
       Then the match must be marked "Blocked"
       And the issue must explain that the planned squad includes an unavailable player
       And normal finalisation must be prevented

     Scenario: Duplicate planned assignment found in persisted data is blocked
       Given invalid persisted data assigns player "p1" to two planned matches in the same round
       When the Round Board validates the plan
       Then the round must be marked "Blocked"
       And the issue must be described as a planning integrity failure
       And normal finalisation must be prevented

     Scenario: Available eligible player without planned match opportunity requires decision
       Given player "p1" is active
       And "p1" is eligible for planning in match round "R1"
       And "p1" is recorded as available for "R1"
       And "p1" is not assigned to any planned match in "R1"
       When the Round Board validates participation coverage
       Then the round must show "Decision required"
       And the issue must state that "p1" has no planned match opportunity this round
       And finalisation must require either assignment of "p1" or a recorded reason

     Scenario: Repeated missed planned opportunities are highlighted within the same decision
       Given player "p1" is available and unassigned in match round "R3"
       And "p1" was also available and received no planned match opportunity in at least one earlier round in the same planning period
       When the Round Board explains the current decision
       Then the issue must state that the current missing opportunity repeats an earlier omission
       And the repeated history must increase explanatory prominence
       And the app must not create a second duplicate issue for the same current omission

     Scenario: Below target but above minimum is a planning note only
       Given match "M1" has fewer players than its target squad size
       And "M1" meets its minimum accepted squad size
       When the Round Board presents squad status
       Then it must display "Playable · below target"
       And it may show a Planning note
       And it must not create a Blocked or Decision required issue
       And it must not increase unresolved issue counts

     Scenario: Missing preferred support is not an unresolved issue when the plan remains valid
       Given a team receives less support than configured as preferred
       And the match remains at or above minimum accepted squad size
       And no available eligible player loses their only planned match opportunity
       When Matchboard presents the plan
       Then it may show a Planning note describing reduced support
       And it must not show a prominent unresolved issue

     Scenario: Missing squad repair is not an unresolved issue when no integrity condition is created
       Given a sending team cannot be repaired to its preferred target after supplying support
       And the sending team remains at or above minimum accepted squad size
       And no available eligible player loses their planned match opportunity
       When Matchboard presents the plan
       Then it may show a Planning note
       And it must not create a Blocked or Decision required issue

     Scenario: Position fallback is explanation or planning context
       Given a player is used in a secondary or tertiary permitted position
       And no configured hard planning rule is violated
       When Matchboard explains the selection
       Then it must present the position choice as Planning note or "Why this selection"
       And it must not present the player as warning-marked

     Scenario: Selection scoring preference is explanation only
       Given one eligible player ranked ahead of another through a scoring preference
       When the coach inspects the selection
       Then Matchboard must explain the ranking under "Why this selection"
       And it must not create a persisted unresolved issue
       And it must not increase warning or issue counts

     Scenario: Opponent history never becomes a plan-integrity issue
       Given a match has previous opponent encounter context
       When the coach plans squads
       Then opponent history may appear in Opponent context
        And it must not appear as Blocked, Decision required or Planning note in participation coverage
        And it must not affect squad generation

  Rule: Live plan integrity is derived from current draft state

    Current plan-integrity signals for an editable draft represent the current persisted draft state.

    After any successful mutation that can affect selection validity, player opportunity coverage or minimum squad viability, Matchboard recalculates plan integrity for the affected round.

    Signals that belonged to an earlier draft state no longer appear as unresolved after the causal condition is resolved.

    When recalculation produces no active signals, Matchboard clears or resolves every obsolete current-draft active signal for that round.

    Recalculating live draft integrity never deletes finalised decisions, finalised selections, post-match reports or actual participation history.

    Scenario: Resolving the last signal removes it from all active surfaces
      Given editable round "R1" contains one active integrity signal
      And the coach changes the draft so its causal condition no longer exists
      When plan integrity is recalculated for "R1"
      Then Round Board must no longer display the resolved signal
      And Fixtures must no longer count or display the resolved signal
      And Assistant must no longer show open work for the resolved signal

    Scenario: A zero-result recalculation clears previous active projection
      Given editable round "R1" contains previously persisted active signal rows
      When current computation returns zero active signals
      Then all previous current-draft active signal rows for "R1" must be removed or resolved
      And historical finalised and post-match records must remain unchanged

    Scenario: All relevant draft mutations recalculate integrity
      Given editable round "R1" exists
      When the coach generates, regenerates, clears, adds, removes, moves or changes relevant role or availability data in "R1"
      Then plan integrity must be recomputed from the resulting current state

  Rule: Prominent plan-integrity signals are deliberately rare

    Matchboard reserves prominent current-plan signals for direct player-opportunity, selection-validity or minimum-match-viability conditions.

    Prominent signal categories are Blocked and Decision required.

    Non-blocking context is shown as Planning note.

    Selection rationale is shown as Why this selection and is never counted as unresolved work.

    Scenario: Squad below minimum is blocked once
      Given editable match "M1" has fewer planned players than its configured minimum accepted squad size
      When current plan integrity is computed
      Then one Blocked signal must be created for "M1"
      And the signal must state selected count and minimum count
      And support, repair or below-target symptoms caused by the same shortage must not create duplicate unresolved signals

    Scenario: Selected unavailable player is blocked
      Given player "p1" is selected in editable match "M1"
      And "p1" is unavailable for the round
      When current plan integrity is computed
      Then one Blocked signal must describe that unavailable selected player

    Scenario: Invalid duplicate planned assignment is an exceptional blocker
      Given invalid persisted data assigns player "p1" to more than one planned match in round "R1"
      When current plan integrity is computed
      Then one Blocked integrity signal must identify "p1" and the affected matches
      And Matchboard must not present planned double-load as a valid option

    Scenario: Available eligible player without planned opportunity requires decision
      Given player "p1" is active, eligible and confirmed available for editable round "R1"
      And "p1" is assigned to no planned match in "R1"
      When current plan integrity is computed
      Then one Decision required signal must state that "p1" has no planned match opportunity
      And finalisation must require assignment or a recorded permitted reason

    Scenario: Repeated omission enriches one current decision
      Given "p1" currently has no planned match opportunity in "R1"
      And "p1" was confirmed available without planned opportunity in an earlier round in the same planning period
      When current plan integrity is computed
      Then only one current Decision required signal must exist for "p1" in "R1"
      And the signal must contain repeated-omission context

  Rule: Planning notes are not unresolved issues

    Scenario: Playable below-target squad is a note only
      Given match "M1" is below target squad size but at or above minimum accepted squad size
      When current plan integrity is computed
      Then the match may show "Playable · below target"
      And a Planning note may be shown
      And no Blocked or Decision required signal is created
      And unresolved issue totals do not increase

    Scenario: Preferred support shortfall without integrity consequence is a note only
      Given preferred support is not fully met
      And all affected matches remain viable
      And every available eligible player retains a planned match opportunity
      When current plan integrity is computed
      Then the condition may appear as a Planning note
      And it must not appear as active work

    Scenario: Selection scoring preference is explanation only
      Given generation ranked a candidate using a valid preference
      When the coach inspects the selection
      Then Matchboard must show the reason under "Why this selection"
      And it must not persist or count this reason as an active issue

  Rule: Assistant work items are derived from live state

    Assistant work items are computed from live database state each time the page loads.
    No persistent AssistantIssue rows drive the live view.
    Resolving a condition removes it from the Assistant immediately on next load.

    Scenario: One causal match viability failure creates one Assistant work item
      Given match "M1" is below minimum accepted squad size
      When the coach opens the Assistant page
      Then one work item must describe the match viability failure
      And no duplicate round, team or player work items may represent the same shortage

    Scenario: Missing opportunities aggregate in Assistant
      Given three available eligible players have no planned match opportunity in round "R1"
      When the coach opens the Assistant page
      Then Assistant must show one decision_required work item for "R1"
      And it must state that three players require review
      And Round Board may list the three player decisions individually

    Scenario: Resolved condition removes work item from live view
      Given a Blocked condition exists in round "R1"
      And the draft is changed so the condition no longer exists
      When the coach opens the Assistant page
      Then that work item must not appear

  Rule: Visible issue summaries do not count context

    Scenario: Fixtures never shows generic issue totals
      Given a round has current plan-integrity results
      When Fixtures is displayed
      Then it must show structured Blocked and Decision required summary only
      And it must not show a generic "{number} issues" total
      And Planning notes must not be counted

    Scenario: Round Board uses plan-integrity language
      Given a round has current plan-integrity results
      When Round Board is displayed
      Then it must show "Plan integrity"
      And it must not show "actionable warnings", "informational warnings" or generic warning totals

    Scenario: Normal player chips do not show warning counts
      Given no direct active integrity condition applies to a player
      When that player appears on Round Board
      Then the chip must not display a generic warning count or issue marker

  Rule: Planned assignment and actual participation are separate

    Planned squads permit at most one planned assignment per player per round.

    A post-match report may record an unplanned or additional actual appearance caused by matchday circumstances.

    Actual additional appearances are historical participation facts and do not become active plan-integrity signals.


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
      And the app must enforce same-round player uniqueness

    Scenario: Warning when no valid squad repair exists for weakened team
      Given Team B supplied player "b1" as support to Team C
      And Team B is below minimum accepted squad size after supplying support
      And no eligible squad repair candidate exists at any priority level
      When the app resolves squad repair
      Then the app must generate a warning that Team B squad repair could not be fulfilled
      And the app must not silently accept the shortfall


  Rule: One planned assignment per player per round

    During draft planning, a player may belong to at most one planned match squad in a match round.

    A player shown on the Round Board represents one planned match opportunity.

    Moving a player from one match to another transfers the planned assignment. It must never duplicate the planned assignment.

    The user interface must not provide a deliberate workflow for adding the same player to multiple planned matches in a round.

    The server must reject any draft-generation, manual-add, manual-move, role-change or finalisation mutation that would persist more than one active planned selection for the same player in the same match round.

    Historical data created under older behaviour may be displayed as legacy history if it already exists, but new planning behaviour must never create planned double load.

    Scenario: Generation assigns a player at most once in a round
      Given player "p1" is eligible for more than one match in match round "R1"
      When Matchboard generates draft selections for "R1"
      Then "p1" must be assigned to at most one match in "R1"
      And the app must not create a second planned selection for "p1"

    Scenario: Moving a player transfers the planned assignment
      Given player "p1" is assigned to match "M1" in draft round "R1"
      When the coach moves "p1" to match "M2" in the same round
      Then "p1" must no longer be assigned to "M1"
      And "p1" must be assigned to "M2"
      And the transfer must occur atomically
      And there must never be two active planned selections for "p1" in "R1"

    Scenario: Manual add rejects a duplicate planned assignment
      Given player "p1" is already assigned to match "M1" in match round "R1"
      When the coach attempts to manually add "p1" to match "M2" in "R1"
      Then the app must reject the add operation
      And the app must explain that a player can have only one planned match opportunity per round
      And the app must offer movement from "M1" to "M2" instead

    Scenario: Corrupted duplicate planned data is an integrity blocker
      Given persisted draft data contains player "p1" in two matches in match round "R1"
      When the coach opens the Round Board
      Then the app must show a Blocked system-integrity issue
      And the app must identify the affected player and matches
      And the app must not allow normal finalisation until the invalid state is corrected
      And this must be treated as exceptional invalid data, not a normal planning option


  Rule: Actual participation may differ from planned selection

    Finalised planned selections record the intended match opportunity before matchday.

    Post-match reports record who actually participated.

    A player not present in a finalised planned squad may be recorded as an actual participant when the player was called in outside Matchboard due to real matchday circumstances.

    Adding an unplanned actual participant must not rewrite or invalidate the finalised planned squad.

    A player may have actual appearances in more than one match in the same round when real matchday circumstances caused an additional appearance.

    Additional actual appearances are historical participation/load facts used in future fairness context. They are not planned double loads and must not be presented as player misconduct or a planning warning.

    Scenario: Emergency cover is recorded as unplanned actual participation
      Given match "M1" has a finalised planned squad
      And player "p1" is not part of that finalised planned squad
      When the coach records that "p1" actually participated in "M1"
      Then the app must require an unplanned-appearance reason
      And the app must store "p1" as an unplanned actual participant
      And the app must not add "p1" to the finalised planned squad
      And the app must not alter the historical planned selection

    Scenario: Actual additional appearance is allowed after matchday
      Given player "p1" was actually recorded as participating in match "M1" in round "R1"
      And player "p1" was later called in to play match "M2" in the same round
      When the coach records actual participation for "M2"
      Then the app must allow the additional actual appearance
      And the app must require an unplanned-appearance reason if "p1" was not planned for "M2"
      And the app must label the record as an additional actual appearance in the round
      And the app must not mark the finalised planned squads as invalid

    Scenario: Additional actual appearances affect future participation context
      Given player "p1" has one additional actual appearance in planning period "P1"
      When future fairness or load context is calculated
      Then the additional actual appearance must count as actual match participation
      And it may be considered when comparing otherwise equivalent future movement candidates
      And it must not automatically remove "p1" from their normal core match opportunity
      And it must not create an active planning warning against "p1"


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
    The coach reviews plan integrity signals by round, fixes issues per match, may manually adjust draft squads, and finalizes one round at a time.
    Season/planning-period history is used to keep load, support, drops, development exposure, and fairness balanced over time.

    The Assistant page must always show the next action based on this workflow state.
    The Assistant page derives work items from live database state, not from persisted AssistantIssue rows.

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
      And some rounds have Blocked plan integrity conditions
      When the coach opens the app
      Then the next action must be to review blocked rounds

    Scenario: After drafts exist with decision-required conditions, review decisions
      Given draft squads have been populated
      And some rounds have Decision required conditions
      When the coach opens the app
      Then the next action must be to review decision-required items

    Scenario: After drafts exist without blockers, finalize ready round
      Given draft squads have been populated
      And no rounds have Blocked conditions
      And at least one round is not finalized
      When the coach opens the app
      Then the next action must be to finalize a ready round

    Scenario: Finalized match without post-match report shows report action
      Given a match round is finalized
      And a match in that round has no post-match report
      When the coach opens the app
      Then the Assistant must show a post-match report work item for that match

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

    Scenario: Regeneration shows button on rounds list and fixtures page
      Given an active planning period has draft rounds
      When the coach views the rounds list or fixtures page
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
      When the coach opens the Assistant page
      Then the app must show which rounds have been generated
      And which rounds need generation
      And which rounds have unresolved blockers
      And which rounds are ready for finalization
      And which rounds are finalized

    Scenario: Next action reflects current setup state
      Given an active planning period has no generated rounds
      When the coach opens the Assistant page
      Then the next action must be to populate rounds or generate the first round
      Given an active planning period has draft rounds with blockers
      When the coach opens the Assistant page
      Then the next action must be to review blockers
      Given an active planning period has draft rounds without blockers
      When the coach opens the Assistant page
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

    Scenario: Season export includes movement, type, and direction
      Given finalized selections exist in one or more match rounds
      When the coach exports season data
      Then the export must include player movement with direction (from team to team) and role type
      And the export must include match date, venue (home or away), team, and selected squad

    Scenario: Season export includes player statistics
      Given finalized selections exist
      When the coach exports season data
      Then the export must include per-player statistics: rounds played, core matches, support matches, development matches, and squad repair matches

    Scenario: Season export is available from the season overview page
      Given the coach is on the season overview page
      Then the export button must be visible with format selection (CSV, JSON, TXT, Markdown)
      And the export must be scoped to the selected planning period


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


  Rule: Assistant live command centre

    The Assistant page (/assistant) is a live coaching command centre.
    It derives all work items from current database state using canonical sources — not from persisted AssistantIssue rows.
    One work item per round per category. No per-player or per-team multiplication of work items.
    Planning notes, scoring preferences, opponent observations, and seasonal context never appear as Assistant work items.

    The Assistant page must not show the CoachingIntentSelector. Coaching intent belongs on Fixtures and Round Board where planning decisions are made.

    Scenario: Assistant page is the default landing page
      Given the coach opens the app
      When a season and active planning period exist
      Then the coach must land on the Assistant page
      And the first visible screen must show current match round status
      And work items requiring action
      And primary actions
      And the first visible screen must not be a raw table of players, teams, matches, or selections

    Scenario: Assistant shows work items by workflow priority
      Given match round "R1" has Blocked conditions
      And match round "R2" is Ready to finalize
      When the coach opens the Assistant page
      Then the blocked round item must appear before the ready-to-finalize item

    Scenario: Assistant aggregates one item per round per category
      Given match round "R1" has two Blocked conditions
      When the coach opens the Assistant page
      Then the Assistant must show one blocked_round item for "R1"
      And the item must state that there are two blocked conditions

    Scenario: Assistant aggregates decision-required players per round
      Given three available eligible players have no planned match opportunity in round "R1"
      When the coach opens the Assistant page
      Then the Assistant must show one decision_required item for "R1"
      And it must state that three players require review

    Scenario: Assistant never shows planning notes as work items
      Given a round has planning notes but no Blocked or Decision required conditions
      When the coach opens the Assistant page
      Then planning notes must not appear as work items

    Scenario: Assistant never shows scoring preferences as work items
      Given a round has scoring preference explanations
      When the coach opens the Assistant page
      Then scoring preferences must not appear as work items

    Scenario: Assistant shows post-match report items for finalized matches missing reports
      Given a match round is finalized
      And two matches in that round have no post-match report
      When the coach opens the Assistant page
      Then the Assistant must show two post_match_report items

    Scenario: Resolved condition removes work item immediately
      Given Assistant contains a blocked_round item for "R1"
      And the draft is changed so the Blocked condition no longer exists
      When the coach reloads the Assistant page
      Then that work item must not appear

    Scenario: Assistant provides direct path to next work
      Given match round "R1" has Blocked conditions
      When the coach opens the Assistant page
      Then the primary action must lead to the Round Board for "R1"
      And the coach must not need to search through tables to find the problem

    Scenario: Empty state when no work exists
      Given all rounds in the active planning period are finalized
      And all finalized matches have post-match reports
      When the coach opens the Assistant page
      Then the app must show a no-work state with a link to Fixtures


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


  Rule: Round checks are part of Round Board workflow

    Round checks summarize the generated round state. They are shown on the Round Board and can be expanded into a detailed view.
    Round checks do not appear as separate Assistant work items — they are accessed through the Round Board.

    Scenario: Round Board summarizes generated round
      Given match round "R1" has generated selections
      When the coach opens the Round Board for "R1"
      Then the plan integrity section must summarize Blocked conditions
      And Decision required conditions
      And planning notes behind a toggle
      And finalization status


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
      Then the Assistant page must use work item cards with priority ordering
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

    Scenario: Assistant must show actionable work items not informational context
      Given the coach opens the Assistant page
      Then the Assistant must show Blocked and Decision required work items
      And must not show planning notes as work items
      And must not show scoring preferences as work items
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


  Rule: Season overview and fairness control surface

    Matchboard must provide a season/planning-period overview showing which players played for which team in each round, how often they moved as support or development, total match load, drops, unavailable rounds, and fairness context. The overview must support both finalized-only history and finalized-plus-draft planning views.

    The season overview is the fairness control surface, not a decorative analytics page. It exists to help the coach trust or challenge the season pattern.

    Scenario: Season overview shows player-by-round matrix
      Given a planning period has 4 match rounds and 20 active players
      When the coach opens the season overview
      Then the overview must show a matrix with one row per player and one column per round

    Scenario: Each player/round cell shows role and team
      Given player "p1" was selected as CORE for Team A in round "R1"
      And player "p1" was selected as SUPPORT to Team C in round "R2"
      When the coach views the season overview matrix
      Then the cell for "p1" in "R1" must show CORE and Team A
      And the cell for "p1" in "R2" must show SUPPORT and Team C

    Scenario: Overview can show finalized-only data
      Given rounds "R1" and "R2" are finalized
      And round "R3" is in draft state
      When the coach views the season overview in finalized-only mode
      Then the matrix must include data for "R1" and "R2" only
      And the matrix must not include draft selections from "R3"

    Scenario: Overview can optionally include draft selections
      Given rounds "R1" and "R2" are finalized
      And round "R3" is in draft state
      When the coach toggles to include drafts
      Then the matrix must include data for all three rounds
      And draft selections must be visibly marked as draft

    Scenario: Overview distinguishes draft from finalized
      Given player "p1" has finalized CORE selection in "R1"
      And player "p1" has draft SUPPORT selection in "R3"
      When the coach views the season overview with drafts included
      Then the "R1" cell must be visually distinct from the "R3" cell
      And draft and finalized state must never be mixed without visible labeling

    Scenario: Overview summarizes total load per player
      Given player "p1" has 6 finalized appearances
      When the coach views the season overview
      Then "p1" summary column must show total matches as 6

    Scenario: Overview summarizes support matches per player
      Given player "p1" has 2 finalized SUPPORT selections and 4 finalized CORE selections
      When the coach views the season overview
      Then "p1" support column must show 2

    Scenario: Overview summarizes development matches per player
      Given player "p1" has 1 finalized DEVELOPMENT selection
      When the coach views the season overview
      Then "p1" development column must show 1

    Scenario: Overview summarizes legacy double-load per player
      Given player "p1" has 1 finalized selection marked with controlledDoubleLoad = true from a previous planning period
      When the coach views the season overview
      Then "p1" legacy additional-assignment column must show 1
      And the column must be labelled as legacy, not as a current planning feature

    Scenario: Overview summarizes drops/rests per player
      Given player "p1" is available in round "R3" but not selected
      When the coach views the season overview
      Then the "R3" cell must show dropped/rested
      And "p1" drops column must count this round

    Scenario: Overview excludes unavailable rounds from fairness debt
      Given player "p1" was unavailable for 2 rounds
      And player "p1" was available and selected as CORE in 4 rounds
      When the coach views the season overview fairness metrics
      Then the 2 unavailable rounds must not count as fairness debt
      And "p1" load calculation must be based on available rounds only

    Scenario: Overview shows movement paths between teams
      Given player "p1" moved from Team A to Team C as support 3 times
      And player "p2" moved from Team A to Team C as development 1 time
      When the coach views the movement path summary
      Then the path Team A to Team C must show 3 support moves and 1 development move

    Scenario: Overview can drill into a player movement history
      Given player "p1" has selections in rounds "R1" through "R4"
      When the coach clicks player "p1"
      Then the app must show a movement timeline with round, date, team, role, and movement path

    Scenario: Overview can drill into a team-to-team movement path
      Given 3 players have moved from Team A to Team C as support
      When the coach clicks the Team A to Team C support path
      Then the app must show which players moved, which rounds, match dates, role, draft/finalized state, and explanations

    Scenario: Season fairness warnings are generated from the overview
      Given player "p1" has more support matches than core matches
      When the coach views the season overview
      Then the overview must show a fairness warning for "p1" about support burden
      And the warning must include severity, affected player, reason, and drill-down link

  @selection-engine-correction
  Feature: Selection engine data model corrections

    As a coach
    I want selection data to accurately represent what happened on the pitch
    So that season overview, export, and fairness analysis are correct

    Background:
      Given the app uses structured selection data model corrections

    # ---- One planned assignment per player per round ----

    Scenario: A player must not have two selection rows in the same match
      Given player "p1" is assigned to match "M1" in match round "R1"
      And player "p1" already has one selection row in match "M1"
      When the app attempts to add a second selection row for player "p1" in match "M1"
      Then the app must reject the duplicate selection
      And the app must generate a DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE Blocked signal

    Scenario: Existing legacy controlledDoubleLoad data remains readable
      Given existing finalized data has player "p1" with controlledDoubleLoad = true from a previous planning period
      When the coach views historical season data
      Then the app must display the data as legacy history labelled "legacy additional assignment"
      And the app must not present it as a currently supported planning feature
      And new planning behaviour must never create controlledDoubleLoad = true

    # ---- Movement ledger is mandatory ----

    Scenario: Support selection creates a movement ledger entry during draft generation
      Given player "p1" has Team A as core team
      And player "p1" is selected as SUPPORT for Team B in match round "R1"
      When the app saves the generated draft
      Then a movement ledger entry must exist for player "p1" in match round "R1"
      And the entry must have fromTeamId = Team A and toTeamId = Team B and isDraft = true

    Scenario: Development selection creates a movement ledger entry during draft generation
      Given player "p1" has Team A as core team
      And player "p1" is selected as DEVELOPMENT for Team B in match round "R1"
      When the app saves the generated draft
      Then a movement ledger entry must exist for player "p1" in match round "R1"

    Scenario: Squad repair selection creates a movement ledger entry during draft generation
      Given player "p1" has Team A as core team
      And player "p1" is selected as BACKFILL for Team B in match round "R1"
      When the app saves the generated draft
      Then a movement ledger entry must exist for player "p1" in match round "R1"

    Scenario: Legacy movement ledger entries for controlledDoubleLoad remain readable
      Given existing finalized data has player "p1" with a movement ledger entry marked with controlledDoubleLoad = true
      When the coach views historical season data
      Then the movement ledger entry must remain readable as legacy data
      And new planning behaviour must never create movement ledger entries with controlledDoubleLoad = true

    Scenario: Core selection where player stays in own team does not create a movement ledger entry
      Given player "p1" has Team A as core team
      And player "p1" is selected as CORE for Team A in match round "R1"
      When the app saves the generated draft
      Then no movement ledger entry must exist for this selection

    Scenario: Export with support/development selections must not have empty movements
      Given match round "R1" has finalized selections including at least one SUPPORT selection
      When the coach exports the season data
      Then the export movements array must not be empty
      And each movement must reference the correct player, source team, target team, and role

    Scenario: Finalization flips movement ledger isDraft from true to false
      Given match round "R1" has draft selections with movement ledger entries where isDraft = true
      When the coach finalizes match round "R1"
      Then the movement ledger entries for "R1" must have isDraft = false
      And no new movement ledger entries must be created during finalization

    # ---- Squad repair must be structured ----

    Scenario: Squad repair selection must use BACKFILL role, not CORE with explanation
      Given Team B needs squad repair after sending players as support
      And player "p1" is available and eligible to fill the squad gap
      When the app selects player "p1" for squad repair
      Then the selection role must be "BACKFILL"
      And the selection role must NOT be "CORE" with an explanation saying "squad repair"

    Scenario: Player re-included in own team after being dropped is BACKFILL, not CORE
      Given player "p1" has Team A as core team
      And player "p1" was temporarily dropped from Team A to meet squad size limits
      And player "p1" is re-included to fill a squad gap caused by support movement outbound
      When the app re-includes player "p1"
      Then the selection role must be "BACKFILL"
      And the selection role must NOT be "CORE"

    Scenario: Existing CORE selections with squad repair explanation must be migrated to BACKFILL
      Given existing finalized data has player "p1" with role "CORE" and explanation containing "squad repair"
      When the migration runs
      Then the selection role must be updated to "BACKFILL"

    Scenario: Player stats must count squad repair matches in backfillMatches, not coreMatches
      Given player "p1" has 2 BACKFILL selections and 4 CORE selections
      When the season overview calculates player stats
      Then backfillMatches must show 2
      And coreMatches must show 4

    # ---- Manual override reason categories ----

    Scenario: Manual override reason must use a structured category
      Given the coach manually adds a player who violates a rotation path
      When the coach provides an override reason
      Then the override reason must include a category from the predefined list
      And the category must be one of: squad_too_small, support_missing, development_opportunity, no_planned_match_opportunity, availability_changed, coach_judgement, match_already_played, data_correction, other
      And free-text detail must be provided for hard rule violations

    Scenario: Generic "Manual override" alone is not a sufficient override reason
      Given the coach manually adds a player who violates same-round conflict
      When the coach provides only "Manual override" as the override reason
      Then the app must require a structured category and detail explaining the specific rule being bent

    # ---- Invariant validation ----

    Scenario: Invariant validation catches same player duplicated in same match
      Given the generated round has player "p1" appearing twice in the same match
      When the app validates generated round invariants
      Then the validation must fail with a hard block for duplicate player in match

    Scenario: Invariant validation catches movement ledger missing for non-core selections
      Given a selection has role "SUPPORT" but no corresponding movement ledger entry
      When the app validates before finalization or export
      Then the validation must generate a warning about missing movement ledger entry


  # ===== Coaching intent and execution model =====

  Rule: Coaching intent

    Every generated selection must be connected to coach-visible football intention where relevant. Coaching intent does not override hard eligibility rules. It informs explanations and warnings.

    Intent categories:
    - team_first — prioritize team function over individual development
    - reset_after_error — prioritize reset and recovery after mistakes
    - support_teammates — prioritize helping teammates over individual stats
    - positional_discipline — prioritize staying in position and team shape
    - play_through_team — prioritize connecting with teammates over solo actions
    - defensive_recovery — prioritize defensive responsibility and recovery
    - confidence_rebuild — prioritize a safer context with specific success criteria for a player who needs it
    - challenge_exposure — provide a harder match context because effort and readiness support it
    - stabilize_weaker_team — prioritize stabilizing a team that needs support
    - protect_match_function — prioritize making the match viable for all players

    Scenario: Match stores coaching intent
      Given the coach creates or edits a match
      When the coach records match intent
      Then the match must store the primary football goal
      And the match may store team risks
      And the match may store player responsibility focus
      And the match intent must be visible during squad generation
      And the match intent must be preserved in finalized history

    Scenario: Intent informs explanations without overriding hard rules
      Given a match has coaching intent "stabilize_weaker_team"
      And player "p1" is unavailable for the match date
      When the coach generates selections
      Then player "p1" must not be selected because availability is a hard rule
      And the explanation must distinguish the blocked hard rule from the coaching intent

    Scenario: Generated selections expose coaching intent where relevant
      Given a match has coaching intent "challenge_exposure"
      And player "p2" is selected as DEVELOPMENT on a rotation path that serves the challenge_exposure intent
      When the coach reviews the generated squad
      Then the selection may reference the coaching intent it serves
      And the intent reference must be coach-facing by default

    Scenario: Intent can be edited by the coach before finalization
      Given a match has coaching intent "team_first"
      And the match round is in DRAFT state
      When the coach changes the match intent to "support_teammates"
      Then the match intent must be updated
      And draft selections may be regenerated to reflect the updated intent

    Scenario: Finalized history preserves intent snapshots
      Given a match had coaching intent "defensive_recovery" when finalized
      When the coach reviews the finalized round history
      Then the intent snapshot must be preserved from the finalization time
      And the intent must remain visible in coach-facing review

    Scenario: Intent remains coach-facing unless explicitly exported through parent-safe language
      Given a match has coaching intent "confidence_rebuild"
      When the coach creates a parent-facing export
      Then the coaching intent must not appear directly in the export
      And neutral language such as "suitable challenge" or "development opportunity" may be used instead


  Rule: Matchday responsibility

    Player selection must support match execution, not only squad completion. A matchday responsibility may be assigned to a selected player to describe their execution focus for that match.

    Matchday responsibilities are coach-facing execution concepts, separate from selection roles. They do not change eligibility.

    Allowed matchday responsibilities:
    - stabilizer — helps the team stay calm, connected, and organized
    - connector — looks for simple team actions and helps involve teammates
    - recovery_leader — reacts quickly after ball loss and models reset behavior
    - width_holder — protects team shape and avoids unnecessary central crowding
    - challenge_player — receives a harder match context because effort and readiness support it
    - confidence_rebuild_player — receives a safer or clearer context with specific success criteria

    Scenario: Selection has matchday responsibility
      Given player "p1" is selected for match "m1"
      When the coach reviews the generated squad
      Then the selection may have a matchday responsibility
      And the responsibility may be "stabilizer", "connector", "recovery_leader", "width_holder", "challenge_player", or "confidence_rebuild_player"
      And the responsibility must be coach-facing by default
      And the responsibility must not change eligibility rules

    Scenario: Responsibility is preserved in finalized history
      Given player "p1" is selected for match "m1" with matchday responsibility "stabilizer"
      And match "m1" is finalized
      When the coach reviews the finalized round
      Then the matchday responsibility must be preserved in the selection record
      And the responsibility must remain visible in coach-facing review

    Scenario: Responsibility is separate from player identity and permanent labels
      Given player "p1" has matchday responsibility "challenge_player" for match "m1"
      When the coach reviews a different match "m2"
      Then player "p1" may have a different matchday responsibility or no responsibility for match "m2"
      And the responsibility must never become a permanent label attached to the player
      And the responsibility must never appear as a fixed player rating

    Scenario: Responsibility must be explained using observable football language
      Given player "p2" has matchday responsibility "recovery_leader" for match "m1"
      When the coach views the explanation for this responsibility
      Then the explanation must use observable football behavior such as "react quickly after ball loss" or "helps team reset"
      And the explanation must not use character labels such as "lazy" or "selfish" or "bad attitude"

    Scenario: Parent-facing export uses neutral language for responsibility
      Given player "p1" has matchday responsibility "confidence_rebuild_player" for match "m1"
      When the coach creates a parent-facing export
      Then the matchday responsibility must not appear in the export
      Or if context is needed, the export must use neutral language such as "development opportunity" or "suitable challenge"


  Rule: Player readiness signals

    Readiness is soft coaching context and must not become hidden ranking or punishment. Readiness signals inform scoring preferences and coach warnings but must not create automatic exclusion or permanent labels.

    Initial readiness signals:
    - effort trend — rising / stable / falling
    - attendance reliability — high / medium / low
    - learning behavior — strong / ok / needs_attention
    - team-first behavior — strong / ok / needs_attention
    - reset-after-error reliability — strong / ok / needs_attention
    - coach trust — high / medium / low

    Scenario: Readiness informs warning but does not exclude
      Given player "p1" is eligible for match "m1"
      And player "p1" has reset-after-error reliability "needs_attention"
      When the coach generates selections
      Then player "p1" may still be selected
      And the coach may receive a warning
      And the warning must explain the observable concern
      And the warning must not be visible in parent-facing exports

    Scenario: Readiness must not create automatic punishment
      Given player "p2" has effort trend "falling"
      When selections are generated
      Then player "p2" must not be automatically excluded only because of the effort signal
      And any exclusion must be explained through hard eligibility, squad constraints, or explicit coach override
      And the readiness signal must not become a permanent label on the player

    Scenario: Readiness must not override hard eligibility rules
      Given player "p3" has coach trust "high"
      And player "p3" does not have a valid rotation path to the target team
      When selections are generated
      Then player "p3" must still not be selected for non-core movement to the target team
      And high readiness must not override rotation path validation

    Scenario: Readiness signals are coach-editable and explainable
      Given player "p1" has effort trend "falling"
      When the coach edits player "p1" readiness
      Then the coach may change effort trend to "stable" or "rising"
      And the change must be recorded with a timestamp
      And the coach may add an explanation for the change
      And readiness must be time-bound and reviewable

    Scenario: Readiness signals are excluded from parent-facing exports
      Given player "p1" has readiness signals recorded
      When the coach creates a parent-facing export
      Then readiness signals must not appear in the export
      And no readiness-derived labels or rankings must appear in the export

    Scenario: Readiness uses observable behavior categories
      Given the app supports readiness signals
      Then effort trend must use "rising", "stable", or "falling"
      And attendance reliability must use "high", "medium", or "low"
      And learning behavior must use "strong", "ok", or "needs_attention"
      And team-first behavior must use "strong", "ok", or "needs_attention"
      And reset-after-error reliability must use "strong", "ok", or "needs_attention"
      And coach trust must use "high", "medium", or "low"
      And readiness must never use labels such as "lazy", "selfish", "bad attitude", or "weak player"


  Rule: Match execution feedback

    Matchboard captures observable match behavior without becoming a punishment system. Feedback is coach-facing by default, describes behavior not character, and is optional and lightweight.

    Initial feedback categories:
    - effort
    - team help
    - reset after mistake
    - positional discipline
    - teammate involvement

    Allowed observable feedback examples:
    - helped teammate after ball loss
    - stopped after mistake
    - recovered position quickly
    - drifted too far from home zone
    - looked for pass instead of forcing solo action
    - tracked runner after teammate was beaten
    - encouraged teammate after mistake
    - gave up on recovery run
    - stayed available for pass
    - involved weaker teammate in play

    Disallowed feedback language:
    - lazy
    - selfish
    - bad attitude
    - weak player
    - not good enough
    - useless
    - problem player

    Scenario: Coach records player execution feedback
      Given match "m1" has been played
      And player "p1" was selected for match "m1"
      When the coach records feedback
      Then the feedback may include effort, team help, reset after mistake, positional discipline, and teammate involvement
      And the feedback must use observable football behavior
      And the feedback must remain coach-facing by default
      And the feedback may inform future coach warnings and planning suggestions

    Scenario: Feedback must use observable behavior not character labels
      Given the coach records feedback for player "p1"
      When the coach types feedback text
      Then the app must accept observable behavior descriptions such as "recovered position quickly"
      And the app must reject disallowed labels such as "lazy" or "bad attitude"
      And the app must warn the coach if disallowed language is entered

    Scenario: Feedback must not mutate finalized planned selections
      Given match "m1" has a finalized planned squad
      And the coach records post-match feedback for player "p1"
      When the feedback is saved
      Then the finalized planned selections must not be modified
      And the feedback must be stored as a separate record linked to the match and player

    Scenario: Feedback may contribute to effective participation history
      Given player "p1" actually appeared in the post-match report for match "m1"
      When the coach records feedback for player "p1"
      Then the feedback may be linked to the effective participation record
      And the feedback must not be confused with the planned selection
      And actual participation must remain separate from planned selection

    Scenario: Feedback is excluded from parent-facing exports
      Given player "p1" has coach-facing feedback recorded
      When the coach creates a parent-facing export
      Then the feedback must not appear in the export
      And no feedback-derived labels or ratings must appear in the export

    Scenario: Coach records team-level post-match reflection
      Given match "m1" has been played
      When the coach records a team-level reflection
      Then the reflection may include match effort, team cohesion, positional shape, and recovery behavior
      And the reflection must use observable football language
      And the reflection must remain coach-facing by default

    Scenario: Feedback is optional and lightweight
      Given match "m1" has been played
      When the coach views the match detail
      Then recording feedback must be optional
      And feedback should be recorded only where useful
      And missing feedback must not block any workflow


  Rule: Coach-facing and parent-facing language separation

    Internal planning reasons must not leak into parent or player exports. The app supports coach view and parent/player export view with strict separation.

    Coach-facing language may include:
    - movement direction and source/target team
    - selection role (CORE, SUPPORT, DEVELOPMENT, SQUAD_REPAIR)
    - matchday responsibility
    - support burden and fairness impact
    - readiness signals
    - execution feedback
    - override reason
    - rule warnings
    - internal explanation
    - coaching intent

    Parent-facing language must use neutral terms such as:
    - rotation
    - suitable challenge
    - team balance
    - availability
    - match experience
    - development opportunity
    - squad adjustment
    - planning period
    - match group

    Parent-facing language must avoid:
    - low readiness
    - weak player
    - support burden
    - confidence rebuild
    - effort concern
    - coach trust
    - needs_attention
    - internal ranking
    - punishment
    - selection debt
    - culture debt
    - hidden judgement

    Scenario: Coach export includes internal roles and explanations
      Given finalized selections exist
      When the coach exports coach-facing planning information
      Then the export may include selection roles, movement direction, explanations, override reasons, readiness notes, and feedback where relevant

    Scenario: Parent export hides internal judgement
      Given a selection has coach-facing notes about effort, readiness, support burden, or confidence rebuild
      When the coach exports a parent-facing squad message
      Then the export must hide internal judgement
      And the export must use neutral language such as rotation, suitable challenge, team balance, availability, or development opportunity
      And the export must not include readiness signals, execution feedback, or coaching intent

    Scenario: Player names and personal data must not be sent to external AI services
      Given the app uses any external AI or analytics service
      When player data is sent to the service
      Then the app must use stable player IDs only
      And must not include player names, readiness signals, feedback text, or coach notes
      And must sanitize payloads to remove personally identifiable information

    Scenario: Hosted architecture does not make coach-facing data public
      Given the app is deployed on a hosted platform
      When a non-coach user attempts to access coach-facing data
      Then the app must require authenticated coach access
      And coach-facing data must not be accessible without authentication
      And coach-facing data must not appear in public APIs or public URLs


  Rule: Explanation requirements

    Important selection decisions must be explainable through rules, intent, and impact. Every non-obvious selection should have a machine-readable explanation that the coach can review.

    Scenario: Coach asks why a player was selected
      Given player "p1" is selected for match "m1"
      When the coach asks why player "p1" was selected
      Then Matchboard must explain the selection role
      And the movement path or override reason
      And the coaching intent served where relevant
      And the matchday responsibility where assigned
      And any fairness, load, support, or risk impact

    Scenario: Coach asks why a player was not selected
      Given player "p1" is not selected for match "m1"
      When the coach asks why player "p1" was not selected
      Then Matchboard must explain whether the cause was a hard eligibility rule, scoring preference, squad constraint, fairness concern, or coach override
      And the explanation must not imply punishment unless the coach explicitly recorded an override reason

    Scenario: Coach asks which rule blocked a move
      Given player "p1" was not selected for support because of a rule
      When the coach asks why player "p1" was blocked
      Then Matchboard must identify the specific rule that blocked the move
      And must distinguish between hard eligibility rules and scoring preferences
      And must explain whether the block can be overridden with a manual reason

    Scenario: Coach asks what risk a manual change creates
      Given the coach manually adds or removes a player from a draft squad
      When the change is confirmed
      Then Matchboard must show impact on warnings, round status, match status, explanations, fairness, and movement ledger
      And must show same-round conflicts, availability issues, squad size impact, and support burden changes

    Scenario: Explanation distinguishes hard rules from scoring preferences
      Given player "p1" is not selected because of availability (hard rule)
      And player "p2" is ranked below player "p3" because of fairness scoring (soft preference)
      When the coach asks for explanations
      Then the explanation for player "p1" must identify availability as a hard eligibility rule
      And the explanation for player "p2" must identify fairness as a scoring preference that can be overridden

    Scenario: Explanation distinguishes planned selection from actual participation
      Given player "p1" was planned as CORE for match "m1"
      And player "p1" actually appeared as support in the post-match report for match "m1"
      When the coach reviews history
      Then the explanation must distinguish the planned selection from actual participation
      And planned selection and actual participation must not be confused

    Scenario: Explanation uses stable player IDs in external contexts
      Given the app generates an export or external payload
      When the explanation is included in the payload
      Then player references must use stable player IDs
      And must not include player names in external or sanitized contexts


  Rule: Manual draft change impact analysis

    Manual changes are allowed, but Matchboard must explain what changed and what debt or risk was created. Manual changes support real matchday reality: late absence, emergency support, sickness, injury, availability change, coach judgement, squad size repair, real-world backfill, and actual participation differing from planned selection.

    Scenario: Manual add recalculates warnings and impact
      Given match "m1" is in DRAFT state
      When the coach manually adds player "p1" to match "m1"
      Then Matchboard must recalculate match status, round status, warnings, explanations, and fairness impact
      And must recalculate the movement ledger for the change
      And must show the impact of the change

    Scenario: Manual add shows same-round conflict
      Given player "p1" is already selected for match "m2" in the same round as match "m1"
      When the coach manually adds player "p1" to match "m1"
      Then Matchboard must warn about the same-round conflict
      And must require an override reason

    Scenario: Emergency backfill is recorded as actual participation
      Given match "m1" has a finalized planned squad
      And player "p1" was not part of the finalized planned squad
      When the coach manually records player "p1" as participating
      Then Matchboard must record this as actual participation
      And must not rewrite the finalized planned selection
      And must show impact on load, fairness, support burden, and same-round conflicts
      And must require or preserve a coach-facing reason if normal rules were violated

    Scenario: Additional actual appearance is tracked through participation not planned selections
      Given player "p1" actually appeared in two post-match reports in the same round
      When the coach records post-match data
      Then the additional actual appearance must be tracked as effective participation history
      And must affect future fairness and load calculations
      And must not mutate finalized planned selections
      And must not create a planning warning against "p1"

    Scenario: Manual removal preserves audit history
      Given player "p1" is selected for match "m1" in DRAFT state
      When the coach manually removes player "p1"
      Then the removal must be recorded with a reason
      And the movement ledger must be updated
      And warnings, explanations, and fairness impact must be recalculated


  Rule: Misuse guardrails

    Matchboard must protect development, belonging, and privacy while supporting honest coach judgement. Matchboard must not become a punishment engine, a hidden player ranking ladder, a moral scoring system, a parent-visible judgement tool, a tool for hard early sorting, a fake equality generator, a generic scheduling system, a generic club-management system, or a public player evaluation system.

    Scenario: Readiness cannot become automatic punishment
      Given player "p1" has readiness signal "needs_attention"
      When selections are generated
      Then player "p1" must not be automatically excluded only because of that signal
      And any exclusion must be explained through hard eligibility, squad constraints, or explicit coach override

    Scenario: Parent export cannot expose internal judgement
      Given player "p1" has coach-facing feedback and readiness signals
      When the coach creates a parent-facing export
      Then the feedback must not be included
      And the readiness signals must not be included
      And the export must use neutral planning language

    Scenario: Movement remains temporary and explainable
      Given player "p1" is selected as SUPPORT for Team C from Team B
      When the coach reviews the movement
      Then the movement must be explained by rotation path, team need, and fairness context
      And the movement must not be described as a permanent label or identity change
      And the player must be expected to return to their core team

    Scenario: Stable belonging remains protected
      Given player "p1" has a core team
      When player "p1" is moved as support or development
      Then player "p1" must retain their core team membership
      And the movement must not redefine the player's team identity
      And the player must be shown as belonging to their core team with a temporary assignment

    Scenario: Coach judgement remains explicit when overriding rules
      Given the coach manually overrides a domain rule
      When the override is saved
      Then the override must require a structured reason category and detail
      And the override must appear in the finalization summary
      And the override must not be silently applied

    Scenario: Hosted deployment does not weaken privacy boundaries
      Given the app is deployed on a hosted platform
      When coach-facing data is stored
      Then the data must be protected by authenticated coach access
      And the hosted architecture must not make planning data public
      And readiness, feedback, and internal explanations must remain coach-facing by default

    Scenario: Player development context does not become public labels
      Given player "p1" has readiness signals and matchday responsibilities recorded
      When any export or external-facing view is generated
      Then readiness signals must not appear in parent-facing exports
      And matchday responsibilities must not appear in parent-facing exports without explicit coach choice and neutral language
      And no permanent player ranking or level label must be generated or stored

    Scenario: Stronger players can support without permanent identity change
      Given player "p1" from Team A is selected as SUPPORT for Team C
      When the coach reviews the selection
      Then the explanation must describe the movement as "sent as support" or "supporting Team C"
      And must never describe it as "demoted" or "benched" or "punished"
      And player "p1" must remain listed under Team A as core team member

    Scenario: Challenge exposure is based on readiness and context not permanent level
      Given player "p2" receives a challenge_exposure matchday responsibility
      When the coach reviews the responsibility
      Then the responsibility must be described in observable football terms
      And must not imply a permanent level upgrade or downgrade
      And must be changeable from match to match

    Scenario: Social participation does not define football ceiling
      Given a player participates in support roles across several rounds
      When fairness analysis is performed
      Then support burden must be tracked to prevent over-reliance on the same players
      And support must not define the player's permanent football ceiling
      And development opportunity must remain available alongside support duty


  Rule: Canonical navigation and route model

    Matchboard has exactly four primary navigation items. All other routes are secondary, accessible through contextual links rather than competing top-level navigation.

    Scenario: Primary navigation contains exactly four items
      Given the coach is using the app
      When the primary sidebar or mobile navigation is visible
      Then the navigation must contain exactly these items in order:
        | item       | route        |
        | Assistant  | /assistant   |
        | Fixtures   | /fixtures    |
        | Teams      | /teams       |
        | Players    | /players     |
      And the navigation must not include /rounds, /matches, /season, /history, or /rules as primary items

    Scenario: Root redirects to Assistant
      Given the coach navigates to the root URL
      When the app loads
      Then the app must redirect to /assistant

    Scenario: Today redirects to Assistant
      Given the coach navigates to /today
      When the app loads
      Then the app must redirect to /assistant

    Scenario: Matches redirects to Fixtures
      Given the coach navigates to /matches
      When the app loads
      Then the app must redirect to /fixtures

    Scenario: No page links to /matches as primary fixture list
      Given the coach is using the app
      When any page, component, navigation item, CTA, or breadcrumb renders
      Then no link may point to /matches as the main fixture-list destination
      And match detail routes such as /matches/[matchId] may remain where required

    Scenario: Assistant navigation is active on /assistant
      Given the coach navigates to /assistant
      When the sidebar renders
      Then the Assistant item must show active state

    Scenario: Fixtures navigation is active in fixture and round contexts
      Given the coach navigates to /fixtures or /rounds/[matchRoundId]
      When the sidebar renders
      Then the Fixtures item must show active state

    Scenario: Teams navigation is active in team contexts
      Given the coach navigates to /teams or /teams/[teamId]
      When the sidebar renders
      Then the Teams item must show active state

    Scenario: Players navigation is active in player contexts
      Given the coach navigates to /players or /players/[playerId]
      When the sidebar renders
      Then the Players item must show active state

    Scenario: Redirected routes do not show unselected sidebar
      Given the coach is redirected from / or /today to /assistant
      When the page loads
      Then the Assistant sidebar item must be active
      And no navigation state must appear unselected or misleading


  Rule: Operational workflow hierarchy

    The visible daily workflow follows a clear hierarchy.

    Scenario: Assistant identifies the next required action
      Given the coach opens the app
      Then the Assistant page must show the next action based on setup progress and current workflow state

    Scenario: Fixtures provides the season and round hierarchy
      Given the coach opens Fixtures
      Then the page must show the planning period and round hierarchy
      And each round must show its status and the correct next action

    Scenario: Round Board is the primary squad decision surface
      Given the coach opens a match round
      Then the Round Board must be the primary surface for squad review and changes
      And actions must include Generate, Resolve blockers, Finalise, and View finalised plan

    Scenario: Season, History and Rules are secondary destinations
      Given the coach is using the app
      Then /season, /history, and /rules must be accessible through contextual links
      And they must not be primary sidebar items


  Rule: Consistent status vocabulary

    Matchboard uses one consistent visible status vocabulary across all surfaces.

    Scenario: Status badges use documented vocabulary
      Given the app displays a round or match status
      Then the visible label must be one of:
        | status        | label           |
        | NOT_GENERATED | Not generated   |
        | DRAFT         | Draft           |
        | BLOCKED       | Blocked         |
        | READY         | Ready           |
        | FINALIZED     | Finalized       |
      And the app must not introduce alternative visible status terms for the same state


  Rule: Warning and action hierarchy

    Blocking issues must dominate warnings. Warnings must dominate informational explanations. One primary action must be visually dominant per workflow context.

    Scenario: Blocking issues are visually dominant
      Given match round "R1" has HARD_BLOCK warnings
      When the coach views the round
      Then blocking warnings must be visually dominant over review-required and informational warnings

    Scenario: Review-required warnings are visible without opening technical detail
      Given match round "R1" has REQUIRES_OVERRIDE warnings
      When the coach views the round
      Then the warnings must be visible without opening a hidden drawer or toggle

    Scenario: Informational warnings may be progressively disclosed
      Given match round "R1" has SCORING_PREFERENCE warnings
      When the coach views the round
      Then the warnings may be shown behind a toggle or details inspector

    Scenario: One primary action per workflow context
      Given the coach is on a page with workflow actions
      Then exactly one primary action must be visually dominant
      And secondary actions must be clearly subordinate

    Scenario: Draft and finalized states are visually distinct
      Given match round "R1" is in DRAFT state
      And match round "R2" is in FINALIZED state
      When the coach views both rounds
      Then DRAFT and FINALIZED must be visually distinct
      And finalized rounds must not appear editable


  Rule: User-facing terminology

    Matchboard uses consistent neutral coaching language in all user-facing text.

    Scenario: Assistant page uses correct terminology
      Given the coach opens /assistant
      Then the page title must be "Assistant"
      And the page must not use "Dashboard" as its title or label
      And the page must not show "Decision inbox" or "Decision debt"
      And the page must not show the CoachingIntentSelector component

    Scenario: Round Board uses correct terminology
      Given the coach views a round board
      Then the app must use "Round Board" not "Command center" or "Decision inbox"

    Scenario: Warning section uses correct terminology
      Given the coach views warnings
      Then the app must use "Needs Action" or "Round Checks" not "Decision inbox" or "Decision debt"

    Scenario: Squad repair uses correct terminology
      Given the generation engine produces a BACKFILL selection for squad repair
      When the coach views the selection in the UI
      Then the role must be displayed as "Squad repair" not "Backfill"
      And the BACKFILL enum value must remain internally for backward compatibility

    Scenario: Movement language uses neutral coaching language
      Given the app displays player movement
      Then the app must use "Sent as support" not "Demoted"
      And must use "Received support" not "Promoted"
      And must use "Development movement" not "Upgraded"
      And must use "Not selected this round" not "Benched"
      And must use "Short" or "Below target" not "Weak team"
      And must use "Donor team" not "Higher team"
      And must use "Receiving team" not "Lower team"

    Scenario: Product shell does not contain stale framing
      Given the coach is using the app
      Then no visible component may contain "Local-first" or "Local first"
      And no page title may be "Dashboard" when referring to /assistant
      And no navigation label may use "Command center", "Decision inbox", "Decision debt", "Structured review room", "Optimization output", "Workspace", "Entity", or "Resource"


  Rule: Opponent teams and encounter observations

    Matchboard stores opponent teams as reusable private match-planning entities.
    Every match is linked to one persisted opponent team while preserving the historical match-time display name.
    After a match, the coach may record structured, private observations about the match environment.
    Opponent observations describe individual encounters, never fixed traits of an opponent team.
    The selection engine remains unchanged: opponent data does not alter squad generation.


    Scenario: Creating a match requires selecting or creating an opponent team
      Given the coach is creating a new match
      When the coach enters match details
      Then the form must present an opponent team field
      And the field must allow selecting an existing opponent team
      And the field must allow creating a new opponent team inline
      And the field must be required

    Scenario: Selecting an existing opponent team links the match
      Given opponent team "Bryne G11 Hvit" exists
      When the coach selects "Bryne G11 Hvit" for a new match
      Then the match must store the opponent team's ID as opponentTeamId
      And the match must store "Bryne G11 Hvit" in the opponent field as a match-time snapshot
      And the opponent field must not change when the opponent team displayName is later renamed

    Scenario: Creating a new opponent team inline
      Given no opponent team matching "Stabæk G12 Blå" exists
      When the coach types "Stabæk G12 Blå" in the opponent team field
      Then the form must offer a "Create opponent team: Stabæk G12 Blå" option
      When the coach confirms creation
      Then a new OpponentTeam record must be created with displayName "Stabæk G12 Blå"
      And the match must be linked to the new opponent team
      And the match must store "Stabæk G12 Blå" in the opponent field

    Scenario: Opponent team name normalization prevents duplicates
      Given opponent team "Bryne G11 Hvit" exists with normalizedName "bryne g11 hvit"
      When the coach enters "  bryne   G11 hvit " in the opponent team field
      Then the form must not offer duplicate creation as the primary option
      And the form must resolve to the existing "Bryne G11 Hvit" opponent team
      And no duplicate opponent team record must be created

    Scenario: Opponent teams are private coach-facing context
      Given an opponent team exists
      Then opponent teams must not be publicly accessible
      And opponent teams must not appear in parent-facing exports
      And opponent team records must not be sent to external AI payloads

    Scenario: Historical migration backfills opponent team relations
      Given existing matches store only Match.opponent text
      When the migration runs
      Then each unique normalized opponent name must create one OpponentTeam record
      And each existing match must receive an opponentTeamId linking it to the corresponding OpponentTeam
      And historical Match.opponent text must remain unchanged
      And no match must remain without an opponentTeamId after migration
      And opponent strings differing only by casing or whitespace must link to the same normalized opponent team

    Scenario: Opponent team display name snapshot is preserved
      Given match M1 was created with opponent display name "Bryne G11 Hvit"
      And the opponent team displayName is later changed to "Bryne G11 White"
      Then M1.opponent must still show "Bryne G11 Hvit"
      And must not be rewritten to "Bryne G11 White"

    Scenario: Referenced opponent teams cannot be hard deleted
      Given opponent team OT1 is referenced by one or more matches
      Then deleting OT1 must be restricted
      And the database must enforce onDelete: Restrict on the match relation


    Scenario: Match fit uses existing field and values
      Given Match.matchFit already exists as the sporting-fit observation
      Then no new sporting-fit model or enum must be introduced
      And Match.matchFit must remain the sporting-fit observation for a played encounter

    Scenario: Match fit describes the encounter not the opponent
      Given match M1 has matchFit GOOD_FIT
      Then matchFit must describe how suitable the challenge was for the squad that played
      And matchFit must not be a permanent level classification of the opponent team
      And matchFit must not be a behavioural observation

    Scenario: Match fit values use required user-facing labels
      Given the following Match.fit values exist
        | Value               | Required user-facing label                    |
        | UNKNOWN             | Not assessed                                  |
        | TOO_EASY            | Too little challenge for this squad           |
        | GOOD_FIT            | Suitable challenge for this squad             |
        | TOO_HARD            | Too much challenge for this squad             |
        | CHAOTIC             | Difficult to assess due to match conditions   |
        | SUPPORT_OVERPOWERED | Our support level made the match less suitable |
        | SUPPORT_TOO_LOW     | Our support level did not meet the match need  |
      Then opponent encounter history must display these exact labels
      And numeric ordinals must not appear in UI

    Scenario: Match fit does not automatically change future selections
      Given Team C match M1 was recorded as matchFit TOO_HARD
      When the app generates the next match round
      Then the app must not automatically change Team C support targets
      And the app must not automatically change player eligibility
      And the app must not automatically change squad generation

    Scenario: Advisory match-fit ordinal mapping is internal
      Given the following advisory ordinal mapping
        | MatchFit value       | Internal ordinal |
        | UNKNOWN              | null            |
        | TOO_EASY             | -1              |
        | GOOD_FIT             | 0               |
        | TOO_HARD             | 1               |
        | CHAOTIC              | null            |
        | SUPPORT_OVERPOWERED  | null            |
        | SUPPORT_TOO_LOW      | null            |
      Then the ordinal mapping must be a domain helper only
      And the numeric ordinal must not appear in UI
      And the ordinal must not be stored as an opponent score
      And the ordinal must not be aggregated into automatic recommendations in this branch
      And CHAOTIC, SUPPORT_OVERPOWERED, and SUPPORT_TOO_LOW must map to null because they do not cleanly express opponent challenge independently of match circumstances


    Scenario: Recording a match environment observation
      Given match M1 has been played
      When the coach records a post-match observation for M1
      Then at most one OpponentEncounterObservation may exist per match
      And the observation must be linked to the match and the match's opponent team
      And the observation must not be a permanent label on the opponent team

    Scenario: Observation overall environment values
      Given the coach is recording a match environment observation
      Then the available overall environment values must be
        | Value              | Label                     |
        | NOT_ASSESSED       | Not assessed              |
        | POSITIVE           | Positive experience       |
        | ACCEPTABLE         | Acceptable experience     |
        | CONCERN            | Concern observed          |
        | SERIOUS_CONCERN    | Serious concern observed  |

    Scenario: Observation area values
      Given the coach is recording a match environment observation
      Then three observation areas must be available
        | Field concept                | Label                             |
        | opponentPlayersContext       | Opponent players                  |
        | opponentStaffContext        | Opponent coaching/staff environment |
        | spectatorSidelineContext    | Spectator/sideline environment    |
      And each area must use the same values as overall environment
      And individual areas may remain NOT_ASSESSED

    Scenario: Observation area consistency
      Given the coach is recording a match environment observation
      When any individual area is marked CONCERN
      Then overall environment must be CONCERN or SERIOUS_CONCERN
      When any individual area is marked SERIOUS_CONCERN
      Then overall environment must be SERIOUS_CONCERN
      When overall environment is POSITIVE or ACCEPTABLE
      And no area is CONCERN or SERIOUS_CONCERN
      Then individual areas may be NOT_ASSESSED, POSITIVE, or ACCEPTABLE
      When the form submission violates consistency rules
      Then the form must reject the save with the message "Overall match environment must be marked as a concern when a concern is recorded in an observed area"
      Or the message "Overall match environment must be marked as a serious concern when a serious concern is recorded in an observed area"

    Scenario: Concern categories are required when concern is recorded
      Given the coach is recording a match environment observation
      When overall environment is CONCERN or SERIOUS_CONCERN
      Then at least one concern category must be selected
      When any individual area is CONCERN or SERIOUS_CONCERN
      Then at least one concern category must be selected
      When concern categories are missing and required
      Then the form must reject the save with the message "Select at least one observable concern category when a concern is recorded"

    Scenario: Concern categories use exact values and labels
      Given the coach is recording a concern observation
      Then the available categories must be
        | Value                                | Label                                    |
        | PRESSURE_ON_REFEREE_DECISIONS        | Pressure directed at referee decisions    |
        | DISRESPECTFUL_LANGUAGE_OR_SHOUTING    | Disrespectful language or shouting        |
        | UNSPORTING_MATCH_CONDUCT              | Unsporting match conduct                  |
        | PHYSICAL_PLAY_OR_SAFETY_CONCERN       | Physical play or situation causing safety concern |
        | THREATS_OR_INTIMIDATION               | Threatening or intimidating conduct       |
        | DISCRIMINATORY_OR_DEGRADING_LANGUAGE   | Discriminatory or degrading language      |
        | SIDELINE_ATMOSPHERE_CONCERN            | Sideline atmosphere concern               |
        | SAFE_MATCH_FRAME_NOT_SUPPORTED          | Safe match framework was not supported    |
        | OTHER_OBSERVABLE_CONCERN               | Other observable concern                  |
      And categories must describe an observed event or condition, never an individual
      And duplicate category values must be stored only once

    Scenario: Factual summary field requirements
      Given the coach is entering a factual summary
      Then the field label must be "Brief factual summary"
      And maximum length must be 500 characters
      And helper text "Describe what affected the match environment. Do not include names, shirt numbers or identifying details." must be always visible
      When overall environment is SERIOUS_CONCERN
      Then a factual summary is required
      And the form must show "Add a brief factual summary for a serious concern. Do not include names or identifying details."
      When overall environment is not SERIOUS_CONCERN
      Then a factual summary is optional
      And empty summaries must be stored as null
      And the form must reject text exceeding 500 characters
      And the form must reject obvious email address patterns
      And the form must reject obvious phone number patterns
      And the form must reject obvious URL patterns

    Scenario: Follow-up status values
      Given the coach is recording follow-up status
      Then the available values must be
        | Value                                     | Label                                      |
        | NONE                                      | No follow-up recorded                       |
        | DISCUSSED_AFTER_MATCH                     | Discussed after match                       |
        | INFORMED_OWN_CLUB_FAIR_PLAY_CONTACT       | Informed own club Fair Play contact          |
        | FORMAL_FOLLOW_UP_OUTSIDE_MATCHBOARD        | Formal follow-up handled outside Matchboard  |
        | NO_FURTHER_ACTION_REQUIRED                | No further action required                   |
      And Matchboard records follow-up state only
      And Matchboard must not store the formal complaint or incident-report text
      And Matchboard must not send a report automatically

    Scenario: Serious concern informational callout
      Given the coach has set overall environment to SERIOUS_CONCERN
      Then the UI must display the exact text "Matchboard records encounter context only. Serious concerns should be followed up through the club's Fair Play routine outside this app. Do not include names or identifying details here."
      And the callout must be prominent but must not present the opponent team as permanently dangerous or categorised
      And the callout must not block saving

    Scenario: Saving a post-match observation
      Given the coach has entered observation data for a played match
      When the coach saves the observation
      Then the observation and its category list must be saved atomically
      And saving must not modify finalized squad selections
      And saving must not alter warnings, blockers, movement ledger, fairness, or selection-engine state
      And the observation must follow existing post-match lock rules
      And no hidden edit path must bypass post-match lock semantics


    Scenario: Coach can view opponent encounter history
      Given an authenticated coach
      When the coach opens the opponent encounter history for opponent team OT1
      Then the view must show OT1 display name
      And the view must show number of recorded matches against OT1
      And the view must show number of matches with saved encounter observations
      And the view must show a chronological match list with date, our team, historical opponent label, home/away, match fit label, environment observation, concern categories, follow-up status, and factual summary
      And the view must not show numeric opponent score, averaged sporting score, star rating, opponent ranking, permanent risk colour, avoid or recommend language, automatic squad recommendation, or personal names

    Scenario: Encounter history displays match fit context
      Given match M1 against opponent OT1 was recorded with matchFit GOOD_FIT
      And M2 against OT1 was recorded with matchFit TOO_HARD
      Then the encounter history for OT1 must display "Suitable challenge for this squad" for M1
      And must display "Too much challenge for this squad" for M2
      And must not display numeric ordinals

    Scenario: Encounter history empty state
      Given opponent team OT1 has no encounter observations
      Then the encounter history must show "No encounter observations recorded for this opponent."
      And must not show an approval or clearance status

    Scenario: Encounter history concerns are factual
      Given encounter history shows a CONCERN or SERIOUS_CONCERN observation
      Then concerns must be visible but not sensationalised
      And colour must not be the only indicator of assessment state
      And the page must not visually resemble a league table, rating table, or risk dashboard


    Scenario: Previous encounters panel during planning
      Given a future match is linked to opponent team OT1
      And OT1 has prior encounters
      When the coach views the match detail for the future match
      Then a "Previous encounters" panel may be shown containing:
        | total previous matches against this opponent                |
        | up to 3 recent encounters with date, team, match fit, concern |
        | count of encounters with overall CONCERN or SERIOUS_CONCERN |
        | latest concern observation date where relevant              |
        | link "View encounter history"                               |
      And the panel must display "Previous encounter context only. Matchboard does not automatically change squad selection based on opponent history."
      And the panel must be informational only
      And the panel must be coach-facing only
      And the panel must be non-blocking
      And the panel must be excluded from parent-facing exports
      And the panel must be excluded from external AI payloads

    Scenario: Previous encounters panel must not alter selection
      Given a future match against OT1 has previous encounter observations
      Then the panel must not add warnings
      And must not add blockers
      And must not alter round status
      And must not alter match status
      And must not change squad generation
      And must not change finalisation
      And must not recommend individual player inclusion or exclusion


    Scenario: Selection engine is unchanged by opponent history
      Given otherwise identical match-planning inputs
      When opponent history differs across these cases:
        | no previous encounter history       |
        | previous GOOD_FIT match history     |
        | previous TOO_HARD match history     |
        | previous positive environment observation  |
        | previous concern observation               |
        | previous serious concern observation       |
      Then generated squads must be identical in every case
      And eligibility must be identical
      And support priority must be identical
      And development movement must be identical
      And squad repair must be identical
      And fairness scoring must be identical
      And readiness signals must be identical
      And match warnings must be identical
      And blockers must be identical
      And finalisation behaviour must be identical


    Scenario: Parent-facing exports exclude opponent observations
      Given a coach-facing export includes opponent encounter observations
      When the coach generates a parent-facing export
      Then the parent-facing export must not include:
        | environment assessment            |
        | concern categories                |
        | factual summary                   |
        | follow-up status                   |
        | encounter-history concern counts  |
        | latest concern date                |
      And the parent-facing export may include normal fixture information such as opponent-team display name

    Scenario: External AI payloads exclude opponent observations
      Given the application prepares external AI or service payloads
      Then the payloads must exclude:
        | OpponentEncounterObservation data  |
        | factual summary text              |
        | concern categories                |
        | follow-up status                   |
        | environment values                |
        | opponent historical concern aggregates |

    Scenario: No opponent person-identifying fields exist
      Given the opponent observation data model
      Then no field may store opponent player names
      And no field may store opponent coach names
      And no field may store parent or spectator names
      And no field may store referee names
      And no field may store shirt numbers connected to incidents
      And no field may store contact information
      And no field may store physical descriptions
      And no field may store identifying details about individuals

    Scenario: Opponent terminology uses required language
      Given the app displays opponent information
      Then the app must use "Opponent team" not "Bad team" or "Problem team"
      And must use "Previous encounters" not "Risk history"
      And must use "Encounter history" not "Opponent rating"
      And must use "Post-match observation" not "Opponent evaluation"
      And must use "Sporting match fit" not "Opponent strength"
      And must use "Match environment" not "Threat assessment"
      And must use "Fair Play concern" not "Bad behaviour"
      And must use "Observed concern" not "Red flag"
      And must use "Serious concern observed" not "Unsafe team"
      And must use "Follow-up" not "Action required"
      And must use "Brief factual summary" not "Incident report"
      And must use "No concern observed" not "Clean record"
      And must use "Not assessed" not "Unknown risk"
      And must not use "Blacklist", "Reputation score", "Fair Play score", "Opponent rating", "Opponent quality score", "Hostile parents", "Aggressive coach", "Dirty players", "Weak opponent", "Strong opponent", or "Avoid this team"

    Scenario: Opponent observations do not create a rating or blacklist
      Given the app stores opponent encounter observations
      Then no opponent rating must exist
      And no opponent ranking must exist
      And no opponent blacklist must exist
      And no Fair Play score must exist
      And no combined environment and sporting score must exist
      And no opponent-level permanent classification must exist
      And no opponent-level colour-coded status badge must exist

  Rule: Players overview separates seasonal facts from current planning attention

  The Players area provides three modes:
  - Season overview
  - Current round attention
  - Manage base groups

  Season overview is the default mode.

  Season overview displays factual participation and recorded match statistics for a selected planning period.

  Current round attention displays current plan-integrity context for a selected match round.

  Manage base groups provides stable core-team assignment maintenance separately from match planning and seasonal review.

  Scenario: Players opens in season overview mode
    Given an authenticated coach opens "/players"
    And an active planning period exists
    When active players exist
    Then "Season overview" must be selected by default
    And the selected planning period must be visible
    And the page must show participation statistics scoped to that planning period

  Scenario: Coach switches Players modes
    Given the coach is viewing "/players"
    When the coach selects "Current round attention"
    Then the page must display current-round planned opportunity and integrity context only
    When the coach selects "Manage base groups"
    Then the page must display stable team-assignment administration
    And it must explain that base groups are separate from weekly match selection

  Scenario: Actual reported participation counts as played
    Given a reported or locked post-match report records player "p1" as having played
    When the coach views Season overview for the containing planning period
    Then "Played" for "p1" must increase by one
    And recorded goals and assists for "p1" must be included

  Scenario: Draft selection is not counted as played
    Given player "p1" is selected in a draft match
    And no reported or locked actual participation exists for that match
    When the coach views Season overview
    Then the draft selection must not increase "Played"

  Scenario: Finalised unreported assignment is upcoming rather than played
    Given player "p1" is selected in a finalised future match
    And no reported or locked actual participation exists
    When the coach views Season overview
    Then "Played" must not increase

  Scenario: Planned absence is separate from played
    Given player "p1" was planned for a match
    And a reported or locked post-match report records that "p1" did not participate
    When the coach views Season overview
    Then "Played" must not increase for that match
    And "Planned absent" must increase

  Scenario: Matchday addition counts as actual participation
    Given player "p1" participated outside the finalised planned squad
    And the participation is stored in a reported or locked post-match report
    When the coach views Season overview
    Then "Played" must increase
    And "Matchday additions" must increase
    And this fact must not create a warning or fairness fault against "p1"

  Scenario: Additional actual appearance remains factual load context
    Given player "p1" actually participated in more than one match in a round
    When the coach views Season overview
    Then each actual participation must count in "Played"
    And the additional appearance may be shown as factual context
    And it must not be displayed as a planning issue

  Scenario: Desktop Season overview shows factual selected-period columns
    Given the coach views Season overview on desktop
    Then the default table must show these columns in order:
      | Player |
      | Core team |
      | Played |
      | Goals |
      | Assists |
      | Core |
      | Support |
      | Development |
      | Matchday additions |
      | Planned absent |
      | Review |
    And numerical values must be scoped to the visible selected planning period

  Scenario: Role counts represent actual played involvement
    Given player "p1" actually participated in a reported or locked match
    And that match has a recorded planned role for "p1"
    When Season overview calculates role involvement
    Then an actual core-role appearance must increase "Core"
    And an actual support-role appearance must increase "Support"
    And an actual development-role appearance must increase "Development"
    And a planned selection where the player did not play must not increase these actual role counts

  Scenario: Matchday addition without planned role does not invent a role
    Given player "p1" is an unplanned actual participant without a planned selection role
    When Season overview calculates role involvement
    Then "Played" and "Matchday additions" must increase
    And the app must not invent a Core, Support or Development role

  Scenario: Recorded goals and assists are factual statistics only
    Given goals or assists are recorded for player "p1"
    When the coach views Season overview
    Then those totals must appear as factual statistics
    And they must not create an attention state
    And they must not affect selection generation or fairness decisions

  Scenario: Sorting by Played supports manual fairness review
    Given Season overview has players with different actual appearance counts
    When the coach sorts by "Played" ascending
    Then lower actual appearance counts must appear first
    And the app must not automatically label those players as unfairly treated

  Scenario: Current round attention uses canonical live integrity
    Given a selected match round exists
    When the coach views "Current round attention"
    Then each active in-scope player must show current availability
    And each eligible available player must show their planned opportunity or absence of one
    And state must be derived from canonical live plan integrity

  Scenario: Available player without planned opportunity needs attention
    Given player "p1" is available and eligible for the selected round
    And "p1" has no planned match assignment
    When the coach views "Current round attention"
    Then "p1" must show "Needs match this round"
    And the state must be "Decision required"
    And the coach must be able to open the affected Round Board

  Scenario: Selected unavailable player is blocked
    Given player "p1" is selected in the selected round
    And "p1" is unavailable
    When the coach views "Current round attention"
    Then "p1" must show "Unavailable selection"
    And the state must be "Blocked"
    And the coach must be able to open the affected Round Board

  Scenario: Season statistics do not create current-round attention
    Given player "p1" has any pattern of goals, assists or historic movement
    And no current plan-integrity state applies
    When the coach views "Current round attention"
    Then "p1" must not display an active decision or blocked state due to season statistics

  Scenario: Base group management is separated from season review
    Given the coach selects "Manage base groups"
    Then the page must display:
      "Base groups define stable team belonging. Match selections and movement are planned in rounds."
    And the coach may manage player core-team assignment
    And this interaction must not be represented as weekly match participation or seasonal statistics

  Scenario: Players overview is coach-facing only
    Given player participation statistics and current attention context exist
    Then the Players overview modes must be visible only to authorised coaches
    And the overview must not be included in parent-facing exports
    And coach-only review context must not be included in external AI or service payloads

  Rule: Canonical statistical facts come from recorded match reality

    Player appearance totals must be derived from confirmed actual participation.

    Player goal totals must be derived from recorded Goal events linked to the player.

    Player assists remain derived from recorded per-player assist totals until an assist-event model is explicitly introduced.

    Draft and finalised planned selections must not be counted as actual played statistics.

    Conflicting duplicated records must be surfaced by integrity audit rather than silently chosen as truth.

  Scenario: Only confirmed present participation counts as played
    Given report "PM1" is "REPORTED"
    And player "p1" has attendance status "PRESENT"
    And player "p2" has attendance status "UNKNOWN"
    And player "p3" has attendance status "NO_SHOW"
    When actual appearances are calculated
    Then "p1" must receive one played appearance
    And "p2" must receive zero played appearances
    And "p3" must receive zero played appearances

  Scenario: Player goals are derived from Goal events
    Given reported report "PM1" has two Goal rows linked to player "p1"
    And aggregate player-stat goals is zero or absent
    When player goals are calculated
    Then "p1" must show two goals
    And aggregate player-stat goals must not override Goal-event truth
    And contradictory aggregate values must be reported by integrity audit

  Scenario: Assists remain aggregate recorded facts
    Given reported report "PM1" has player-stat assists for player "p1"
    When assists are calculated
    Then the assist total must use the player-stat assist record
    And Goal events must not imply assists

  Scenario: Final score does not invent player scorers
    Given a reported match has a final score
    And Goal events do not account for every own-team goal
    When player goal statistics are calculated
    Then unregistered goals must not be attributed to any player
    And the recorded final result remains valid

  Rule: Planned player outcome must be resolved before reporting

    Every player in a finalised planned squad must be confirmed as played or recorded as not having played with a structured reason before a report can become REPORTED or LOCKED.

    UNKNOWN attendance is unresolved and must not become completed report truth.

  Scenario: Report submission rejects unresolved planned attendance
    Given a report contains a finalised planned player with attendance status "UNKNOWN"
    When the coach submits the report as "REPORTED"
    Then submission must be rejected
    And the app must state "Confirm whether every planned player played before submitting the report."

  Scenario: Report locking rejects unresolved attendance
    Given a REPORTED report contains attendance status "UNKNOWN"
    When the coach locks the report as "LOCKED"
    Then locking must be rejected
    And the app must state "Resolve all attendance before locking."

  Scenario: Planned player confirmed as played
    Given player "p1" was planned
    When the coach records "Played"
    Then actual attendance must be "PRESENT"
    And no planned-absence record may remain for "p1"

  Scenario: Planned player confirmed as not played
    Given player "p1" was planned
    When the coach records "Did not play" with reason "SICK"
    Then "p1" must not count as Played
    And exactly one absence record with reason "SICK" must exist
    And "Planned absent" must include "p1"

  Scenario: Correcting absence to played reconciles records transactionally
    Given player "p1" has an absence record in draft report "PM1"
    When the coach changes the outcome to "Played"
    Then attendance must be "PRESENT"
    And the absence record must be removed or resolved transactionally

  Rule: Integrity audit detects divergence without inventing facts

    Matchboard provides a read-only integrity audit for canonical statistics and participation facts.

    Repair may only alter safely derived data.

    Repair must never infer scorer, attendance or absence facts.

  Scenario: Audit reports goal-source mismatch
    Given Goal-event totals and aggregate player-stat goal totals differ
    When the audit runs
    Then it must report the report, player identifier and both totals

  Scenario: Audit reports goal events exceeding own-team score
    Given a completed report where known own-player Goal events exceed the recorded own-team score
    When the audit runs
    Then it must report the mismatch as an error
    And it must not attribute unregistered goals to any player

  Scenario: Audit reports contradictory present and absent
    Given a completed report where a player is both PRESENT and has an absence record
    When the audit runs
    Then it must report the contradiction as an error

  Scenario: Audit reports reported unknown attendance
    Given a REPORTED or LOCKED report contains attendance status "UNKNOWN"
    When the audit runs
    Then it must report the unresolved attendance
    And it must not convert it automatically

  Scenario: Audit reports missing absence reason
    Given a planned player is not confirmed "PRESENT" in a completed report
    And no structured absence exists
    When the audit runs
    Then it must report missing absence reason
    And it must not invent the reason

  Scenario: Candidate duplication is reported without destructive repair
    Given candidate duplicate-source fields exist outside confirmed fixes
    When the audit runs
    Then it may report measurable divergence
    And it must not consolidate or delete those fields automatically
