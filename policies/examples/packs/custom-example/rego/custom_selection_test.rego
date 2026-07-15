package custom.selection

import future.keywords.in
import future.keywords.if

test_decision_returns_structure {
  result := custom.selection.decision with input as {
    "context": {
      "decision_type": "league_match_selection",
      "fairness_scope": "match",
      "nowIso": "2026-01-01T00:00:00Z",
      "intent_tags": [],
    },
    "players": [
      {"id": "p1", "display_name": "Player 1", "status": "ACTIVE", "available_for_context": true, "current_team_ids": ["t1"], "recent_match_count": 0, "season_match_count": 0, "period_match_count": 0, "policy_tags": []},
    ],
    "teams": [{"id": "t1", "name": "Team 1"}],
    "squads": [],
    "matches": [],
    "history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
    "constraints": {},
  }

  object.get(result, "blocked", null) != null
  object.get(result, "warnings", null) != null
  object.get(result, "score_adjustments", null) != null
  object.get(result, "explanations", null) != null
  object.get(result, "tags", null) != null
}

test_blocked_player_with_custom_tag {
  result := custom.selection.decision with input as {
    "context": {
      "decision_type": "league_match_selection",
      "fairness_scope": "match",
      "nowIso": "2026-01-01T00:00:00Z",
      "intent_tags": [],
    },
    "players": [
      {"id": "p-blocked", "display_name": "Blocked Player", "status": "ACTIVE", "available_for_context": true, "current_team_ids": ["t1"], "recent_match_count": 0, "season_match_count": 0, "period_match_count": 0, "policy_tags": ["custom_blocked"]},
      {"id": "p-ok", "display_name": "OK Player", "status": "ACTIVE", "available_for_context": true, "current_team_ids": ["t1"], "recent_match_count": 5, "season_match_count": 10, "period_match_count": 5, "policy_tags": []},
    ],
    "teams": [{"id": "t1", "name": "Team 1"}],
    "squads": [],
    "matches": [],
    "history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
    "constraints": {},
  }

  blocked := object.get(result, "blocked", [])
  count(blocked) == 1
  blocked[0].player_id == "p-blocked"
  blocked[0].reasons[0] == "blocked_by_custom_policy_tag"
}

test_equal_opportunity_boost {
  result := custom.selection.decision with input as {
    "context": {
      "decision_type": "league_match_selection",
      "fairness_scope": "match",
      "nowIso": "2026-01-01T00:00:00Z",
      "intent_tags": [],
    },
    "players": [
      {"id": "p-low", "display_name": "Low Match Player", "status": "ACTIVE", "available_for_context": true, "current_team_ids": ["t1"], "recent_match_count": 1, "season_match_count": 2, "period_match_count": 1, "policy_tags": []},
    ],
    "teams": [{"id": "t1", "name": "Team 1"}],
    "squads": [],
    "matches": [],
    "history": {"player_match_count_map": {}, "player_role_map": {}, "player_recent_support_count": {}},
    "constraints": {},
  }

  adjustments := object.get(result, "score_adjustments", [])
  count([a | some a in adjustments; a.code == "equal_opportunity_boost"]) >= 1
}