package matchboard_situation_test

import data.matchboard.situation
import rego.v1

# -- unavailable selected player (bundle scenario 1) ---------------------------

test_unavailable_player_30min_before_kickoff_promoted if {
	result := situation.decision with input as {
		"situation": {"primary": "MATCHDAY", "active_match": false},
		"candidate": {
			"source": "availability",
			"consequences": ["SQUAD_DEGRADED", "POSITION_COVERAGE"],
			"deadline_minutes": 30,
			"has_recommendation": true,
			"alternative_count": 1,
			"reversible": true,
		},
	}

	result.visibility == "PROMOTE"
	result.horizon == "NOW"
	result.urgency == "IMMEDIATE"
	result.interaction == "CONFIRM"
	result.suppress_nonessential_context == true
	"HARD_CONSEQUENCE" in result.reason_codes
}

test_unavailable_player_5days_before_visible_in_next_lower_urgency if {
	result := situation.decision with input as {
		"situation": {"primary": "NEXT", "active_match": false},
		"candidate": {
			"source": "availability",
			"consequences": ["SQUAD_DEGRADED"],
			"deadline_minutes": 7200,
			"has_recommendation": true,
			"alternative_count": 1,
		},
	}

	result.visibility == "PROMOTE"
	result.horizon == "NEXT"
	result.urgency == "NORMAL"
	result.urgency != "IMMEDIATE"
}

test_unavailable_player_after_completed_match_not_promoted_as_premortem if {
	result := situation.decision with input as {
		"situation": {"primary": "NEXT", "active_match": false},
		"candidate": {
			"source": "availability",
			"consequences": ["INFORMATION_ONLY"],
			"deadline_minutes": null,
			"has_recommendation": false,
			"alternative_count": 0,
		},
	}

	result.visibility != "PROMOTE"
	result.urgency != "IMMEDIATE"
}

# -- missing goalkeeper / critical position coverage (bundle scenario 2) -------

test_missing_gk_coverage_imminent_match_promoted if {
	result := situation.decision with input as {
		"situation": {"primary": "MATCHDAY", "active_match": false},
		"candidate": {
			"source": "round_readiness",
			"consequences": ["POSITION_COVERAGE"],
			"deadline_minutes": 45,
			"has_recommendation": false,
			"alternative_count": 3,
		},
	}

	result.visibility == "PROMOTE"
	result.horizon == "NOW"
	result.interaction == "CHOOSE"
}

test_missing_gk_coverage_next_round_is_planning_decision if {
	result := situation.decision with input as {
		"situation": {"primary": "NEXT", "active_match": false},
		"candidate": {
			"source": "round_readiness",
			"consequences": ["POSITION_COVERAGE"],
			"deadline_minutes": 4000,
			"has_recommendation": false,
			"alternative_count": 3,
		},
	}

	result.visibility == "PROMOTE"
	result.horizon == "NEXT"
	result.interaction == "CHOOSE"
	result.urgency != "IMMEDIATE"
}

# -- old incomplete report (bundle scenario 3) ---------------------------------

test_stale_report_deferred_during_imminent_matchday_prep if {
	result := situation.decision with input as {
		"situation": {"primary": "MATCHDAY", "active_match": false},
		"candidate": {
			"source": "report_state",
			"consequences": ["REPORTING_DEBT"],
			"deadline_minutes": 40,
			"has_recommendation": false,
			"alternative_count": 0,
		},
	}

	result.visibility == "DEFER"
	"REPORTING_DEBT_DEFERRED" in result.reason_codes
}

test_stale_report_visible_as_post_match_work_when_no_upcoming_match if {
	result := situation.decision with input as {
		"situation": {"primary": "NEXT", "active_match": false},
		"candidate": {
			"source": "report_state",
			"consequences": ["REPORTING_DEBT"],
			"deadline_minutes": null,
			"has_recommendation": true,
			"alternative_count": 0,
		},
	}

	result.visibility != "DEFER"
	result.visibility != "SUPPRESS"
	"REPORTING_DEBT_VISIBLE" in result.reason_codes
}

# -- long-term development/opportunity signal (bundle scenario 4) -------------

test_long_term_signal_suppressed_during_unrelated_live_match if {
	result := situation.decision with input as {
		"situation": {"primary": "MATCHDAY", "active_match": true},
		"candidate": {
			"source": "opportunity_quality",
			"consequences": ["PLAYER_OPPORTUNITY"],
			"is_long_term_signal": true,
			"affects_next_round_decision": false,
		},
	}

	result.visibility == "SUPPRESS"
}

test_long_term_signal_influences_next_round_tie_break if {
	result := situation.decision with input as {
		"situation": {"primary": "NEXT", "active_match": false},
		"candidate": {
			"source": "opportunity_quality",
			"consequences": ["PLAYER_OPPORTUNITY"],
			"is_long_term_signal": true,
			"affects_next_round_decision": true,
			"deadline_minutes": 5000,
		},
	}

	result.visibility != "SUPPRESS"
	result.horizon == "NEXT"
	"LONG_TERM_SIGNAL_AFFECTS_NEXT_ROUND" in result.reason_codes
}

test_long_term_signal_promoted_in_long_term_review if {
	result := situation.decision with input as {
		"situation": {"primary": "LONG_TERM", "active_match": false},
		"candidate": {
			"source": "opportunity_quality",
			"consequences": ["DEVELOPMENT_SIGNAL"],
			"is_long_term_signal": true,
			"affects_next_round_decision": false,
		},
	}

	result.visibility == "PROMOTE"
	result.horizon == "LONG_TERM"
	result.urgency == "LOW"
}

# -- never AUTO -----------------------------------------------------------------

test_never_returns_auto_interaction if {
	some fixture in [
		{"situation": {"primary": "MATCHDAY", "active_match": true}, "candidate": {"consequences": ["SQUAD_DEGRADED"], "has_recommendation": true}},
		{"situation": {"primary": "NEXT", "active_match": false}, "candidate": {"consequences": ["POSITION_COVERAGE"], "alternative_count": 5}},
		{"situation": {"primary": "LONG_TERM", "active_match": false}, "candidate": {"is_long_term_signal": true}},
	]
	result := situation.decision with input as fixture
	result.interaction != "AUTO"
}

# -- ready / neutral input -------------------------------------------------------

test_neutral_input_does_not_crash_and_is_not_promoted if {
	result := situation.decision with input as {
		"situation": {"primary": "NEXT", "active_match": false},
		"candidate": {"source": "none", "consequences": []},
	}

	result.visibility != "PROMOTE"
	result.visibility != "SUPPRESS"
	is_array(result.reason_codes)
}

test_decision_object_shape if {
	result := situation.decision with input as {
		"situation": {"primary": "MATCHDAY", "active_match": false},
		"candidate": {"source": "none", "consequences": []},
	}

	result.visibility
	result.horizon
	result.urgency
	result.interaction
	is_array(result.reason_codes)
	result.suppress_nonessential_context == false
}
