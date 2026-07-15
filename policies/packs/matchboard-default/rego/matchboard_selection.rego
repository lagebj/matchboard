package matchboard.selection

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

# Blocked players: applies in both league and event contexts
blocked_players := [{
  "player_id": p.id,
  "reasons": ["blocked_by_custom_policy_tag"],
}] {
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  "custom_blocked" in object.get(p, "policy_tags", [])
}

# Goalkeeper warnings: applies in both league and event contexts
all_warnings := squad_goalkeeper_warnings

# Score adjustments: league-only by default
# Event contexts do not apply fairness score adjustments
all_score_adjustments := league_score_adjustments if {
  input.context.mode == "league"
}

all_score_adjustments := [] if {
  input.context.mode != "league"
}

all_explanations := []

all_tags := []

squad_goalkeeper_warnings := [w |
  some squad in input.squads
  some w in [
    no_primary_gk_warning(squad),
    tertiary_gk_only_warning(squad),
  ]
  w != null
]

no_primary_gk_warning(squad) := {
  "code": "rego_no_primary_goalkeeper",
  "severity": "blocking",
  "message": "Squad has no primary goalkeeper coverage.",
  "team_id": object.get(squad, "team_id", null),
} {
  squad.primary_goalkeeper_count == 0
  squad.any_goalkeeper_count == 0
}

tertiary_gk_only_warning(squad) := {
  "code": "rego_tertiary_goalkeeper_only",
  "severity": "warning",
  "message": "Squad only has tertiary goalkeeper coverage.",
  "team_id": object.get(squad, "team_id", null),
} {
  squad.primary_goalkeeper_count == 0
  squad.any_goalkeeper_count > 0
}

# League-only score adjustments: prioritise players with fewer match opportunities
# These adjustments are meaningful only in league contexts where fairness
# is measured across rounds, periods, and seasons.
# Event contexts use pool-based construction, not longitudinal fairness.
league_score_adjustments := low_recent_match_adjustments

low_recent_match_adjustments := [adj |
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  recent_count := object.get(p, "recent_match_count", 0)
  recent_count <= 1
  adj := {
    "player_id": p.id,
    "delta": 5,
    "reason": "Player has had fewer recent match opportunities.",
    "code": "rego_low_recent_match_count",
  }
]