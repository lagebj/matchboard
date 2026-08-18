import { NextResponse } from "next/server";
import { processBrevoWebhookEvents } from "@/lib/email/webhook-handler";
import type { BrevoWebhookEvent } from "@/lib/email/webhook-handler";
import { isProduction, getBrevoWebhookBearerToken } from "@/lib/env";
import crypto from "crypto";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: Request) {
  const BREVO_WEBHOOK_BEARER_TOKEN = getBrevoWebhookBearerToken();

  if (!BREVO_WEBHOOK_BEARER_TOKEN && isProduction()) {
    return NextResponse.json({ error: "Webhook authentication not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");

  if (BREVO_WEBHOOK_BEARER_TOKEN) {
    if (!authHeader || !timingSafeEqual(authHeader, `Bearer ${BREVO_WEBHOOK_BEARER_TOKEN}`)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!isProduction()) {
    // Development: allow unauthenticated webhooks for testing
  } else {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rawBody = await request.text();

  let events: BrevoWebhookEvent[];

  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await processBrevoWebhookEvents(events);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[webhooks:brevo] Error processing webhook events:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}