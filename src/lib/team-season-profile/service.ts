import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { organisationFilter, organisationFilterNullable } from "@/lib/tenancy/tenant-filter";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { loadTeamSeasonProfileSources } from "@/lib/team-season-profile/load-profile-sources";
import { buildTeamSeasonProfile } from "@/lib/team-season-profile/build-profile";
import { safeParseTeamSeasonProfileV1, type TeamSeasonProfileV1 } from "@/lib/team-season-profile/contracts";

/**
 * Profile service (ADR-0156 Slice 2 / `05_DATA_MODEL_AND_REFRESH.md` §4). The only module that
 * reads/writes the `TeamSeasonProfile` cache row. Never calls an AI provider (ADR-0156 §1/§16)
 * -- every function here is a deterministic read-through-rebuild-on-stale cache, nothing more.
 */

export type TeamSeasonProfileParams = {
  organisationId: string;
  teamId: string;
  leagueSeasonId: string;
  orgFilter: OrgFilterMode;
};

async function upsertProfile(organisationId: string, teamId: string, leagueSeasonId: string, profile: TeamSeasonProfileV1): Promise<void> {
  await db.teamSeasonProfile.upsert({
    where: { organisationId_teamId_leagueSeasonId: { organisationId, teamId, leagueSeasonId } },
    create: {
      organisationId,
      teamId,
      leagueSeasonId,
      profileVersion: profile.version,
      sourceFingerprint: profile.sourceFingerprint,
      payload: profile,
      computedAt: new Date(profile.computedAt),
    },
    update: {
      profileVersion: profile.version,
      sourceFingerprint: profile.sourceFingerprint,
      payload: profile,
      computedAt: new Date(profile.computedAt),
    },
  });
}

/**
 * Unconditionally rebuilds from canonical source state and persists the result, bypassing the
 * cache-freshness check. Used by `getTeamSeasonProfile` on a cache miss/stale/invalid read, by
 * the best-effort eager-refresh hook below, and by any future explicit "rebuild season
 * profiles" admin action (§9, optional). Returns `null` only when the team/season does not
 * resolve under the given tenant (never partially trusts an unscoped id).
 */
export async function rebuildTeamSeasonProfile(params: TeamSeasonProfileParams): Promise<TeamSeasonProfileV1 | null> {
  const sources = await loadTeamSeasonProfileSources(params);
  if (!sources) return null;

  const profile = buildTeamSeasonProfile(sources);
  await upsertProfile(params.organisationId, params.teamId, params.leagueSeasonId, profile);
  return profile;
}

/**
 * Read-through cache. §4: validates ownership (delegated to the source loader), checks the
 * current source fingerprint, returns the validated cached payload when fresh, rebuilds when
 * absent/stale/invalid, upserts the new snapshot, and never calls an AI provider.
 */
export async function getTeamSeasonProfile(params: TeamSeasonProfileParams): Promise<TeamSeasonProfileV1 | null> {
  const sources = await loadTeamSeasonProfileSources(params);
  if (!sources) return null;

  const currentFingerprint = computeSourceFingerprint(sources.fingerprintInput);
  const cached = await db.teamSeasonProfile.findUnique({
    where: { organisationId_teamId_leagueSeasonId: { organisationId: params.organisationId, teamId: params.teamId, leagueSeasonId: params.leagueSeasonId } },
  });

  if (cached && cached.sourceFingerprint === currentFingerprint) {
    // A stale/invalid JSON payload (hand-edited row, a future contract migration that never
    // ran, ...) must fail safe into a rebuild, never crash the caller (Test plan G.9).
    const parsed = safeParseTeamSeasonProfileV1(cached.payload);
    if (parsed.success) return parsed.data;
    logger.warn(
      { organisationId: params.organisationId, teamId: params.teamId, leagueSeasonId: params.leagueSeasonId },
      "[team-season-profile] cached payload failed validation, rebuilding",
    );
  }

  const profile = buildTeamSeasonProfile(sources);
  await upsertProfile(params.organisationId, params.teamId, params.leagueSeasonId, profile);
  return profile;
}

/** Recommended per `05_DATA_MODEL_AND_REFRESH.md` §5: bounded, not one unbounded `Promise.all`
 * across every row on a Teams-overview page load. */
const BATCH_REBUILD_CONCURRENCY = 3;

/**
 * Batch profile load for Teams overview (§5). Caps concurrency so a page with many teams never
 * bursts dozens of simultaneous rebuild queries -- each team's own read-through logic in
 * `getTeamSeasonProfile` is unchanged, this just bounds how many run at once.
 */
export async function getTeamSeasonProfiles(params: {
  organisationId: string;
  teamIds: string[];
  leagueSeasonId: string;
  orgFilter: OrgFilterMode;
}): Promise<Map<string, TeamSeasonProfileV1>> {
  const results = new Map<string, TeamSeasonProfileV1>();
  const queue = [...new Set(params.teamIds)];

  async function worker(): Promise<void> {
    for (let teamId = queue.shift(); teamId; teamId = queue.shift()) {
      const profile = await getTeamSeasonProfile({
        organisationId: params.organisationId,
        teamId,
        leagueSeasonId: params.leagueSeasonId,
        orgFilter: params.orgFilter,
      });
      if (profile) results.set(teamId, profile);
    }
  }

  await Promise.all(Array.from({ length: Math.min(BATCH_REBUILD_CONCURRENCY, queue.length) }, () => worker()));
  return results;
}

/**
 * Best-effort eager refresh (§6, optional): called after a League report completes/locks (its
 * canonical timeline/combination evidence has just been rebuilt by `runPostMatchLearning`) or
 * after qualitative evidence extraction persists for a League match. Never throws, never calls
 * an AI provider, and never fails the caller's own operation -- the normal read path
 * (`getTeamSeasonProfile`) would detect the same staleness and rebuild on the next request
 * regardless; this only makes that happen sooner.
 */
export async function refreshTeamSeasonProfileBestEffort(matchId: string, organisationId: string): Promise<void> {
  try {
    const match = await db.match.findFirst({
      where: { id: matchId, organisationId },
      select: { teamId: true, matchRound: { select: { leagueSeasonId: true } } },
    });
    const leagueSeasonId = match?.matchRound?.leagueSeasonId;
    if (!match || !leagueSeasonId) return;

    const orgFilter: OrgFilterMode = {
      type: "org",
      filter: organisationFilter(organisationId),
      filterNullable: organisationFilterNullable(organisationId),
      organisationId,
    };
    await rebuildTeamSeasonProfile({ organisationId, teamId: match.teamId, leagueSeasonId, orgFilter });
  } catch (error) {
    logger.warn({ matchId, organisationId, error }, "[team-season-profile] best-effort eager refresh failed");
  }
}
