import { db } from "@/lib/db";

export type VerificationCheck = {
  name: string;
  passed: boolean;
  count: number;
  expected?: number;
  details?: string;
};

export type VerificationResult = {
  passed: boolean;
  checks: VerificationCheck[];
  summary: string;
};

export async function verifyBackfill(): Promise<VerificationResult> {
  const checks: VerificationCheck[] = [];

  const orgs = await db.organisation.findMany({
    select: { id: true, name: true },
  });

  let totalOrgsWithGroups = 0;
  let totalTeamsWithGroups = 0;
  let totalTeams = 0;
  let totalActivePlayersWithCoreTeam = 0;
  let totalPlayersWithGroupMembership = 0;
  let totalGroupAccessRows = 0;

  for (const org of orgs) {
    const groupCount = await db.footballGroup.count({
      where: { organisationId: org.id, isActive: true },
    });

    if (groupCount > 0) {
      totalOrgsWithGroups++;
    }

    const teamsInOrg = await db.team.count({
      where: { organisationId: org.id },
    });
    totalTeams += teamsInOrg;

    const teamsWithGroup = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::int as count FROM "Team" WHERE "organisationId" = ${org.id} AND "footballGroupId" IS NOT NULL
    `;
    totalTeamsWithGroups += Number(teamsWithGroup[0]?.count ?? 0);

    const activePlayersWithCoreTeam = await db.player.count({
      where: {
        organisationId: org.id,
        active: true,
        coreTeamId: { not: null },
      },
    });
    totalActivePlayersWithCoreTeam += activePlayersWithCoreTeam;

    const playersWithGroup = await db.player.count({
      where: {
        organisationId: org.id,
        active: true,
        coreTeamId: { not: null },
        groupMemberships: {
          some: {
            membershipType: "PRIMARY",
            status: "ACTIVE",
          },
        },
      },
    });
    totalPlayersWithGroupMembership += playersWithGroup;

    const groupAccessCount = await db.groupAccess.count({
      where: {
        group: { organisationId: org.id },
      },
    });
    totalGroupAccessRows += groupAccessCount;
  }

  checks.push({
    name: "All organisations have at least one group",
    passed: totalOrgsWithGroups === orgs.length,
    count: totalOrgsWithGroups,
    expected: orgs.length,
    details: orgs.length === 0 ? "No organisations found" : undefined,
  });

  checks.push({
    name: "All teams have a group assignment",
    passed: totalTeamsWithGroups === totalTeams,
    count: totalTeamsWithGroups,
    expected: totalTeams,
    details: totalTeams - totalTeamsWithGroups > 0
      ? `${totalTeams - totalTeamsWithGroups} teams without group assignment`
      : undefined,
  });

  checks.push({
    name: "All active players with core team have group membership",
    passed: totalPlayersWithGroupMembership === totalActivePlayersWithCoreTeam,
    count: totalPlayersWithGroupMembership,
    expected: totalActivePlayersWithCoreTeam,
    details: totalActivePlayersWithCoreTeam - totalPlayersWithGroupMembership > 0
      ? `${totalActivePlayersWithCoreTeam - totalPlayersWithGroupMembership} players without group membership`
      : undefined,
  });

  checks.push({
    name: "GroupAccess rows exist",
    passed: totalGroupAccessRows > 0,
    count: totalGroupAccessRows,
    details: totalGroupAccessRows === 0
      ? "No GroupAccess rows found"
      : undefined,
  });

  const orphanedTeams = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::int as count FROM "Team" t
    WHERE t."footballGroupId" IS NULL
    AND EXISTS (SELECT 1 FROM "FootballGroup" fg WHERE fg."organisationId" = t."organisationId" AND fg."isActive" = true)
  `;
  const orphanedCount = Number(orphanedTeams[0]?.count ?? 0);

  checks.push({
    name: "No orphaned teams (teams in orgs with groups but without group assignment)",
    passed: orphanedCount === 0,
    count: orphanedCount,
    expected: 0,
    details: orphanedCount > 0
      ? `${orphanedCount} teams in orgs with groups but without group assignment`
      : undefined,
  });

  const duplicatePrimaryMemberships = await db.footballGroupPlayer.groupBy({
    by: ["playerId"],
    where: {
      membershipType: "PRIMARY",
      status: "ACTIVE",
    },
    having: {
      playerId: { _count: { gt: 1 } },
    },
    _count: { playerId: true },
  });

  checks.push({
    name: "No duplicate active primary group memberships per player",
    passed: duplicatePrimaryMemberships.length === 0,
    count: duplicatePrimaryMemberships.length,
    expected: 0,
    details: duplicatePrimaryMemberships.length > 0
      ? `${duplicatePrimaryMemberships.length} players with duplicate active primary memberships`
      : undefined,
  });

  const passed = checks.every((c) => c.passed);

  const summary = passed
    ? "All verification checks passed."
    : `Verification failed: ${checks.filter((c) => !c.passed).length}/${checks.length} checks failed.`;

  return { passed, checks, summary };
}