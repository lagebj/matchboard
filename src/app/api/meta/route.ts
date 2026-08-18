import { NextResponse } from "next/server";
import { matchboardEnv } from "@/lib/env";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
  const datasetVersion = process.env.TEST_DATASET_VERSION
    ? parseInt(process.env.TEST_DATASET_VERSION, 10) || null
    : null;

  return NextResponse.json({
    environment: matchboardEnv,
    version: APP_VERSION,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    gitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    pullRequest: process.env.VERCEL_GIT_PULL_REQUEST_ID ?? null,
    databaseMode: matchboardEnv === "test" ? "test" : matchboardEnv === "production" ? "production" : "development",
    datasetVersion,
  });
}