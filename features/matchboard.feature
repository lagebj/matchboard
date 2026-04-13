Feature: Weekly match workflow, team fairness visibility, and single-match selection history
  This feature describes how the application maintains teams and players,
  guides the coach through weekly match work one match at a time,
  applies configurable selection rules,
  and stores finalized selections as history for future decisions.

  Background:
    Given teams can be maintained in the team registry
    And active players exist in the player registry
    And each player is assigned to exactly one core team
    And player profile data is available for selection decisions
    And some players may be marked as floating with explicit allowed float teams
    And finalized match selections are stored as historical records
    And manual changes to a generated selection must be allowed
    And the selection engine loads its rules from the configured ruleset

  Rule: Coach-desk workflow experience

    Scenario: App behaves like an assistant manager from the first session
      Given the coach opens the app on day 1
      When the landing page loads
      Then the app must suggest a sensible next action based on the current state of data
      And the app must keep guidance short and operational
      And the same guidance pattern must remain visible throughout the main workflow pages
      And the app must avoid long explanatory app-usage text

    Scenario: Landing page surfaces the next decision before raw registry data
      Given matches, players, teams, and finalized history may exist in the app
      When the coach opens the landing page
      Then the app must show the next operational decision first
      And the page must keep recent finalized outcomes visible as context
      And the page must present the broader selection loop without forcing the coach to start from raw tables

    Scenario: Overview pages show workflow context before deep tables or forms
      Given the coach opens an overview page such as players, teams, matches, history, or rules
      When the page loads
      Then the page must show one compact workflow summary and next-action guidance before the main table or form
      And the page must avoid splitting the overview into unnecessary parallel panels
      And the table or form must remain available as a secondary operational surface
      And the page copy must read like short face-to-face guidance from an assistant manager

    Scenario: Match workflow is organized around calendar weeks
      Given one or more registered matches exist
      When the coach works the match workflow
      Then the app must group operational match work by calendar week
      And the current week must be readable before the coach scans the deeper match ledger
      And week-level warnings and informational signals must be visible without opening every match

    Scenario: Match queue shows weekly floating movement across saved work
      Given one or more weeks contain saved draft or finalized selections
      When the coach opens the match queue overview
      Then each week summary must show floating players used in each match
      And the floating summary must include both draft and finalized selections
      And the week summary must remain visible alongside the existing week-coverage information
      And the coach must be able to scan week-level selection movement without opening every match

    Scenario: Coach can open an editable week board
      Given one or more registered matches exist in the same calendar week
      When the coach opens the week overview for that week
      Then the app must show that week's matches as separate columns or lanes
      And the coach must be able to review each match's current selection status in that week overview
      And the coach must be able to adjust player selection from that week overview
      And the week overview must exist in addition to the match queue overview

    Scenario: Coach desk highlights fairness deviations inside each team
      Given saved draft or finalized selections exist across one or more teams
      When the coach opens the landing page
      Then the coach desk must clearly identify any player with fewer saved match involvements than another player in the same core team
      And the comparison must count core, support, development, and other floating appearances together
      And players marked as allowed to drop a core match may be excluded from the fairness warning list
      And the desk must keep the affected team visible without requiring the coach to open history first

    Scenario: App navigation keeps the operating loop visible
      Given the coach is moving between pages in the app
      When the navigation is shown
      Then the app must keep the main operating loop visible
      And the current page must still be easy to identify within that loop
      And the loop must stay inside the viewport without horizontal overflow

  Rule: Team registry

    Scenario: Coach can create a team
      When the coach creates a team with a name
      Then the team must be available for player core-team assignment
      And the team must be available when creating a match

    Scenario: Coach can create a team from a layover flow
      When the coach starts team creation from the team registry
      Then the team form should open as a layover flow
      And the coach should stay in the team-registry context

    Scenario: Coach can set a minimum support requirement for a team
      Given a team exists in the team registry
      When the coach records a minimum support requirement for that team
      Then the team must store that minimum support amount
      And the amount must be available to the selection engine for future matches

    Scenario: Coach can set a development-slot amount for a team
      Given a team exists in the team registry
      When the coach records a development-slot amount for that team
      Then the team must store that development-slot amount
      And the amount must be available to the selection engine for future matches

    Scenario: Coach can restrict which teams may supply support to a team
      Given teams exist in the team registry
      When the coach records which teams are allowed to supply support for a target team
      Then the target team must store that allowed support-team list
      And the selection engine must use only those support-team relationships for support coverage

    Scenario: Coach can remove an unused team
      Given a team exists in the team registry
      And the team is not referenced by any active player, active float permission, support-team relationship, development-team relationship, or match
      When the coach removes the team
      Then the team must be removed from the team registry
      And the team must no longer be available for new player assignments
      And the team must no longer be available for new match creation

    Scenario: Coach cannot remove a team that is still in use
      Given a team exists in the team registry
      And the team is referenced by an active player, float permission, support-team relationship, development-team relationship, or match
      When the coach removes the team
      Then the app must block the removal
      And the app must explain that existing references must be cleared first

    Scenario: Player core team must come from the team registry
      Given a player exists in the player registry
      When I inspect the player's core team assignment
      Then the player must be assigned to exactly one team from the team registry
      And the player must not belong to more than one core team

  Rule: Player registry and identity

    Scenario: Coach can create a player from a layover flow
      When the coach starts player creation from the player registry
      Then the player form should open as a layover flow
      And the coach should stay in the player-registry context

    Scenario: Player has an individual detail page
      Given a player exists in the player registry
      When the coach opens the player's page
      Then the app must show that player's full profile on an individual player page
      And the coach must be able to review and edit the player's stored details there

    Scenario: Player detail page shows current match involvement at a glance
      Given a player exists in the player registry
      And the player is involved in one or more saved draft or finalized selections
      When the coach opens the player's page
      Then the page must show a compact overview of that player's match involvement
      And the overview must include both draft and finalized selections
      And the coach must be able to tell quickly which matches are still drafts and which are finalized
      And the overview must list every saved involved match rather than a fixed preview count

    Scenario: Player code is generated automatically
      When the coach creates a player
      Then the system must populate a player code automatically
      And the player code must be stored as a backend reference identifier
      And the code must not be derived from the player's current core team

    Scenario: Player code does not need to be shown in normal UI flows
      Given a player exists in the player registry
      When the coach uses the normal app interface
      Then the app does not need to present the player code in normal UI flows
      And the player code must still remain available for backend reference

    Scenario: Coach can remove a player from the app
      Given a player exists in the player registry
      When the coach removes the player
      Then the player must no longer appear in the active player registry
      And the player must not be available for future match selection

    Scenario: Coach can remove a player directly from the player registry overview
      Given a player exists in the player registry
      When the coach removes the player from the player-registry overview
      Then the player must no longer appear in the active player registry
      And the player must not be available for future match selection

  Rule: Structured player profile

    Scenario: Player profile can store an individual development-match limit
      Given a player exists in the player registry
      When the coach records a maximum allowed development-match amount for that player
      Then the player must store that individual development-match limit
      And the selection engine must use that player-specific limit when considering development selection

    Scenario: Player positions are stored in separate ordered fields
      Given a player exists in the player registry
      When the coach records the player's positions
      Then the player must have a primary position field
      And the player may have a secondary position field
      And the player may have a tertiary position field
      And each position field must store at most one position
      And the app must not require multiple positions to be packed into one field

    Scenario: Player positions must come from the supported football position list
      Given a player exists in the player registry
      When the coach records the player's positions
      Then primary position must be one of "GK", "CB", "CM", "W", or "ST"
      And secondary position must be "None" or one of "GK", "CB", "CM", "W", or "ST"
      And tertiary position must be "None" or one of "GK", "CB", "CM", "W", or "ST"
      And the player form must offer those positions as dropdown choices

    Scenario: Coach can clear optional player positions back to None
      Given a player exists in the player registry
      And the player already has a secondary or tertiary position recorded
      When the coach changes secondary position or tertiary position to "None"
      Then the app must save that field as empty
      And the player profile must show that no optional position is recorded for that field

    Scenario: Player profile stores footedness and best side
      Given a player exists in the player registry
      When the coach records footedness and side preference
      Then preferred foot must be one of "Left" or "Right"
      And secondary foot must be one of "Left", "Right", or "Weak"
      And best side must be one of "Left", "Center", or "Right"

    Scenario Outline: Player has a current availability status
      Given a player exists in the player registry
      When the coach records availability as "<status>"
      Then the player's current availability must be stored as "<status>"

      Examples:
        | status    |
        | Available |
        | Injured   |
        | Sick      |
        | Away      |

    Scenario: Player profile stores detailed attribute ratings
      Given a player exists in the player registry
      When the coach records player attributes
      Then the profile must store technical attributes for "Ball Control", "Passing", "First Touch", and "1v1 Attacking"
      And the profile must store tactical attributes for "Positioning", "1v1 Defending", and "Decision Making"
      And the profile must store mental attributes for "Effort", "Teamplay", and "Concentration"
      And the profile must store physical attributes for "Speed" and "Strength"

    Scenario: Player attribute ratings use a one-to-five scale
      Given a player exists in the player registry
      When the coach records player attributes
      Then every tracked player attribute must be a whole number between 1 and 5
      And the player form must block values outside that range

    Scenario: Player profile derives category averages
      Given a player has recorded attribute ratings in every category
      When the player profile is viewed or evaluated
      Then the profile must provide a technical average
      And the profile must provide a tactical average
      And the profile must provide a mental average
      And the profile must provide a physical average

    Scenario: Player profile derives an overall average
      Given a player has recorded attribute ratings across all tracked attributes
      When the player profile is viewed or evaluated
      Then the profile must provide one overall average across all tracked attributes

    Scenario: Player detail page visualizes overall rating with stars
      Given a player has recorded attribute ratings across all tracked attributes
      When the player detail page is viewed
      Then the page must show the overall average as a star rating on a one-to-five scale

    Scenario: Coach can move to the next player from the player detail page
      Given multiple active players exist in the player registry
      When the coach opens one player's detail page
      Then the page must provide a way to move to the next player record without returning to the registry

    Scenario: Player registry rows can open player detail directly
      Given players exist in the player registry
      When the coach clicks a player row or primary player cell in the registry
      Then the app must open that player's detail page without requiring a separate open button

  Rule: Floating permissions and team eligibility

    Scenario: Non-floating player is only eligible for own core team
      Given a player has a core team
      And the player is marked as not floating
      When the selection engine evaluates eligibility for a match
      Then the player must only be eligible for matches for the player's own core team

    Scenario: Floating player is eligible for explicitly allowed teams
      Given a player has a core team
      And the player is marked as floating
      And one or more allowed float teams are recorded for that player
      When the selection engine evaluates eligibility for a match
      Then the player must be eligible for matches for the player's own core team
      And the player must be eligible for matches for each explicitly allowed float team

    Scenario: Floating player is blocked from teams outside the allowed float list
      Given a player has a core team
      And the player is marked as floating
      And one or more allowed float teams are recorded for that player
      When the selection engine evaluates eligibility for a match for a team outside that allowed list
      Then the player must not be eligible for that match
      And the player must not be auto-selected for that team

    Scenario: Floating behavior is explicit and not inferred as up or down
      Given a player has a core team
      And the player is marked as floating
      And one or more allowed float teams are recorded for that player
      When the selection engine evaluates eligibility
      Then the backend must treat floating as explicit team eligibility only
      And the backend must not require an "up" or "down" floating direction

  Rule: Development source configuration

    Scenario: Coach can restrict which teams may supply development players to a team
      Given teams exist in the team registry
      When the coach records which teams are allowed to supply development players for a target team
      Then the target team must store that allowed development-team list
      And the selection engine must use that list together with player floating permissions when filling development slots

  Rule: Availability rules

    Scenario: Available player can be considered
      Given a player has current availability status "Available"
      When a match selection is generated
      Then the player may be included if all other eligibility rules are satisfied

    Scenario Outline: Unavailable player is excluded
      Given a player has current availability status "<status>"
      When a match selection is generated
      Then the player must not be auto-selected
      And the player must not appear as eligible for that match

      Examples:
        | status  |
        | Injured |
        | Sick    |
        | Away    |

  Rule: Core-team participation exceptions

    Scenario: Player may be marked to drop one core-team match
      Given a player belongs to a core team
      And the player is marked as allowed to drop one core-team match
      And no previous dropped core-team match has been recorded for the player
      When the selection engine evaluates a later eligible core-team match
      Then the player may be excluded because of the core-match-drop rule
      And the exclusion must be stored in history

    Scenario: Player not marked for drop must remain eligible for all core-team matches
      Given a player belongs to a core team
      And the player is not marked as allowed to drop one core-team match
      When the selection engine evaluates an eligible core-team match
      Then the player must be treated as eligible for that match unless other exclusion rules apply

    Scenario: Dropped core-team match must not exceed one per marked player
      Given a player is marked as allowed to drop one core-team match
      And one dropped eligible core-team match has already been recorded for the player
      When a later core-team match is evaluated
      Then the player must not be dropped again only because of the core-match-drop rule

    Scenario: Floating-capable core player may be held out when another same-week match can use that player
      Given a player belongs to a core team
      And the player is marked as floating
      And the player is not marked as allowed to drop one core-team match
      And the player has an allowed floating opportunity in another registered match during the same calendar week
      When the coach generates a selection for the player's own core-team match
      Then the player may be deprioritized for the core-team squad when core-player slots are limited
      And the engine must explain that the player is being preserved for a same-week floating opportunity

    Scenario: Missed core-team player gets same-week floating priority
      Given a player belongs to a core team
      And the player is marked as floating
      And the player is not marked as allowed to drop one core-team match
      And the player was left out of the player's own core-team selection earlier in the same calendar week
      When the coach generates a later match for one of that player's allowed float teams in the same calendar week
      Then that player should receive better floating priority than otherwise comparable candidates
      And the explanation must state that the player is being prioritized after missing the core-team match that week

    Scenario: Drop-one-match player does not require a compensating float match
      Given a player is marked as allowed to drop one core-team match
      When the player is left out of a core-team selection
      Then the engine must not require a compensating floating selection in the same week

    Scenario: Drop-one-match marking does not force a dropped match
      Given a player belongs to a core team
      And the player is marked as allowed to drop one core-team match
      When the coach generates a selection for the player's own core-team match
      Then the player may still be selected for that match
      And the marker must only permit exclusion when higher-priority support or development coverage needs the slot

  Rule: Squad sizing

    Scenario: Suggested squad should use the configured target size
      Given a match exists for a team from the team registry
      And a target squad size is configured for that match context
      When the coach generates a selection for that match
      Then the suggested selection should target that configured squad size

    Scenario: Final squad must not exceed the configured maximum size
      Given a match exists for a team from the team registry
      And a maximum squad size is configured for that match context
      When the coach generates or finalizes a selection for that match
      Then no more than that maximum number of players may be included in the final selection

    Scenario: Team support requirement reserves support-player slots
      Given a match exists for a team from the team registry
      And that team has a minimum support requirement greater than 0
      When the coach generates a selection for that match
      Then the suggested selection should reserve at least that many slots for eligible floating players when possible
      And the remaining slots may be filled by eligible core players

    Scenario: Team support must come from configured support teams only
      Given a match exists for a team from the team registry
      And that team has one or more configured support teams
      When the coach generates a selection for that match
      Then support slots must be filled only by eligible players whose core team is on that support-team list
      And eligible floating players from other teams must not satisfy the support requirement

    Scenario: Support players are prioritized before core-match-drop players
      Given a match exists for a team from the team registry
      And that team has a minimum support requirement greater than 0
      And eligible support players exist
      And one or more core players are marked as allowed to drop one core-team match
      When the coach generates a selection for that match
      Then the engine must prioritize satisfying the support requirement before relying on own-team players who are marked as allowed to drop a core match

    Scenario: Development slots are prioritized before own core-team coverage when matches are close together
      Given a match exists for a team from the team registry
      And that team has a development-slot amount greater than 0
      And that team has one or more configured development source teams
      And eligible development players exist from those teams
      And close-date own-team and development opportunities compete for the same player window
      When the coach generates a selection for that match
      Then the engine must prioritize development slots before own core-team coverage
      And the explanation must state that development priority was applied because of date proximity

    Scenario: Development slots reserve team capacity before floating core coverage
      Given a match exists for a team from the team registry
      And that team has a development-slot amount greater than 0
      And eligible development players exist from configured development source teams
      When the coach generates a selection for that match
      Then the suggested selection should reserve that many development slots when possible
      And those development slots must be prioritized after support slots and before own core-team coverage

    Scenario: Individual development-match limit blocks additional development selection
      Given a player belongs to a configured development source team
      And the player has an individual development-match limit
      And the player has already reached that amount in finalized development history
      When the coach generates a selection for a target team that could use that player in a development slot
      Then the player must not be auto-selected into another development slot
      And the exclusion must explain that the player's development-match limit has been reached

    Scenario: Support, development, then core order is used when squad capacity is contested
      Given a match exists for a team from the team registry
      And eligible support players exist
      And eligible development players exist
      And eligible own-team core players exist
      When the coach generates a selection for that match
      Then the engine must prioritize support players first
      And the engine must prioritize development slots second
      And the engine must prioritize own-team core coverage after those reserved slots

    Scenario: Team support shortfall should be reported clearly
      Given a match exists for a team from the team registry
      And that team has a minimum support requirement greater than 0
      And fewer eligible floating players exist than the configured support amount
      When the coach generates a selection for that match
      Then the app must still generate the best available squad
      And the generated result must include a warning that the support requirement could not be fully satisfied
      And the warning must explain which support sources were configured
      And the warning must explain why additional support players were not eligible or available

    Scenario: Support shortfall warning is shown early on match details
      Given a generated or saved selection exists for a match
      And that match's team has a minimum support requirement greater than 0
      And the current selection fills fewer support slots than required
      When the coach reviews the match selection screen
      Then the app must show an early warning before the detailed selection tables
      And the warning must clearly state how many support slots are still missing
      And the warning must show which support teams are configured for that match

    Scenario: Extra support players may be selected when indirect support pressure requires it
      Given a match exists for a team from the team registry
      And that team has a minimum support requirement greater than 0
      And direct support players are selected into those reserved support slots
      And one or more of those support-source teams also have support obligations in other registered matches
      When the coach generates selections for those related matches
      Then the engine may select more than the minimum number of support players from an upstream support team
      And the explanation must state that the additional support player was needed to keep downstream support coverage intact

    Scenario: Chained support priority follows the support path before upstream backfill
      Given "Blå" is configured to support "Hvit"
      And "Hvit" is configured to support "Rød"
      And a "Rød" match requires at least 3 support players
      And eligible floating "Hvit" core players exist for "Rød"
      And eligible floating "Blå" core players exist for "Hvit"
      When the coach generates selections for the related matches
      Then the "Rød" support slots must prioritize eligible "Hvit" core players before any indirect upstream backfill
      And if those "Hvit" players are used to support "Rød", the engine must select enough eligible "Blå" support players to cover "Hvit"
      And that may require selecting more than "Hvit"'s own minimum direct support amount

    Scenario: Match selection screen highlights omitted core-team players early
      Given a generated or saved selection exists for a match
      When the coach reviews the match selection screen
      Then the app must show which target-team core players are not currently picked
      And each omitted core player must show the current reason for omission in a dedicated early-visibility section

    Scenario: Match selection screen shows week-level player coverage signals early
      Given one or more matches exist in the same calendar week as the current match
      And generated or saved selection data exists for that week
      When the coach reviews the match selection screen
      Then the app must show an early week-level section before the detailed selection tables
      And the section must show one readable column or lane per match in that week
      And the section must identify active available players who are not currently included in any match that week
      And each uncovered player must show whether the state is a warning or informational

    Scenario: Match selection screen marks fully finalized weeks clearly
      Given one or more matches exist in the same calendar week as the current match
      When the coach reviews the week workflow section
      Then the app must clearly show whether that week is fully finalized
      And a week must count as fully finalized only when every match in that week is finalized
      And partially finalized weeks must remain visibly in progress

    Scenario: Weekly uncovered player without core-match-drop permission is warned early
      Given an active available player is not included in any current saved or generated match selection in that calendar week
      And the player is not marked as allowed to drop one core-team match
      When the coach reviews the week-level coverage section
      Then that player must appear as a warning
      And the warning must be visible before the detailed player tables

    Scenario: Weekly uncovered player with core-match-drop permission is informational
      Given an active available player is not included in any current saved or generated match selection in that calendar week
      And the player is marked as allowed to drop one core-team match
      When the coach reviews the week-level coverage section
      Then that player must still be shown clearly
      And the state may be informational instead of warning
      And the app must explain that one dropped core-team match is allowed for that player

    Scenario: Saved core omissions without manual removal rows still explain the omission
      Given a saved selection exists for a match
      And one or more target-team core players are omitted without a saved manual-removal row
      When the coach reviews the "Current Saved Core Omissions" section
      Then each omitted core player must still show a concrete omission explanation
      And the app must not fall back to an undefined placeholder explanation

    Scenario: Unfilled squad slots must explain why automatic filling stopped
      Given a generated selection exists for a match
      And one or more squad slots remain unfilled
      When the coach reviews the generated result
      Then the warnings must state that the squad is short
      And the warnings must explain why the remaining slots could not be filled automatically
      And the warnings must distinguish between support shortfall, development shortfall, and general eligibility shortage when applicable

  Rule: Positional balance in floating selection

    Scenario: Floating selection should preserve positional balance
      Given a match exists
      And eligible floating players are being considered
      When the coach generates a selection for that match
      Then the engine should consider player positions before choosing who floats
      And the engine should avoid overloading the squad with too many players in the same position

    Scenario: Position priority should respect ordered position fields
      Given two floating candidates are otherwise equally eligible
      And one candidate fills an underrepresented primary, secondary, or tertiary position in the target squad
      When candidate priority is evaluated
      Then the positionally needed player should receive better priority than the other candidate

  Rule: Match date spacing and overlap rules

    Scenario: Player cannot play both floating match and core match within two days
      Given a player is selected as a floating player for one match
      And the player's own core-team match is scheduled within 0 to 2 days of that match
      When both matches are finalized
      Then the player must only be selected for the floating match
      And the player must not be selected for the core-team match

    Scenario: Player may play both matches if interval is at least three days
      Given a player is selected as a floating player for one match
      And the player's own core-team match is scheduled 3 or more days later
      When both matches are evaluated
      Then the player may be selected for both matches if all other rules are satisfied

    Scenario: Overlapping match dates must not share players
      Given two matches overlap in date and time
      When the coach generates or finalizes selections for those matches
      Then the same player must not be included in both finalized selections

    Scenario: Same-day fixtures must not share players when dual participation is impossible
      Given two matches are scheduled on the same date
      And the schedule makes dual participation impossible
      When the coach generates or finalizes selections for those matches
      Then the same player must not be included in both finalized selections

  Rule: Single-match generation and persistence

    Scenario: Coach can create one match and generate one suggested selection
      Given no future matches need to exist in advance
      When the coach creates a match with date, team, opponent, home-or-away status, and match type
      And the coach runs the selection engine
      Then the system should generate a suggested squad for that match only

    Scenario: Coach can create a match from a layover flow
      When the coach starts match creation from the match overview
      Then the match form should open as a layover flow
      And the coach should stay in the match-overview context

    Scenario: Match stores whether it is home or away
      Given the coach is creating or editing a match
      When the coach records home-or-away status
      Then the match must store either "Home" or "Away"
      And the match detail, match overview, and exports must show that status

    Scenario: Match type must come from the supported match-type list
      Given the coach is creating or editing a match
      Then match type must be chosen from "League", "Friendly", or "Cup"
      And the match form must offer those match types as a dropdown

    Scenario: Coach can remove a match
      Given a match exists
      When the coach removes the match
      Then the match must be removed from the schedule
      And the match must no longer be available from the match list or selection workspace
      And any saved selection records for that match must be removed with it

    Scenario: Selection result contains required information
      Given a suggested selection exists for a match
      Then the result must include Match ID
      And the result must include Match Date
      And the result must include Team
      And the result must include Opponent
      And the result must include Player ID
      And the result must include Player Name
      And the result must include Core Team
      And the result must include Primary Position
      And the result may include Secondary Position
      And the result may include Tertiary Position
      And the result must include Eligibility
      And the result must include Selection Reason
      And the result must include Selection Category
      And the result must include Priority Score
      And the result must include Auto Selected
      And the result must include Manual Override
      And the result must include Final Selected
      And the result must include Core Match Drop Allowed

    Scenario: Coach can turn the current suggestion into a draft selection
      Given a suggested selection exists for a match
      When the coach accepts the suggestion as a draft
      Then the app must save the suggested squad as the current draft selection for that match
      And the coach must still be able to adjust the saved draft manually before finalizing

    Scenario: Finalized selection is saved as history
      Given a suggested selection exists for a match
      When the coach finalizes the selection
      Then the finalized selection must be stored in match history
      And future selection runs must use that history when evaluating players

    Scenario: Coach can finalize all ready matches from the match overview
      Given one or more registered matches exist without a finalized selection
      When the coach finalizes all ready matches from the match overview
      Then the app must finalize every currently non-finalized match whose selection fills every squad slot
      And any non-finalized match with unfilled slots must remain non-finalized
      And the overview must show a warning that explains which matches need attention and why they were not finalized

    Scenario: Batch work from the overview is performed week by week
      Given registered matches exist in more than one calendar week
      When the coach uses bulk actions from the match overview
      Then the overview must present those actions within weekly workflow groups
      And the coach must not need to treat the whole fixture list as one undifferentiated batch
      And the UI must keep the currently active week readable while deeper weeks stay secondary

    Scenario: Match overview shows current saved-selection state
      Given matches exist in the match overview
      When the coach reviews the match list
      Then each match must show whether it currently has no saved selection, a draft selection, or a finalized selection

    Scenario: Match overview shows calendar week numbers
      Given matches exist in the match overview
      When the coach reviews the match list
      Then each match must show the match date's calendar week number
      And the week number must be visible without opening the match detail page

    Scenario: Match overview marks finalized weeks clearly
      Given matches exist in the match overview
      When the coach reviews the weekly grouping
      Then each calendar week must show whether it is fully finalized or still in progress
      And a week must only be marked finalized when all matches in that week are finalized

    Scenario: Match overview rows can open selection detail directly
      Given matches exist in the match overview
      When the coach clicks a match row or primary match cell in the overview
      Then the app must open that match's detail and selection page without requiring a separate view button

    Scenario: Coach can recalculate draft selections for registered matches
      Given one or more registered matches exist without a finalized selection
      When the coach recalculates all draft-eligible matches or a marked subset of them
      Then the app must generate new draft selections for those matches using the current rules
      And each recalculated match must evaluate against every other registered match in the app
      And those other registered matches must include both saved draft and finalized selections
      And finalized selections must remain unchanged

    Scenario: Coach can recalculate all current draft matches across all weeks
      Given draft-eligible matches exist in more than one calendar week
      When the coach recalculates every current draft match from the match overview
      Then the app must run one full draft recalculation pass across all weeks
      And each recalculated match must evaluate against every other registered match in the app
      And finalized selections must remain unchanged

    Scenario: Coach can recalculate a single match from match detail
      Given a registered match exists without a finalized selection
      When the coach recalculates that match from its detail page
      Then the app must generate a new draft selection for that match using the current rules
      And that recalculation must still evaluate against every other registered match in the app
      And those other registered matches must include both saved draft and finalized selections
      And finalized selections must remain unchanged

    Scenario: Saving manual draft changes recalculates all draft matches
      Given one or more registered matches exist without a finalized selection
      And at least one match has saved manual draft changes
      When the coach saves manual changes on a match
      Then the app must recalculate all current draft matches using the latest saved state
      And each recalculated match must evaluate against every other registered match in the app
      And finalized selections must remain unchanged

    Scenario: Manual draft additions and removals are non-negotiable during recalculation
      Given a draft selection contains manually added players or manually removed players
      When the app recalculates draft matches
      Then those manual additions and removals must be treated as locked inputs for that match
      And the automatic selection engine must adapt the remaining draft matches around those locked inputs
      And the recalculated draft for that match must preserve the manual additions and removals

    Scenario: Match detail shows assistant suggestions before deeper tables
      Given the coach opens a match selection detail page
      When the page loads
      Then the app must show assistant suggestions before the detailed selection tables
      And each suggestion must explain the proposed action in plain language
      And the coach must be able to apply or ignore the suggestion from that workflow surface

    Scenario: Coach can mark all saved selections as draft from the match overview
      Given one or more registered matches already have a saved selection
      When the coach marks all saved selections as draft from the match overview
      Then every match with a saved selection must end with a latest saved status of draft
      And the latest draft must preserve the latest saved player rows and override note for each affected match
      And matches without any saved selection must remain unchanged

    Scenario: Coach can browse to previous and next matches from match detail
      Given multiple matches exist in the match registry ordering
      When the coach opens one match's detail page
      Then the page must provide a way to move to the previous match record
      And the page must provide a way to move to the next match record

    Scenario: Coach can export finalized match selections for human review
      Given one or more finalized match selections exist
      When the coach exports finalized match selections
      Then the export must include match date, target team, opponent, home-or-away status, and selected player names
      And the export must be readable for humans without requiring automation

    Scenario: Coach can choose between multiple human-readable export formats
      Given one or more finalized match selections exist
      When the coach exports finalized match selections
      Then the app must offer at least two human-readable export format options
      And each option must present the same finalized selection facts in a format meant for manual review

  Rule: Core and floating selection logic

    Scenario: Core players fill own team first
      Given a player belongs to a core team
      And the player is not floating
      When a match exists for that same core team
      And the coach generates a selection for that match
      Then the player should be treated as a core candidate for that match
      And core candidates should be prioritized before floating candidates unless team-size or spacing rules block them

    Scenario: Floating player may be considered for an allowed team
      Given a player belongs to a core team
      And the player is floating
      And a team is listed in that player's allowed float teams
      When a match exists for that allowed team
      And the coach generates a selection for that match
      Then the player may be considered as a floating candidate for that team
      And the player's position and match-date spacing must be considered before inclusion

    Scenario: Support coverage is prioritized over own core-team priority
      Given a player belongs to a team that is configured as a support team for another team
      And the player is eligible to float to that supported team
      And the supported team has unmet required support slots
      When close-date match opportunities compete for selection priority
      Then the engine must prioritize the supported team's minimum support need before the player's own core-team preference
      And the explanation must state that support priority overrode own-team preference

    Scenario: Player blocked from a non-allowed team
      Given a player belongs to a core team
      And the player is floating
      And a team is not listed in that player's allowed float teams
      When a match exists for that non-allowed team
      And the coach generates a selection for that match
      Then the player must not be eligible
      And the player must not be auto-selected

    Scenario: Auto selection must account for other registered matches
      Given multiple registered matches exist
      And one or more of those matches already has a saved draft or finalized selection
      When the coach generates or recalculates a selection for another match
      Then the engine must take the other registered matches into account
      And the engine must do that even when only one match is being recalculated
      And the engine must avoid planning the same player into conflicting registered matches

    Scenario: Unselected locked core players are warned early
      Given a player belongs to the target team's core team
      And the player is not floating
      And the player is not marked as allowed to drop one core-team match
      And the player is not selected for that match
      When the coach views the generated or saved selection interface
      Then the app must show an early warning about that player
      And the warning must explain why the player was not selected

    Scenario: Incomplete auto selection is warned early with reasons
      Given a match exists
      And auto selection cannot fill every squad slot
      When the coach views the generated or saved selection interface
      Then the app must show an early warning that the squad is incomplete
      And the warning must explain why the missing slot or slots could not be filled

  Rule: Rules overview

    Scenario: Fixed core-team priority is not exposed as an editable rule
      Given the coach opens the rules overview
      When the coach reviews the editable RuleConfig controls
      Then the app must not show a toggle for whether core players should be enforced for their own team
      And the app must treat core-team-first behavior as fixed feature logic unless another higher-priority rule blocks it

  Rule: Floating history and fairness

    Scenario: Player cannot float in consecutive floating opportunities
      Given a player was included as a floating player in the most recent eligible floating opportunity
      When a later match is generated for the same target team context
      Then the player must not be selected again as a floating player if another valid floating option exists

    Scenario: Support player must return to own core team before another support match
      Given a player belongs to a support-source core team
      And the player was selected into a support slot for another team in the player's most recent registered or finalized match
      And the player has not played for the player's own core team since that support match
      When the coach generates another match that could use the player in a support slot
      Then the player must not be auto-selected into another support slot
      And the exclusion must explain that the player must play an own core-team match before another support assignment

    Scenario: Development player must return to own core team before another development match
      Given a player belongs to a development-source core team
      And the player was selected into a development slot for another team in the player's most recent registered or finalized match
      And the player has not played for the player's own core team since that development match
      When the coach generates another match that could use the player in a development slot
      Then the player must not be auto-selected into another development slot
      And the exclusion must explain that the player must play an own core-team match before another development assignment

    Scenario: No replacement means the slot stays empty instead of reusing the same source player consecutively
      Given a target team has a required support or development slot
      And only one eligible player exists from a particular source team for that slot type
      And that player already filled that slot type in the player's most recent registered or finalized match
      And the player has not played for the player's own core team since then
      When the coach generates the next match for that target team
      Then the engine must leave that support or development slot unfilled instead of reusing the same player consecutively
      And the warning must explain that the source team had no rotation-safe player available

    Scenario: Floating history contributes to future priority
      Given two floating candidates are otherwise equally eligible
      And one player has fewer total floating appearances in finalized history
      When the engine scores floating candidates
      Then the player with fewer floating appearances should receive better priority

    Scenario: History overview highlights recent movement between teams
      Given finalized history contains players who have recently floated, supported, or filled development slots for another team
      When the coach reviews the history overview
      Then the app must show which players most recently moved between teams
      And the overview must show where each visible movement went
      And the overview must show the saved explanation for the latest visible movement without requiring the player detail page

    Scenario: History overview provides a dedicated movement overview across saved work
      Given saved draft or finalized selections contain floating, support, or development movement
      When the coach reviews the history overview
      Then the app must show a separate movement overview in addition to the main history table
      And the movement overview must show movement counts per player
      And the movement overview must list the related matches and calendar weeks for each visible movement
      And the movement overview must show whether each visible movement comes from a draft or a finalized selection

  Rule: Manual override handling

    Scenario: Coach may adjust an automatically generated selection
      Given a suggested selection exists for a match
      When the coach manually adds or removes a player
      Then the final selection must reflect the manual decision
      And the manual change must be marked as an override

    Scenario: Manual override must not erase audit information
      Given a suggested selection exists for a match
      When the coach manually changes the selection before finalizing
      Then the original automatic recommendation must remain traceable
      And the final saved selection must record that a manual override occurred

  Rule: Sortable operational tables

    Scenario: Coach can sort the player registry
      Given players exist in the player registry
      When the coach sorts the player registry by player, core team, availability, floating, or status
      Then the registry must reorder by the selected column

    Scenario: Coach can sort operational tables across the app
      Given tabular overview data exists in the app
      When the coach sorts a supported table column on a page such as matches, teams, history, or selection review
      Then the table must reorder by the selected column
