import { NextResponse } from "next/server";
import { matchboardEnv } from "@/lib/env";
import { APP_VERSION } from "@/lib/version";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: APP_VERSION,
    environment: matchboardEnv,
  });
}