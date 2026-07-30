import { NextRequest, NextResponse } from "next/server";
import { authenticateMachinePrincipal, validateScopes } from "@/lib/machine-principal/machine-principal";
import { signMachineToken } from "@/lib/machine-principal/machine-token";
import { rateLimit } from "@/lib/rate-limit";
import { logAuthSuccess, logAuthFailure } from "@/lib/security/audit-log";

export async function POST(request: NextRequest) {
  const rl = rateLimit("machine:token", 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const grantType = body.grant_type;
  const clientId = body.client_id;
  const clientSecret = body.client_secret;
  const requestedScopesStr = body.scope ?? "";

  if (grantType !== "client_credentials") {
    logAuthFailure(clientId ?? "unknown", "machine_token_unsupported_grant");
    return NextResponse.json(
      { error: "unsupported_grant_type", error_description: "Only client_credentials grant type is supported" },
      { status: 400 },
    );
  }

  if (!clientId || !clientSecret) {
    logAuthFailure(clientId ?? "unknown", "machine_token_missing_credentials");
    return NextResponse.json(
      { error: "invalid_client", error_description: "client_id and client_secret are required" },
      { status: 401 },
    );
  }

  const requestedScopes = requestedScopesStr.split(" ").filter(Boolean);
  const { valid: validRequestedScopes } = validateScopes(requestedScopes);
  const scopesToRequest = validRequestedScopes.length > 0 ? validRequestedScopes : undefined;

  const result = await authenticateMachinePrincipal(
    clientId,
    clientSecret,
    scopesToRequest ?? [],
  );

  if (!result.authenticated) {
    logAuthFailure(clientId, `machine_token_auth_failure:${result.reason}`);
    return NextResponse.json(
      { error: "invalid_client", error_description: result.reason },
      { status: 401 },
    );
  }

  if (!result.grantedScopes || result.grantedScopes.length === 0) {
    logAuthFailure(clientId, "machine_token_no_scopes_granted");
    return NextResponse.json(
      { error: "invalid_scope", error_description: "No requested scopes are allowed for this principal" },
      { status: 403 },
    );
  }

  try {
    const token = await signMachineToken({
      principalId: result.principal!.id,
      organisationId: result.principal!.organisationId,
      scopes: result.grantedScopes as any[],
    });

    logAuthSuccess(clientId, `machine_token_issued:scopes=${result.grantedScopes.join(",")}`);

    return NextResponse.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: 600,
      scope: result.grantedScopes.join(" "),
    });
  } catch (error) {
    logAuthFailure(clientId, "machine_token_signing_failure");
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to sign token" },
      { status: 500 },
    );
  }
}