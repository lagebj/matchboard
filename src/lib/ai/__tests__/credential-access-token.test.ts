import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPair, exportPKCS8, exportSPKI, importSPKI, jwtVerify, decodeJwt } from "jose";

vi.mock("server-only", () => ({}));

import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let privateKeyB64: string;
let publicKeyPem: string;

const originalAccessKey = process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  privateKeyB64 = Buffer.from(await exportPKCS8(privateKey), "utf8").toString("base64");
  publicKeyPem = await exportSPKI(publicKey);
});

beforeEach(() => {
  process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 = privateKeyB64;
});

afterEach(() => {
  if (originalAccessKey !== undefined) {
    process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 = originalAccessKey;
  } else {
    delete process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64;
  }
});

describe("ai/credential-access-token: signCredentialAccessToken", () => {
  it("signs a token with the exact credential-access claim shape from 02_SECURITY_BOUNDARY.md", async () => {
    const { signCredentialAccessToken } = await import("@/lib/ai/credential-access-token");
    const connectionId = generateAiProviderConnectionId();

    const jwt = await signCredentialAccessToken({ connectionId });
    const publicKey = await importSPKI(publicKeyPem, "EdDSA");
    const { payload, protectedHeader } = await jwtVerify(jwt, publicKey);

    expect(protectedHeader.alg).toBe("EdDSA");
    // matchboard-security's Go runtime verifier hard-requires header.typ === "JWT" (not just
    // alg) — jose's SignJWT does not set `typ` unless told to, so omitting this regressed
    // silently (production 401 on every credential-access call, 2026-09-21) until this
    // assertion existed.
    expect(protectedHeader.typ).toBe("JWT");
    expect(payload.iss).toBe("matchboard");
    expect(payload.aud).toBe("matchboard-ai-credentials");
    expect(payload.op).toBe("access-credential");
    expect(payload.connectionId).toBe(connectionId);
    // Unlike enrollment/delete tokens, a credential-access token carries no provider claim.
    expect(payload.provider).toBeUndefined();
  });

  it("is valid for exactly 90 seconds", async () => {
    const { signCredentialAccessToken } = await import("@/lib/ai/credential-access-token");
    const jwt = await signCredentialAccessToken({ connectionId: generateAiProviderConnectionId() });
    const { exp, iat } = decodeJwt(jwt);
    expect(exp! - iat!).toBe(90);
  });

  it("rejects a malformed connection ID before signing anything", async () => {
    const { signCredentialAccessToken } = await import("@/lib/ai/credential-access-token");
    await expect(signCredentialAccessToken({ connectionId: "bogus" })).rejects.toThrow("Invalid AI provider connection ID");
  });

  it("throws when the credential-access signing key is not configured", async () => {
    delete process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64;
    const { signCredentialAccessToken } = await import("@/lib/ai/credential-access-token");
    await expect(signCredentialAccessToken({ connectionId: generateAiProviderConnectionId() })).rejects.toThrow(
      "AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 environment variable is not set.",
    );
  });

  it("uses a keypair independent of the enrollment signing key", async () => {
    // A credential-access token signed with the credential-access key must NOT verify against a
    // different, unrelated keypair (simulating the enrollment keypair) — the two boundaries are
    // cryptographically independent per ADR-0148.
    const { signCredentialAccessToken } = await import("@/lib/ai/credential-access-token");
    const jwt = await signCredentialAccessToken({ connectionId: generateAiProviderConnectionId() });

    const { publicKey: unrelatedPublicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const unrelatedPem = await exportSPKI(unrelatedPublicKey);
    const unrelatedKey = await importSPKI(unrelatedPem, "EdDSA");

    await expect(jwtVerify(jwt, unrelatedKey)).rejects.toThrow();
  });
});
