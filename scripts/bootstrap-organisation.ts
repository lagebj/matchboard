/**
 * Bootstrap Organisation Script
 *
 * Matchboard is invitation-only (ADR-0085): there is no self-service
 * "create organisation" flow in the app. This script is the maintainer/
 * backend-team mechanism for provisioning a new organisation — run it once
 * per new organisation, not just for the very first one. Idempotent — safe
 * to run multiple times for the same slug.
 *
 * organisationId is non-nullable in the schema; row assignment for existing
 * data is handled by database migrations, not by this script.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-organisation.ts
 *
 * Required environment variables:
 *   DATABASE_URL        — database connection
 *   BOOTSTRAP_OWNER_EMAIL — email of the user who will be the org OWNER
 *                           (must already have signed in once via Google OAuth)
 *   BOOTSTRAP_ORGANIZATION_NAME — name of the organisation
 *   BOOTSTRAP_ORGANIZATION_SLUG — URL-safe slug for the organisation
 */

import { db } from "../src/lib/db";
import { logOrganisationCreate } from "../src/lib/security/audit-log";

const BOOTSTRAP_ORG_NAME = process.env.BOOTSTRAP_ORGANIZATION_NAME ?? "Default Club";
const BOOTSTRAP_ORG_SLUG = process.env.BOOTSTRAP_ORGANIZATION_SLUG ?? "default-club";
const BOOTSTRAP_OWNER_EMAIL = process.env.BOOTSTRAP_OWNER_EMAIL;

if (!BOOTSTRAP_OWNER_EMAIL) {
  console.error("BOOTSTRAP_OWNER_EMAIL is required.");
  process.exit(1);
}

async function main() {
  try {
    console.log("Starting bootstrap organisation migration...");
    console.log(`  Organisation: ${BOOTSTRAP_ORG_NAME} (${BOOTSTRAP_ORG_SLUG})`);
    console.log(`  Owner email: ${BOOTSTRAP_OWNER_EMAIL}`);

    const user = await db.user.findFirst({
      where: { email: BOOTSTRAP_OWNER_EMAIL },
    });

    if (!user) {
      console.error(`User with email ${BOOTSTRAP_OWNER_EMAIL} not found. Create the user first.`);
      process.exit(1);
    }

    const existingOrg = await db.organisation.findFirst({
      where: { slug: BOOTSTRAP_ORG_SLUG },
    });

    let orgId: string;

    if (existingOrg) {
      orgId = existingOrg.id;
      console.log(`  Organisation already exists: ${existingOrg.name} (${existingOrg.id})`);
    } else {
      const org = await db.organisation.create({
        data: {
          name: BOOTSTRAP_ORG_NAME,
          slug: BOOTSTRAP_ORG_SLUG,
          memberships: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
      orgId = org.id;
      console.log(`  Created organisation: ${org.name} (${org.id})`);
      logOrganisationCreate(`script:bootstrap-organisation (run by env BOOTSTRAP_OWNER_EMAIL=${BOOTSTRAP_OWNER_EMAIL})`, org.id, "success");
    }

    const existingMembership = await db.organisationMembership.findUnique({
      where: { userId_organisationId: { userId: user.id, organisationId: orgId } },
    });

    if (!existingMembership) {
      await db.organisationMembership.create({
        data: {
          userId: user.id,
          organisationId: orgId,
          role: "OWNER",
        },
      });
      console.log(`  Created OWNER membership for ${user.email}`);
    } else {
      console.log(`  Membership already exists for ${user.email} (role: ${existingMembership.role})`);
    }

    console.log("\nBootstrap organisation complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();