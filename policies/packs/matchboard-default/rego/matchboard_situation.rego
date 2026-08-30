package matchboard.situation

import rego.v1

# Situational relevance policy (ADR-0107). Contextual visibility/urgency/horizon/interaction
# treatment for a normalized coach decision candidate — never football truth, never a database
# query, never a mutation. See docs/domain/situational-decision-support.md.
#
# input.situation: { primary, active_match, deadline_minutes }
#   primary          "MATCHDAY" | "NEXT" | "LONG_TERM"
#   active_match     boolean — a relevant match is currently live
#   deadline_minutes number|null — minutes until the candidate's own deadline (e.g. kickoff),
#                    independent of input.candidate.deadline_minutes so a situation-level
#                    imminence fact and a candidate-level one can differ (rare, but keeps the
#                    two normalizers honest about which layer owns which fact)
#
# input.candidate: { source, consequences, deadline_minutes, has_recommendation,
#                     alternative_count, reversible, is_long_term_signal,
#                     affects_next_round_decision, requires_review }

default decision := {
	"visibility": "NORMAL",
	"horizon": "NEXT",
	"urgency": "NORMAL",
	"interaction": "INFORM",
	"reason_codes": ["NO_MATCHING_RULE"],
	"suppress_nonessential_context": false,
}

decision := result if {
	result := {
		"visibility": visibility,
		"horizon": horizon,
		"urgency": urgency,
		"interaction": interaction,
		"reason_codes": reason_codes,
		"suppress_nonessential_context": suppress_nonessential_context,
	}
}

# -- facts -------------------------------------------------------------------

hard_consequences := {"MATCH_NOT_PLAYABLE", "SQUAD_DEGRADED", "POSITION_COVERAGE", "PLANNING_BLOCKED"}

candidate_consequences := {c |
	some c in object.get(input, ["candidate", "consequences"], [])
}

has_hard_consequence if {
	count(candidate_consequences & hard_consequences) > 0
}

has_reporting_debt if {
	"REPORTING_DEBT" in candidate_consequences
}

is_long_term_signal if {
	object.get(input, ["candidate", "is_long_term_signal"], false) == true
}

affects_next_round_decision if {
	object.get(input, ["candidate", "affects_next_round_decision"], false) == true
}

requires_review if {
	object.get(input, ["candidate", "requires_review"], false) == true
}

active_match if {
	object.get(input, ["situation", "active_match"], false) == true
}

primary := object.get(input, ["situation", "primary"], "NEXT")

candidate_deadline_minutes := object.get(input, ["candidate", "deadline_minutes"], null)

is_imminent if {
	candidate_deadline_minutes != null
	candidate_deadline_minutes <= 120
}

is_within_urgent_window if {
	candidate_deadline_minutes != null
	candidate_deadline_minutes <= 60
}

is_soon if {
	candidate_deadline_minutes != null
	candidate_deadline_minutes > 60
	candidate_deadline_minutes <= 1440
}

has_recommendation if {
	object.get(input, ["candidate", "has_recommendation"], false) == true
}

alternative_count := object.get(input, ["candidate", "alternative_count"], 0)

# -- visibility ----------------------------------------------------------------

visibility := "PROMOTE" if {
	primary == "MATCHDAY"
	has_hard_consequence
	on_matchday_now
} else := "SUPPRESS" if {
	primary == "MATCHDAY"
	is_long_term_signal
	not affects_next_round_decision
	not has_hard_consequence
} else := "DEFER" if {
	primary == "MATCHDAY"
	has_reporting_debt
	not has_hard_consequence
	on_matchday_now
} else := "PROMOTE" if {
	primary == "NEXT"
	has_hard_consequence
} else := "DEFER" if {
	primary == "NEXT"
	is_long_term_signal
	not affects_next_round_decision
	not has_hard_consequence
} else := "PROMOTE" if {
	primary == "LONG_TERM"
	is_long_term_signal
} else := "NORMAL"

on_matchday_now if {
	active_match
}

on_matchday_now if {
	is_imminent
}

# -- horizon ---------------------------------------------------------------

horizon := "NOW" if {
	active_match
} else := "NOW" if {
	is_imminent
} else := "NEXT" if {
	primary == "NEXT"
} else := "NEXT" if {
	is_long_term_signal
	affects_next_round_decision
} else := "LONG_TERM" if {
	is_long_term_signal
} else := "BEFORE_NEXT_MATCH" if {
	primary == "MATCHDAY"
} else := "NEXT"

# -- urgency -----------------------------------------------------------------

urgency := "IMMEDIATE" if {
	active_match
} else := "IMMEDIATE" if {
	is_within_urgent_window
} else := "SOON" if {
	is_soon
} else := "LOW" if {
	is_long_term_signal
	not has_hard_consequence
} else := "NORMAL"

# -- interaction ---------------------------------------------------------------

interaction := "REVIEW" if {
	requires_review
} else := "REVIEW" if {
	alternative_count > 3
} else := "CHOOSE" if {
	alternative_count >= 2
} else := "CONFIRM" if {
	has_recommendation
} else := "REVIEW" if {
	has_hard_consequence
	not has_recommendation
} else := "INFORM"

# -- reason codes --------------------------------------------------------------

reason_codes := sort([code | some code in reason_code_set]) if {
	count(reason_code_set) > 0
} else := ["NO_MATCHING_RULE"]

reason_code_set contains "MATCH_LIVE" if active_match

reason_code_set contains "MATCH_IMMINENT" if {
	is_imminent
	not active_match
}

reason_code_set contains "HARD_CONSEQUENCE" if has_hard_consequence

reason_code_set contains "LONG_TERM_SIGNAL_SUPPRESSED_ON_MATCHDAY" if {
	primary == "MATCHDAY"
	is_long_term_signal
	not affects_next_round_decision
	not has_hard_consequence
}

reason_code_set contains "LONG_TERM_SIGNAL_DEFERRED" if {
	primary == "NEXT"
	is_long_term_signal
	not affects_next_round_decision
	not has_hard_consequence
}

reason_code_set contains "LONG_TERM_SIGNAL_AFFECTS_NEXT_ROUND" if {
	is_long_term_signal
	affects_next_round_decision
}

reason_code_set contains "LONG_TERM_REVIEW_CONTENT" if {
	primary == "LONG_TERM"
	is_long_term_signal
}

reason_code_set contains "REPORTING_DEBT_DEFERRED" if {
	has_reporting_debt
	primary == "MATCHDAY"
	on_matchday_now
	not has_hard_consequence
}

reason_code_set contains "REPORTING_DEBT_VISIBLE" if {
	has_reporting_debt
	not on_matchday_now
}

reason_code_set contains "RECOMMENDATION_AVAILABLE" if has_recommendation

reason_code_set contains "MULTIPLE_ALTERNATIVES" if alternative_count >= 2

reason_code_set contains "REQUIRES_REVIEW" if requires_review

# -- suppress_nonessential_context ----------------------------------------------

suppress_nonessential_context if {
	visibility == "PROMOTE"
	primary == "MATCHDAY"
	horizon == "NOW"
} else := false
