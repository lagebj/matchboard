package custom.selection

import future.keywords.in
import future.keywords.if

default decision = {
  "blocked": [],
  "warnings": [],
  "score_adjustments": [],
  "explanations": [],
  "tags": [],
}

decision = result if {
  result := {
    "blocked": blocked_players,
    "warnings": all_warnings,
    "score_adjustments": all_score_adjustments,
    "explanations": all_explanations,
    "tags": all_tags,
  }
}

# ─── Blocked players: applies in both league and event contexts ───

blocked_players := [{
  "player_id": p.id,
  "reasons": ["blocked_by_custom_policy_tag"],
}] {
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  "custom_blocked" in object.get(p, "policy_tags", [])
}

# ─── Warnings ───

all_warnings := concat([], [
  goalkeeper_coverage_warnings,
  league_period_fairness_warnings,
  event_pool_exclusion_warnings,
  event_helper_overlap_warnings,
])

# Goalkeeper coverage warning (league and event)
goalkeeper_coverage_warnings := [{
  "code": "weak_goalkeeper_coverage",
  "severity": "warning",
  "message": sprintf("Team %s has weak goalkeeper coverage for match %s.", [s.team_id, s.match_id]),
  "team_id": s.team_id,
  "match_id": s.match_id,
}] {
  some s in input.squads
  s.primary_goalkeeper_count == 0
  s.any_goalkeeper_count == 0
}

# League period fairness: warn if player has high recent match count
league_period_fairness_warnings := [{
  "code": "high_recent_match_count",
  "severity": "warning",
  "message": sprintf("Player %s has %d matches in recent period.", [p.id, p.recent_match_count]),
  "player_id": p.id,
}] {
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  input.context.decision_type == "league_match_selection"
  p.recent_match_count >= 5
}

# Event pool exclusion: warn if unavailable player is in squad
event_pool_exclusion_warnings := [{
  "code": "unavailable_in_pool",
  "severity": "warning",
  "message": sprintf("Player %s is unavailable but present in squad %s.", [p.id, s.id]),
  "player_id": p.id,
}] {
  input.context.decision_type == "event_squad_generation"
  some s in input.squads
  some pid in s.player_id_list
  some p in input.players
  p.id == pid
  p.available_for_context == false
}

# Event helper overlap: warn if same player appears in multiple overlapping squads
event_helper_overlap_warnings := [{
  "code": "helper_overlap",
  "severity": "warning",
  "message": sprintf("Player %s appears in multiple event squads.", [p.id]),
  "player_id": p.id,
}] {
  input.context.decision_type == "event_helper_selection"
  some p in input.players
  p.status == "ACTIVE"
  count([s | some s in input.squads; p.id in s.player_id_list]) > 1
}

# ─── Score adjustments ───

all_score_adjustments := concat([], [
  equal_opportunity_adjustments,
  competitive_event_boost,
])

# Equal opportunity: boost players with low recent match count
equal_opportunity_adjustments := [{
  "player_id": p.id,
  "delta": delta,
  "code": "equal_opportunity_boost",
  "reason": sprintf("Player %s has only %d recent matches, boosting selection score.", [p.id, p.recent_match_count]),
}] {
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  p.recent_match_count < 3
  delta := 5 - p.recent_match_count
  delta > 0
}

# Competitive event: boost standout players in competitive context
competitive_event_boost := [{
  "player_id": p.id,
  "delta": 3,
  "code": "competitive_context_boost",
  "reason": sprintf("Player %s boosted for competitive context.", [p.id]),
}] {
  input.context.decision_type == "event_squad_generation"
  input.context.fairness_scope == "event"
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  "competitive" in object.get(input.context, "intent_tags", [])
}

# ─── Explanations ───

all_explanations := concat([], [
  equal_opportunity_explanations,
  competitive_event_explanations,
])

equal_opportunity_explanations := [{
  "player_id": p.id,
  "code": "equal_opportunity_boost",
  "summary": "Player receives selection boost due to low recent match count.",
  "hard_rule": false,
}] {
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  p.recent_match_count < 3
}

competitive_event_explanations := [{
  "player_id": p.id,
  "code": "competitive_context_boost",
  "summary": "Player boosted for competitive event context.",
  "hard_rule": false,
}] {
  input.context.decision_type == "event_squad_generation"
  input.context.fairness_scope == "event"
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  "competitive" in object.get(input.context, "intent_tags", [])
}

# ─── Tags ───

all_tags := []