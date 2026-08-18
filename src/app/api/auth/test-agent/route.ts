import { NextResponse } from "next/server";
import { isTestAgentAuthEnabled, getTestAgentAuthSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isTestAgentAuthEnabled()) {
    return NextResponse.json({ error: "Test agent auth is not enabled" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as Record<string, unknown>).email !== "string" ||
    typeof (body as Record<string, unknown>).secret !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid request body. Required: email (string), secret (string)" },
      { status: 400 },
    );
  }

  const { email, secret } = body as { email: string; secret: string };

  const expectedSecret = getTestAgentAuthSecret();
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const namespace = process.env.TEST_AGENT_AUTH_NAMESPACE ?? "test-agent.matchboard.football";
  if (!email.endsWith(`@${namespace}`)) {
    return NextResponse.json(
      { error: `Test agent auth only accepts emails in the @${namespace} namespace. Got: ${email}` },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { db } = await import("@/lib/db");

  const user = await db.user.upsert({
    where: { email: normalizedEmail },
    update: { name: normalizedEmail.split("@")[0] },
    create: {
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0],
    },
  });

  return NextResponse.json({
    ok: true,
    userId: user.id,
    email: user.email,
    name: user.name,
  });
}