package matchboard_selection_test

import data.matchboard.selection
import rego.v1

test_decision_object_shape if {
	result := selection.decision with input as {
		"players": [],
		"teams": [],
		"squads": [],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "league", "now_iso": "2026-01-01T00:00:00Z"},
	}

	_ = result.blocked
	_ = result.warnings
	_ = result.score_adjustments
	_ = result.explanations
	_ = result.tags
}

test_low_recent_match_creates_adjustment if {
	testInput := {
		"players": [{
			"id": "p1",
			"display_name": "Player One",
			"status": "ACTIVE",
			"available_for_context": true,
			"recent_match_count": 0,
			"season_match_count": 0,
			"period_match_count": 0,
			"current_team_ids": [],
			"policy_tags": [],
		}],
		"teams": [],
		"squads": [],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "league", "now_iso": "2026-01-01T00:00:00Z"},
	}

	result := selection.decision with input as testInput
	count(result.score_adjustments) == 1
	result.score_adjustments[0].player_id == "p1"
	result.score_adjustments[0].delta == 5
	result.score_adjustments[0].code == "rego_low_recent_match_count"
}

test_no_primary_gk_creates_warning if {
	testInput := {
		"players": [],
		"teams": [],
		"squads": [{
			"id": "s1",
			"team_id": "t1",
			"player_id_list": [],
			"primary_goalkeeper_count": 0,
			"secondary_goalkeeper_count": 0,
			"any_goalkeeper_count": 0,
		}],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "league", "now_iso": "2026-01-01T00:00:00Z"},
	}

	result := selection.decision with input as testInput
	blocking_warnings := [w | some w in result.warnings; w.code == "rego_no_primary_goalkeeper"]
	count(blocking_warnings) == 1
}

test_tertiary_gk_only_creates_warning if {
	testInput := {
		"players": [],
		"teams": [],
		"squads": [{
			"id": "s1",
			"team_id": "t1",
			"player_id_list": [],
			"primary_goalkeeper_count": 0,
			"secondary_goalkeeper_count": 0,
			"any_goalkeeper_count": 1,
		}],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "league", "now_iso": "2026-01-01T00:00:00Z"},
	}

	result := selection.decision with input as testInput
	tertiary_warnings := [w | some w in result.warnings; w.code == "rego_tertiary_goalkeeper_only"]
	count(tertiary_warnings) == 1
}

test_custom_blocked_tag_blocks_player if {
	testInput := {
		"players": [{
			"id": "p1",
			"display_name": "Player One",
			"status": "ACTIVE",
			"available_for_context": true,
			"recent_match_count": 5,
			"current_team_ids": [],
			"policy_tags": ["custom_blocked"],
		}],
		"teams": [],
		"squads": [],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "league", "now_iso": "2026-01-01T00:00:00Z"},
	}

	result := selection.decision with input as testInput
	count(result.blocked) == 1
	result.blocked[0].player_id == "p1"
	result.blocked[0].reasons[0] == "blocked_by_custom_policy_tag"
}

test_active_normal_player_not_blocked if {
	testInput := {
		"players": [{
			"id": "p1",
			"display_name": "Player One",
			"status": "ACTIVE",
			"available_for_context": true,
			"recent_match_count": 5,
			"current_team_ids": [],
		}],
		"teams": [],
		"squads": [],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "league", "now_iso": "2026-01-01T00:00:00Z"},
	}

	result := selection.decision with input as testInput
	count(result.blocked) == 0
}

test_missing_optional_fields_no_crash if {
	testInput := {
		"players": [{
			"id": "p1",
			"status": "ACTIVE",
			"available_for_context": true,
		}],
		"teams": [],
		"squads": [],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "league", "now_iso": "2026-01-01T00:00:00Z"},
	}

	result := selection.decision with input as testInput
	is_object(result)
}

test_result_is_json_shaped if {
	testInput := {
		"players": [],
		"teams": [],
		"squads": [],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "league", "now_iso": "2026-01-01T00:00:00Z"},
	}

	result := selection.decision with input as testInput
	is_array(result.blocked)
	is_array(result.warnings)
	is_array(result.score_adjustments)
	is_array(result.explanations)
	is_array(result.tags)
}

test_league_mode_produces_score_adjustments if {
	testInput := {
		"players": [{
			"id": "p1",
			"display_name": "Player One",
			"status": "ACTIVE",
			"available_for_context": true,
			"recent_match_count": 0,
			"season_match_count": 0,
			"period_match_count": 0,
			"current_team_ids": [],
			"policy_tags": [],
		}],
		"teams": [],
		"squads": [],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "league", "decision_type": "league_match_selection", "now_iso": "2026-01-01T00:00:00Z"},
	}

	result := selection.decision with input as testInput
	count(result.score_adjustments) > 0
}

test_event_mode_no_score_adjustments if {
	testInput := {
		"players": [{
			"id": "p1",
			"display_name": "Player One",
			"status": "ACTIVE",
			"available_for_context": true,
			"recent_match_count": 0,
			"season_match_count": 0,
			"period_match_count": 0,
			"current_team_ids": [],
			"policy_tags": [],
		}],
		"teams": [],
		"squads": [],
		"matches": [],
		"history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
		"constraints": {},
		"context": {"phase": "pre_selection", "mode": "event", "decision_type": "event_squad_generation", "now_iso": "2026-01-01T00:00:00Z"},
	}

	result := selection.decision with input as testInput
	count(result.score_adjustments) == 0
}
