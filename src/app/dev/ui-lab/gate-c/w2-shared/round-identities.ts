/**
 * Shared player/team identities for the Gate C W2 Round Board candidates (C04-C06).
 *
 * Deliberately a NEW file, not a reuse of `gate-c/shared/fixtures.ts` (owned by the already
 * Visual-Authority-approved C01-C03 candidates): ADR-0159's fingerprint covers fixture content,
 * and issue #827 showed a shared-fixture edit silently invalidating a prior approval. Nothing
 * here is imported by C01-C03.
 *
 * Team names reuse the Atlas golden reference's own "Rød / Hvit / Blå" round scenario for a
 * like-for-like comparison with the approved Gate D composition.
 */

export const RED = "#d5342c";
export const WHITE_KIT = "#f2f2f2";
export const BLUE = "#1d4fa8";
export const GREEN = "#1f8a4c";

export type FixtureTeam = {
  teamId: string;
  teamName: string;
  kitColor: string;
  /**
   * Starting index into `FIRST_NAMES` for this team's roster. Each team gets its own 15-wide,
   * non-overlapping window — a real defect found while building C06 (four teams in one round):
   * without a per-team offset, every team's Nth player shares the same first name, so two
   * different real players render as indistinguishable "Select Noah" buttons / matrix rows in a
   * multi-team round. 15 comfortably covers the largest roster any Gate C W2 fixture uses (14).
   */
  nameOffset: number;
};

export const ROD: FixtureTeam = { teamId: "team-rod", teamName: "Rød", kitColor: RED, nameOffset: 0 };
export const HVIT: FixtureTeam = { teamId: "team-hvit", teamName: "Hvit", kitColor: WHITE_KIT, nameOffset: 15 };
export const BLA: FixtureTeam = { teamId: "team-bla", teamName: "Blå", kitColor: BLUE, nameOffset: 30 };
export const GRONN: FixtureTeam = { teamId: "team-gronn", teamName: "Grønn", kitColor: GREEN, nameOffset: 45 };

const FIRST_NAMES = [
  "William", "Oskar", "Lucas", "Noah", "Emil", "Isak", "Oliver", "Jonas", "Elias", "Theo",
  "Herman", "Filip", "Henrik", "Aksel", "Kasper",
  "Markus", "Sondre", "Mathias", "Tobias", "Jakob", "Leo", "Adrian", "Magnus", "Daniel", "Sander",
  "Erik", "Anders", "Fredrik", "Martin", "Kristian",
  "Nikolai", "Sebastian", "Benjamin", "Victor", "Tristan", "Johannes", "Edvard", "Vetle", "Halvor", "Ludvig",
  "Gustav", "Konrad", "August", "Emrik", "Sivert",
  "Amund", "Birk", "Even", "Gard", "Hallvard", "Ingvar", "Jørgen", "Knut", "Lars", "Mikael",
  "Nils", "Olav", "Peder", "Rolf", "Snorre",
];

const POSITIONS = ["GK", "LB", "CB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST"];

export type FixturePlayerSeed = {
  id: string;
  name: string;
  shirtNumber: number;
  primaryPosition: string;
  coreTeamId: string;
  coreTeamName: string;
  kitColor: string;
};

/**
 * Deterministic roster for one team — same shirt numbers/names/positions every render, so
 * captures are stable. `startShirt` keeps shirt numbers distinct across the round's teams; the
 * team's own `nameOffset` keeps names distinct across teams within the same round (see
 * `FixtureTeam.nameOffset`'s doc comment).
 */
export function buildRoster(team: FixtureTeam, count: number, startShirt = 1): FixturePlayerSeed[] {
  const roster: FixturePlayerSeed[] = [];
  for (let i = 0; i < count; i++) {
    const name = FIRST_NAMES[(team.nameOffset + i) % FIRST_NAMES.length]!;
    roster.push({
      id: `${team.teamId}-p${i + 1}`,
      name,
      shirtNumber: startShirt + i,
      primaryPosition: POSITIONS[i % POSITIONS.length]!,
      coreTeamId: team.teamId,
      coreTeamName: team.teamName,
      kitColor: team.kitColor,
    });
  }
  return roster;
}

export const KICKOFF_SATURDAY = new Date("2026-11-14T12:00:00.000Z");
export const KICKOFF_SATURDAY_LATE = new Date("2026-11-14T15:00:00.000Z");
export const KICKOFF_LAST_WEEK = new Date("2026-11-07T12:00:00.000Z");
