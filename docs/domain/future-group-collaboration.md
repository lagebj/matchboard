# Future Group Collaboration (Discovery — Not Implemented)

## Status

**Discovery only.** This document records a structured design exploration for a possible future
Matchboard capability. Nothing described here is implemented. No `GroupCollaboration` model,
invitation/request/approval workflow, cross-Group roster browsing, cross-Group evidence or
statistics attribution, cross-Group Player creation, cross-Group Player attribute access, Player
transfer mechanism, or collaboration notification exists in the codebase today. Do not build any
part of this without a new, explicit maintainer decision (an ADR that supersedes or extends
ADR-0106). This document exists so that decision, if it is ever made, starts from a considered
design rather than an unplanned one.

This document is written entirely in English. No Norwegian terminology is used anywhere in it,
per Matchboard's English-only rule. Where a cohort or source needs an example label, an arbitrary
code such as "G2016" is used — this is a cohort code, not football vocabulary, and is explicitly
permitted.

## Table of contents

1. [Purpose and scope](#1-purpose-and-scope)
2. [Relationship to the shipped GuestPlayer capability](#2-relationship-to-the-shipped-guestplayer-capability)
3. [Terminology](#3-terminology)
4. [The bilateral collaboration relationship](#4-the-bilateral-collaboration-relationship)
5. [GuestPlayer vs. a collaborating Player: the core distinction](#5-guestplayer-vs-a-collaborating-player-the-core-distinction)
6. [Why a real Player is different from a GuestPlayer in this context](#6-why-a-real-player-is-different-from-a-guestplayer-in-this-context)
7. [Actors and roles](#7-actors-and-roles)
8. [Permission model overview](#8-permission-model-overview)
9. [Privacy model overview](#9-privacy-model-overview)
10. [Collaboration relationship lifecycle](#10-collaboration-relationship-lifecycle)
11. [Player request workflow](#11-player-request-workflow)
12. [Approval workflow](#12-approval-workflow)
13. [Counter-suggestion workflow](#13-counter-suggestion-workflow)
14. [Partial-fulfilment workflow](#14-partial-fulfilment-workflow)
15. [Revocation and expiry](#15-revocation-and-expiry)
16. [Email notifications](#16-email-notifications)
17. [Audit trail requirements](#17-audit-trail-requirements)
18. [Statistics ownership boundary](#18-statistics-ownership-boundary)
19. [Evidence ownership boundary](#19-evidence-ownership-boundary)
20. [Attribute-mutation authority](#20-attribute-mutation-authority)
21. [Cohort-context evidence signal](#21-cohort-context-evidence-signal)
22. [Why the cohort-context signal is not a fixed multiplier](#22-why-the-cohort-context-signal-is-not-a-fixed-multiplier)
23. [Cross-Group roster browsing](#23-cross-group-roster-browsing)
24. [Cross-Group participant creation](#24-cross-group-participant-creation)
25. [Cross-Group authorization model](#25-cross-group-authorization-model)
26. [Cross-Group statistics attribution](#26-cross-group-statistics-attribution)
27. [Cross-Group evidence attribution](#27-cross-group-evidence-attribution)
28. [Historical integrity under revocation](#28-historical-integrity-under-revocation)
29. [Illustrative data model sketch](#29-illustrative-data-model-sketch)
30. [Extension points already in place](#30-extension-points-already-in-place)
31. [Reusable patterns from the shipped GuestPlayer work](#31-reusable-patterns-from-the-shipped-guestplayer-work)
32. [Security and tenancy considerations](#32-security-and-tenancy-considerations)
33. [Child-safety and language considerations](#33-child-safety-and-language-considerations)
34. [Explicit non-goals](#34-explicit-non-goals)
35. [Open questions and recommended first implementation slice](#35-open-questions-and-recommended-first-implementation-slice)

---

## 1. Purpose and scope

Matchboard's GuestPlayer capability (ADR-0106) covers one specific, narrow need: a coach fielding
an external player — someone not part of any Matchboard Group at all, or not worth tracking
long-term — for a single Event or League Round. It deliberately does not cover a different,
larger need that surfaced during that work: two Matchboard Groups that already both use
Matchboard, and want to lend each other real, tracked Players on a recurring basis (e.g. a
younger cohort borrowing a player from an older cohort within the same club, or two clubs with a
standing friendly relationship). This document explores what that second capability would need to
look like, without building it.

## 2. Relationship to the shipped GuestPlayer capability

GuestPlayer and Group collaboration solve adjacent but distinct problems:

| | GuestPlayer (shipped) | Group collaboration (discovery only) |
|---|---|---|
| Who is being added | An external identity, never tracked long-term | An existing, already-tracked Player belonging to another Group |
| Owned by | The Group that creates it | Remains owned by its original ("owning") Group throughout |
| Longitudinal statistics/evidence | Never accrues any | Accrues normally to the owning Group; the question this document explores is what, if anything, the borrowing Group sees |
| Identity lifecycle | Group-scoped, active/inactive, never Season-scoped | N/A — the Player identity is unchanged; only a participation *relationship* would be added |
| Relationship to the other Group | None — a GuestPlayer has no Group of its own to relate back to | Explicitly bilateral — two named Groups in an ongoing relationship |

A future implementation must not blur this line. GuestPlayer must remain the lightweight,
no-tracking option; Group collaboration, if built, is the heavier, identity-preserving option for
two Groups that already know and trust each other.

## 3. Terminology

English-only, per Matchboard's language rule. Do not introduce Norwegian terminology for any of
these concepts in UI text, code, schema, API names, documentation, tests, seed data, or comments.

| Term | Meaning |
|---|---|
| Owning Group | The Group a Player's core identity, statistics, and evidence belong to |
| Borrowing Group | The Group temporarily using another Group's Player for a Match or Round |
| Represented Group | The Group a player appears to represent in a specific planned context (usually the borrowing Group, for display purposes only — never a change of ownership) |
| Source Group | Used interchangeably with "owning Group" in some contexts; kept distinct in code from "owning Group" only if a future design needs to distinguish "who originated the relationship" from "who owns the Player" |
| Collaboration | The standing, bilateral relationship between two Groups that permits player lending |
| Collaboration request | A request from a borrowing Group to an owning Group's coach to use a specific Player for a specific context |
| Player request | Synonym for collaboration request, scoped to naming a specific Player rather than an open pool |
| Cohort-context evidence | A descriptive, non-scoring signal recording that a Player's evidence was generated while playing in an unusual (older or younger) cohort context |

## 4. The bilateral collaboration relationship

A collaboration would be a standing relationship between exactly two Groups (never
Organisation-wide, since Matchboard Groups are the unit of coaching identity and trust — see
AGENTS.md's Group model). Both Groups would need to exist in Matchboard, in the same Organisation
or, if cross-Organisation lending is ever wanted, across Organisations (a materially larger and
riskier scope — see §32). Within this document's scope, a collaboration is assumed
same-Organisation, Group-to-Group.

A collaboration relationship would need:
- An explicit creation step, initiated by one Group's coach and requiring the other Group's
  coach's affirmative acceptance (never automatic, never inferred from other actions).
- A direction-agnostic default: once established, either Group could request the other's players,
  unless the relationship is deliberately configured as one-directional.
- A single, visible status (e.g. active, paused, ended) — never silently dormant.

## 5. GuestPlayer vs. a collaborating Player: the core distinction

A collaborating Player is a real `Player` row, with its own core team, its own longitudinal
statistics, and its own development evidence — none of which is true of a GuestPlayer. Borrowing
that Player for a Match does not create a new identity; it creates a *participation record in a
context outside the Player's own Group*. Whatever data model results, it must never fork the
Player's identity, duplicate the Player row, or create a second writable source of truth for that
Player's attributes.

## 6. Why a real Player is different from a GuestPlayer in this context

A GuestPlayer's simplicity comes entirely from having no existing history to protect: nothing
about it needs reconciling with an owning Group's season fairness, evidence, or attribute ratings,
because none of that exists for it. A collaborating Player has all of that already, in a Group
that is not the one currently fielding them. Every design question in this document — who can see
what, who can mutate what, how statistics/evidence attribute — exists *because* the Player being
borrowed already has a real, protected identity elsewhere.

## 7. Actors and roles

- **Owning-Group coach** — the coach(es) with `GROUP_COACH` access to the Player's own Group.
  Retains authority over the Player's identity, attributes, and availability by default.
- **Borrowing-Group coach** — the coach(es) with `GROUP_COACH` access to the Group that wants to
  field the Player.
- **The Player's parent/guardian** — not a Matchboard actor today (Matchboard has no
  parent-facing accounts), but relevant to the privacy model in §9: parent-facing exports must
  never reveal cross-Group lending mechanics.

## 8. Permission model overview

A workable permission model would need at least:
- Only an owning-Group coach can approve a collaboration request naming one of their Players.
- A borrowing-Group coach can never directly add another Group's Player to their squad without
  that approval — mirroring the existing rule that `RotationPath` authorizes movement only within
  one Group's own teams (see AGENTS.md "RotationPath authority"); cross-Group movement has no
  equivalent authority today and would need its own, separate authorization primitive, never a
  reuse of `RotationPath` bent to cross a Group boundary it was never designed to cross.
- A borrowing-Group coach's visibility into the Player is bounded by what the collaboration grants
  — never full read access to the Player's owning-Group profile by default (see §9, §23).
- Ending a collaboration must not retroactively revoke access to already-recorded historical
  participation (see §28) — only future requests.

## 9. Privacy model overview

The existing Matchboard privacy boundary (coach-facing vs. parent-facing language, player-ID-only
storage in external/sanitized payloads — see AGENTS.md "Coach-facing vs parent-facing language")
would need to extend across the Group boundary too:
- A borrowing-Group coach should see only what is necessary to plan for and report on the
  borrowed Player's participation in their own context — not the Player's full owning-Group
  readiness signals, internal notes, or unrelated season history.
- The owning-Group coach should retain visibility into where and how their Player was used by the
  borrowing Group, at minimum at the level of context (Round, Match, Event) and outcome (played,
  not played) — full explanation-level detail is an open question (§35).
- Parent-facing exports must never expose that a Player was "borrowed" or "lent" — neutral
  existing terms (rotation, squad adjustment, match experience) would need to cover this
  transparently, exactly as they already do for in-Group movement.

## 10. Collaboration relationship lifecycle

A plausible state model: `PROPOSED → ACTIVE → (PAUSED ⇄ ACTIVE) → ENDED`. `PROPOSED` requires the
receiving Group's explicit acceptance before becoming `ACTIVE`. `PAUSED` would stop new requests
without ending the relationship's history. `ENDED` would be terminal but must never delete
historical participation records created while the relationship was active (§28).

## 11. Player request workflow

A borrowing-Group coach would request a specific Player (or, per an open question in §35,
possibly a pooled/open request against the owning Group's available players) for a specific
context — a Round, a Match, or an Event. The request would need to carry: the requesting Group,
the target Player or pool, the specific context, and a coach-facing reason (structured, matching
the existing override-reason-category pattern used elsewhere in Matchboard rather than free text
alone).

## 12. Approval workflow

The owning-Group coach reviews and either approves or declines. Approval should be scoped to
exactly what was requested — approving a Player for one Match must not implicitly grant use for
an entire Round or Event unless that was the scope of the original request.

## 13. Counter-suggestion workflow

An owning-Group coach might decline a specific Player request but suggest an alternative Player
from the same Group who is available. This is a genuine, distinct workflow step — not merely a
decline — and should preserve the original request's context so the borrowing-Group coach isn't
forced to restart.

## 14. Partial-fulfilment workflow

If a borrowing Group requests multiple players (e.g. "any two available forwards") and the owning
Group can only supply one, the system would need a way to represent partial fulfilment
distinctly from either full approval or full decline, so the borrowing-Group coach knows to seek
the remainder elsewhere (including, potentially, from a GuestPlayer).

## 15. Revocation and expiry

A previously-approved request should be revocable by the owning-Group coach before the Player is
actually used (e.g. the Player becomes unavailable for an unrelated reason) — this must not be
confused with ending a whole collaboration relationship (§10), and must never mutate a Match or
Round that has already recorded actual participation (mirroring the existing "recorded
participation always takes precedence over planning availability" rule from GuestPlayer's Event
Match availability work, ADR-0106).

## 16. Email notifications

Matchboard already has a transactional email pipeline (`src/lib/email/`, ADR-covered) for
organisation invitations and review-request supersession. A collaboration workflow would
plausibly need equivalent notifications for: a new collaboration proposal, a new player request,
an approval, a decline, a counter-suggestion, and a revocation. Each would need its own template
and idempotency key, following the existing `enqueueAndSendNotification()` pattern — never a
bespoke second notification path.

## 17. Audit trail requirements

Every collaboration-relationship state change and every player-request state change would need an
auditable record, following the existing `DecisionRecord`/`logSecurityEvent()` split already used
elsewhere in Matchboard (see AGENTS.md "Player-development and assistant-manager actions must
create an auditable DecisionRecord... Selection-engine actions are audited separately"). A
cross-Group action touches two Groups' data at once, which makes getting this right more
important here than in most other Matchboard workflows, not less.

## 18. Statistics ownership boundary

The owning Group must remain the sole source of truth for a collaborating Player's longitudinal
season statistics (goals, assists, appearances — see AGENTS.md "Canonical data truth"). A match
played for a borrowing Group would need to count toward the Player's actual participation
somewhere — the open question is whether it counts toward the *owning* Group's fairness/load
tracking (since that is the Group responsible for the Player's overall development context), the
*borrowing* Group's (since that is where it physically happened), both, or neither by default.
This document takes no position — see §35.

## 19. Evidence ownership boundary

The same ownership question applies to development evidence (`PlayerDevelopmentObservation` and
the broader evidence pipeline, ADR-0104). Evidence generated while a Player represents a
borrowing Group is still evidence *about that Player* — it should very plausibly still feed the
owning Group's understanding of the Player's development, since the Player's identity and
development trajectory belong to the owning Group. This document leans toward "evidence always
flows back to the owning Group regardless of which Group's Match produced it," but that lean is a
name, not a decision.

## 20. Attribute-mutation authority

Regardless of how statistics/evidence ownership is resolved, **attribute-mutation authority must
remain exclusively with the owning Group.** A borrowing-Group coach must never be able to edit a
collaborating Player's rating attributes, readiness signals, or profile — those remain the owning
Group's judgement about their own Player. This is a hard boundary, not a configurable option, for
the same reason a borrowing Group cannot rename or reassign a Player's core team today.

## 21. Cohort-context evidence signal

A Player playing up (an older cohort) or down (a younger cohort) than their own — whether via
in-Group movement or a future cross-Group loan — plays under materially different conditions than
their normal cohort. A descriptive signal is worth exploring: `NORMAL_COHORT`,
`PLAYING_WITH_OLDER_GROUP`, `PLAYING_WITH_YOUNGER_GROUP`, attached to evidence/observations
generated during that specific participation, so a coach reviewing evidence later can see the
context it was generated under.

## 22. Why the cohort-context signal is not a fixed multiplier

This signal must remain purely descriptive — never a numeric weight silently applied to ratings,
evidence confidence, or scoring. Matchboard's existing combination-evidence work (ADR-0094)
already establishes this exact principle for a related concept: confidence reflects how much
evidence exists, never how good the outcome was, and evidence is presented as factual sentences,
never a synthesized score. A cohort-context signal must follow the same discipline — a coach
reading "this observation was recorded while playing with the older group" should draw their own
conclusion, not have Matchboard apply a hidden correction factor on their behalf. This also
avoids the "artificial equal-strength balancing" and "hidden judgement" guardrails already
established elsewhere in Matchboard's domain rules.

## 23. Cross-Group roster browsing

If a borrowing-Group coach can browse an owning Group's roster at all (rather than only naming a
specific already-known Player), that browsing view must be bounded — plausibly limited to name,
position, and availability status, deliberately excluding readiness signals, internal notes,
attribute ratings, and anything else coach-facing-only within the owning Group (see §9). Full,
un-bounded cross-Group roster visibility is very likely too broad a grant for a relationship that
may exist mainly to cover occasional squad gaps.

## 24. Cross-Group participant creation

Whatever mechanism ultimately assigns a borrowed Player to a borrowing Group's squad or lineup
must not create a second `Selection`-like row that competes with the Player's normal in-Group
planning. It would need to reuse or extend the same one-planned-assignment-per-round discipline
already enforced for in-Group planning (see AGENTS.md "One planned assignment per player per
round") — a Player cannot simultaneously be planned for their own Group's match and a
borrowing Group's match in the same Round without an explicit, intentional override, exactly as
a League Match helper today is an explicit override of that same expectation (ADR-0077).

## 25. Cross-Group authorization model

A cross-Group action is, by definition, an action that touches two Groups' tenant-scoped data at
once. Matchboard's existing tenant-isolation model (`src/lib/db.ts`'s `tenantRLS` extension, fail
closed per ADR-0087) is built around a single trusted organisation/Group context per request. A
collaboration feature would need a deliberate, reviewed extension to that model — most plausibly,
an explicit two-Group authorization check performed at the application layer before any
cross-Group read or write, never a widening of the default tenant-scoping fallback. This is
exactly the kind of change AGENTS.md's ADR-governance rules require an ADR for before
implementation, not an incidental side effect of building the feature.

## 26. Cross-Group statistics attribution

Building on §18: whichever attribution model is chosen, it must be a single, documented,
non-ambiguous rule — never "whichever Group's report happens to be filled in first" or similar
accidental behaviour. The canonical-data-truth register (`docs/domain/source-of-truth-register.md`)
would need a new row for this fact once a decision is made.

## 27. Cross-Group evidence attribution

Same discipline as §26, applied to evidence: the resolution in §19 must become one documented row
in the evidence pipeline's design (ADR-0104), not an implicit side effect of which Group's
`FootballMatchRef` happens to be passed to `runPostMatchLearning()`.

## 28. Historical integrity under revocation

Ending a collaboration relationship, revoking a specific approval, or the owning Group later
disputing a specific use must never rewrite history. This mirrors Matchboard's existing hard rule
that recorded participation always outlives the planning context that produced it (see AGENTS.md
"Actual double-load from post-match reports," "Match-specific player absence"). A borrowed
Player's already-recorded goals, minutes, and evidence remain part of the historical record
regardless of what happens to the relationship afterward.

## 29. Illustrative data model sketch

Purely illustrative — not a proposal to implement, and deliberately not using Prisma syntax so it
cannot be mistaken for a ready-to-apply migration:

- A `GroupCollaboration`-shaped concept: two Group references (owning, borrowing), a status, and
  standing metadata (created by, created at, direction).
- A `PlayerCollaborationRequest`-shaped concept: the collaboration it belongs to, the requested
  Player or pool description, the requested context (Round/Match/Event reference), a status
  (proposed/approved/declined/countered/partially-fulfilled/revoked/expired), and a structured
  reason.
- A `PlayerCollaborationParticipation`-shaped concept: the approved request it fulfils, and a
  reference to wherever the actual planning/participation record ends up living — most plausibly
  reusing `ParticipantRef`'s pattern (§30) rather than inventing a third parallel participant
  representation.

## 30. Extension points already in place

`ParticipantType` (`src/lib/participants/participant-ref.ts`) is a plain string union
(`"PLAYER" | "GUEST_PLAYER"`), deliberately left open rather than a closed two-member enum,
exactly so that a future `"COLLABORATING_GROUP_PLAYER"` source is a type-union edit at the point
it is actually built — not a schema migration and not a rewrite of every switch statement over
this type. This was a deliberate design decision in ADR-0106, made in anticipation of this
document, and is the single most concrete piece of groundwork already in place for a future
collaboration capability.

## 31. Reusable patterns from the shipped GuestPlayer work

Several patterns proven out by ADR-0106 would very plausibly transfer directly:
- The Round-registration-before-Match-assignment gate (`LeagueRoundParticipant` →
  `LeagueMatchGuestAssignment`, requiring registration at the Round level before use at the Match
  level) is a reasonable template for how a borrowed Player might need to be "registered" for a
  Round before being assignable to a specific Match within it.
- `EventMatchAvailability`'s sparse-exception storage pattern (a row's mere existence means
  "unavailable for this specific match") is a reasonable template for a borrowed Player's
  availability to the borrowing Group, if that ever needs its own tracking distinct from the
  Player's own-Group availability.
- The "separate table per participant source, sharing only the domain pattern" convention
  (ADR-0077, reused throughout ADR-0106) argues for a collaborating Player's cross-Group
  participation living in its own table(s), never retrofitted into `Selection` or
  `MatchHelperAssignment`.

## 32. Security and tenancy considerations

Beyond §25's authorization-model point: if cross-Organisation collaboration is ever considered
(two entirely separate Matchboard Organisations, not just two Groups within one), that is a
materially larger security surface than anything explored in this document, which assumes
same-Organisation Group-to-Group collaboration throughout. Cross-Organisation lending would need
its own separate discovery pass and is explicitly out of scope here.

## 33. Child-safety and language considerations

Every existing child-safety and neutral-language rule in Matchboard (no permanent labels, no
punishment framing, coach-facing vs. parent-facing language, disallowed feedback vocabulary — see
AGENTS.md's "Coaching/domain model" and "Coach-facing vs parent-facing language" sections) applies
unchanged to a borrowed Player. Nothing about being lent between Groups should ever read, in any
coach-facing or parent-facing surface, as a judgement on the Player's ability or standing.

## 34. Explicit non-goals

The following are explicitly not part of this discovery and must not be built without a new,
separate maintainer decision:

- No `GroupCollaboration` database model or any related schema.
- No collaboration invitation, proposal, or acceptance workflow.
- No connected-roster browsing UI.
- No Player request workflow, emails, approval, or counter-suggestion mechanism.
- No cross-Group participant creation, authorization, statistics, or evidence — actual write
  paths of any kind.
- No cohort-context evidence signal implementation (only the descriptive concept is explored
  above).
- No cross-Group Player attribute access of any kind, read or write.
- No Player transfer mechanism (permanent move between Groups) — this document only explores
  *temporary* lending; a permanent transfer is a different, unexplored concept.
- No collaboration-related notifications, templates, or audit-log entries.
- Only discovery and documentation. Nothing in this document authorizes implementation.

## 35. Open questions and recommended first implementation slice

Open questions this document deliberately leaves unresolved:

1. Does a borrowed Player's actual appearance count toward the owning Group's season fairness,
   the borrowing Group's, both, or neither by default (§18)?
2. Can a borrowing-Group coach request an open pool ("any available midfielder") or only a
   specifically named Player (§11)?
3. Does the owning-Group coach see full explanation-level detail about how a borrowed Player was
   used, or only a coarse played/not-played summary (§9)?
4. Is cross-Organisation collaboration ever in scope, or permanently excluded (§32)?
5. Should a collaboration relationship have an expiry date by default, or remain open-ended until
   explicitly ended (§10)?

If a maintainer ever decides to pursue this capability, the smallest defensible first slice would
very plausibly be: a single-directional, single-Player, single-Match request/approval flow with
no counter-suggestion, no partial fulfilment, and no cohort-context evidence signal — deferring
every other workflow in this document to later slices, each gated on the same ADR-governance
process used for every other architecture-affecting Matchboard change.
