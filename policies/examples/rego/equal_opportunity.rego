package matchboard.selection

import rego.v1

default decision := {
	"blocked": [],
	"warnings": [],
	"score_adjustments": [],
	"explanations": [],
	"tags": [],
}

decision := result if {
	result := {
		"blocked": blocked_players,
		"warnings": all_warnings,
		"score_adjustments": all_score_adjustments,
		"explanations": all_explanations,
		"tags": all_tags,
	}
}

blocked_players := []

all_warnings := []

all_score_adjustments := equal_opportunity_adjustments

all_explanations := equal_opportunity_explanations

all_tags := []

equal_opportunity_adjustments := [adj |
	some p in input.players
	p.status == "ACTIVE"
	p.available_for_context == true
	season_count := object.get(p, "season_match_count", 0)
	season_count <= 1
	adj := {
		"player_id": p.id,
		"delta": 8,
		"reason": "Equal opportunity: player has had few season matches.",
		"code": "rego_equal_opportunity_boost",
	}
]

equal_opportunity_explanations := [exp |
	some p in input.players
	p.status == "ACTIVE"
	p.available_for_context == true
	season_count := object.get(p, "season_match_count", 0)
	season_count <= 1
	exp := {
		"player_id": p.id,
		"code": "rego_equal_opportunity_boost",
		"summary": "Equal opportunity: player has had few season matches, boosting priority.",
		"hard_rule": false,
	}
]
