# Matchboard Domain Model

## Purpose

Matchboard is a local-first web app for helping a coach manage youth football match selection, player rotation, and match history.

The app is built around one central job:

> Create one match, generate or assemble a squad for that match, finalize it, and store that decision as history so future match selections can take past selections into account.

This is not a full club system.
This is not a batch scheduling engine.
This is not a generic sports management platform.

It is a focused tool for:
- maintaining a player registry
- selecting squads one match at a time
- applying football-specific selection rules
- preserving selection history
- making future selection decisions based on that history

---

## Core Operating Model

The system works one match at a time.

The normal flow is:

1. The coach creates a match
2. The app loads players, rules, and historical selections
3. The app generates a suggested squad or supports manual selection
4. The coach reviews and optionally adjusts the squad
5. The final selection is saved
6. That finalized selection becomes part of history
7. Future selections use that history as input

This means the app is not primarily driven by a full season plan.
It is driven by a sequence of single match decisions with memory.

---

## Main Domain Concepts

## Player

A player is a durable record in the player registry.

A player has:
- identity fields such as name and code
- a core team
- active or inactive status
- floating permissions
- positions
- optional notes

A player is not just a name in a squad.
A player is a tracked entity whose past selections matter.

### Important player concepts

#### Core team
A player's core team is the team they normally belong to.

Example:
- a player may belong to `HVIT` as their core team

Core team matters because:
- core players should normally be selected for their own team
- floating should not replace the basic idea that players belong somewhere first

#### Active
A player can be active or inactive.

Inactive players should not be considered for selection.

#### Floating permissions
A player may be allowed to float:
- up
- down
- both
- neither

Floating means the player can be selected for another team than their core team when rules allow it.

Floating is controlled.
It is not free movement.

#### Positions
A player may have:
- preferred positions
- secondary positions

Positions matter because squad selection should avoid obviously poor balance, such as too many players of the same type.

---

## Team

A team is a registry record used by players, matches, and floating permissions.

The current coaching context often uses teams such as:

- `BLA`
- `HVIT`
- `ROD`

These names matter in local usage, but the app should treat teams as maintained registry data,
not as hardcoded built-ins.

A team may also store a minimum support amount.

This means:
- a weaker team can declare that it normally needs a minimum number of supporting players
- that support amount is a team-level input to squad generation
- the selection engine should try to satisfy it with eligible floating players before using every slot on core players

### Team relationship assumptions

These assumptions matter in the current domain:

- players belong to one core team
- floating is controlled between teams
- some teams may require minimum support from outside their core squad
- support still depends on explicit player eligibility, not on free movement

The app should not assume free movement between all teams unless the rules explicitly allow it.

---

## Match

A match is a single event for which a squad is selected.

A match has fields such as:
- date
- target team
- opponent
- squad size
- match type
- notes

A match does not need to exist far in advance.
The coach may create a match only when needed.

A match may also be removed when it is no longer needed.
If it is removed, the linked saved selection records disappear with it because those records belong to that specific match.

This is important:
the app should support on-demand match creation and one-match-at-a-time selection.

---

## Match Selection

A match selection is the squad decision for one specific match.

A match selection has:
- a parent match
- a status such as draft or final
- selected players
- explanations
- optional override notes

A match selection is not only an output.
It is also a historical event.

Once finalized, it becomes part of the historical ledger used for future selections.

---

## Match Selection Player

This is the record of one player being included in one match selection.

It should capture:
- which player was selected
- for which selection
- what kind of role they had
- whether they were auto-selected or manually added
- explanation or reason

This is one of the most important records in the system.

It allows the app to answer questions like:
- how many times has this player floated up
- when did this player last play
- was this player selected automatically or manually
- why was this player included

---

## Rule Configuration

Rule configuration stores editable selection policy.

This is where thresholds and toggles live, such as:
- maximum total floating matches
- whether consecutive floating is allowed
- minimum days between matches
- support requirements for `ROD`
- preference for position balance

Rule configuration is not the behavior contract.
It is the editable policy input for the engine.

### Important separation

- Gherkin defines expected behavior
- RuleConfig stores editable rule values
- selection engine code interprets and applies the rules

The app should not treat Gherkin as runtime configuration.

---

## Finalized History

History is built from finalized match selections.

This is a core idea in Matchboard.

The app should not rely on hand-maintained counters when those counters can be derived from saved history.

History should be used to derive things like:
- total match appearances
- core team appearances
- floating up count
- floating down count
- recent workload
- days since last match
- recent selection pattern

This helps keep the system consistent and avoids stale summary fields.

---

## Manual Override

The coach must be able to override an automatically generated squad.

Manual override exists because:
- football context is sometimes situational
- the coach may know something not represented in the data
- the engine should support judgment, not replace it

When a manual override happens:
- the final selection should still be saved
- the override should be visible
- the historical record should remain coherent

The app should not hide that an override happened.

---

## Selection Engine

The selection engine is the backend logic that proposes a squad for one match.

The engine should:
1. load the current match
2. load relevant rules
3. load players
4. load historical selections
5. apply hard rules first
6. use softer preferences second
7. return both decisions and explanations

### Hard rules
Hard rules are non-negotiable constraints.

Examples:
- inactive players cannot be selected
- players cannot be selected if the required minimum day gap is violated
- core players must be selected for their own team if eligible
- minimum team support targets should reserve floating-player slots when enough eligible support players exist
- consecutive floating may be blocked
- overlapping selections may be blocked

### Soft preferences
Soft preferences guide ranking when multiple players are eligible.

Examples:
- prefer lower recent match load
- prefer fewer total floating appearances
- prefer better position balance

### Explanation requirement
The engine should return human-readable reasons.

The app should not behave like a black box.

For selected players, examples include:
- selected because core player for target team
- selected because team support coverage is required
- selected because lower recent load

For excluded players, examples include:
- excluded because inactive
- excluded because minimum day gap not met
- excluded because consecutive floating is not allowed

---

## Current Domain Constraints

The following constraints are part of the current shape of the domain:

- the app is local-first
- there is no authentication
- there is no multi-user model
- the app operates one match at a time
- real player data must stay local and out of the public repository
- the implementation should remain simple and explicit
- the app should not become a generic rule-builder platform

---

## Non-Goals

The following are not goals right now:

- full season planning
- batch generation of many matches at once
- full club administration
- attendance system for all training
- parent communication tooling
- federation integration
- generic sports scheduling engine
- advanced role/permission system
- cloud-first architecture

These things may exist later, but they are outside the first product shape.

---

## Expected First Product Shape

The first useful version of Matchboard should support:

1. maintain players
2. create one match
3. generate or manually assemble one squad
4. finalize and save that squad
5. use finalized history in later selections
6. show simple human-readable explanations for decisions

That is enough for version one.

---

## Relationship Between Domain Documents

### `features/match-selection.feature`
Defines the behavior contract.
This is the main source of truth for expected outcomes.

### `docs/domain.md`
Defines the meaning of the concepts and the system shape.
This is the shared understanding document for humans and coding agents.

### Prisma schema and code
Implements the model and behavior in software.

These documents should support each other, not duplicate each other blindly.

---

## Design Principle

Matchboard should behave like a calm coaching control room.

It should be:
- clear
- explicit
- local-first
- operational
- traceable

It should not feel like:
- a spreadsheet with a web skin
- a generic enterprise admin panel
- a black box optimizer
- an over-abstracted framework experiment
