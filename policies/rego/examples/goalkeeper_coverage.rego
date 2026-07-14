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

blocked_players := []

all_warnings := stricter_gk_warnings

all_score_adjustments := []

all_explanations := []

all_tags := []

stricter_gk_warnings := [w |
  some squad in input.squads
  some w in [
    strict_no_gk_warning(squad),
    strict_tertiary_gk_warning(squad),
  ]
  w != null
]

strict_no_gk_warning(squad) := {
  "code": "rego_strict_no_goalkeeper",
  "severity": "blocking",
  "message": "Strict: Squad has no goalkeeper coverage at all.",
  "team_id": object.get(squad, "team_id", null),
} {
  squad.primary_goalkeeper_count == 0
  squad.any_goalkeeper_count == 0
}

strict_tertiary_gk_warning(squad) := {
  "code": "rego_strict_tertiary_goalkeeper_only",
  "severity": "blocking",
  "message": "Strict: Squad only has tertiary goalkeeper coverage, not acceptable.",
  "team_id": object.get(squad, "team_id", null),
} {
  squad.primary_goalkeeper_count == 0
  squad.any_goalkeeper_count > 0
}