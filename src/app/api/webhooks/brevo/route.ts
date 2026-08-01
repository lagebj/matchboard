import { NextResponse } from "next/server";
import { verifyBrevoWebhookSignature, processBrevoWebhookEvents } from "@/lib/email/webhook-handler";
import type { BrevoWebhookEvent } from "@/lib/email/webhook-handler";

const BREVO_WEBHOOK_KEY = process.env.BREVO_WEBHOOK_KEY ?? "";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-brevo-signature");

  if (BREVO_WEBHOOK_KEY && !verifyBrevoWebhookSignature(rawBody, signatureHeader, BREVO_WEBHOOK_KEY)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

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