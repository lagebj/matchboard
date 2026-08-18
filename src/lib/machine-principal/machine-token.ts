import { SignJWT, jwtVerify } from "jose";
import { TOKEN_MAX_AGE_SECONDS, DEFAULT_TOKEN_AGE_SECONDS, type MachineScope } from "@/lib/machine-principal/machine-principal";
import { getAuthSecret } from "@/lib/env";

export interface MachineTokenPayload {
  principalId: string;
  organisationId: string;
  scopes: string[];
  iat: number;
  exp: number;
  jti: string;
}

function getSecret(): Uint8Array {
  const secret = getAuthSecret();
  return new TextEncoder().encode(secret);
}

export async function signMachineToken(payload: {
  principalId: string;
  organisationId: string;
  scopes: MachineScope[];
  expiresIn?: number;
}): Promise<string> {
  const expiresIn = payload.expiresIn ?? DEFAULT_TOKEN_AGE_SECONDS;
  if (expiresIn < 60) {
    throw new Error("Token lifetime must be at least 60 seconds");
  }
  if (expiresIn > TOKEN_MAX_AGE_SECONDS) {
    throw new Error(`Token lifetime must not exceed ${TOKEN_MAX_AGE_SECONDS} seconds`);
  }

  const jti = crypto.randomUUID();
  const secret = getSecret();

  const jwt = await new SignJWT({
    principalId: payload.principalId,
    organisationId: payload.organisationId,
    scopes: payload.scopes,
    jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn} seconds`)
    .setJti(jti)
    .sign(secret);

  return jwt;
}

export async function verifyMachineToken(token: string): Promise<MachineTokenPayload> {
  const secret = getSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (!payload.principalId || typeof payload.principalId !== "string") {
      throw new Error("Invalid token: missing principalId");
    }
    if (!payload.organisationId || typeof payload.organisationId !== "string") {
      throw new Error("Invalid token: missing organisationId");
    }
    if (!payload.scopes || !Array.isArray(payload.scopes)) {
      throw new Error("Invalid token: missing scopes");
    }

    return {
      principalId: payload.principalId as string,
      organisationId: payload.organisationId as string,
      scopes: payload.scopes as string[],
      iat: payload.iat ?? Math.floor(Date.now() / 1000),
      exp: payload.exp ?? 0,
      jti: (payload.jti as string) ?? "",
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid token:")) {
      throw error;
    }
    throw new Error("Invalid or expired machine token");
  }
}