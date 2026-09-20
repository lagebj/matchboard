import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { generateKeyPair, exportPKCS8, exportSPKI, importSPKI, jwtVerify, decodeJwt } from "jose";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let privateKeyB64: string;
let publicKeyPem: string;

const originalEnrollmentKey = process.env.AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  privateKeyB64 = Buffer.from(await exportPKCS8(privateKey), "utf8").toString("base64");
  publicKeyPem = await exportSPKI(publicKey);
});

beforeEach(() => {
  process.env.AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64 = privateKeyB64;
});

afterEach(() => {
  if (originalEnrollmentKey !== undefined) {
    process.env.AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64 = originalEnrollmentKey;
  } else {
    delete process.env.AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64;
  }
});

async function verify(jwt: string) {
  const publicKey = await importSPKI(publicKeyPem, "EdDSA");
  return jwtVerify(jwt, publicKey);
}

describe("ai/enrollment-token: signEnrollmentToken", () => {
  it("signs a token with the exact enrollment claim shape from 02_SECURITY_BOUNDARY.md", async () => {
    const { signEnrollmentToken } = await import("@/lib/ai/enrollment-token");
    const connectionId = generateAiProviderConnectionId();

    const jwt = await signEnrollmentToken({ connectionId, provider: "openai" });
    const { payload, protectedHeader } = await verify(jwt);

    expect(protectedHeader.alg).toBe("EdDSA");
    expect(payload.iss).toBe("matchboard");
    expect(payload.aud).toBe("matchboard-ai-enrollment");
    expect(payload.op).toBe("enroll-connection");
    expect(payload.connectionId).toBe(connectionId);
    expect(payload.provider).toBe("openai");
    expect(typeof payload.jti).toBe("string");
    expect((payload.jti as string).length).toBeGreaterThan(0);
    expect(payload.iat).toBeDefined();
    expect(payload.nbf).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it("is valid for exactly 90 seconds", async () => {
    const { signEnrollmentToken } = await import("@/lib/ai/enrollment-token");
    const connectionId = generateAiProviderConnectionId();

    const jwt = await signEnrollmentToken({ connectionId, provider: "anthropic" });
    const { exp, iat } = decodeJwt(jwt);
    expect(exp! - iat!).toBe(90);
  });

  it("mints a fresh jti on every call, even for identical inputs", async () => {
    const { signEnrollmentToken } = await import("@/lib/ai/enrollment-token");
    const connectionId = generateAiProviderConnectionId();

    const first = decodeJwt(await signEnrollmentToken({ connectionId, provider: "mistral" }));
    const second = decodeJwt(await signEnrollmentToken({ connectionId, provider: "mistral" }));
    expect(first.jti).not.toBe(second.jti);
  });

  it("rejects a malformed connection ID before signing anything", async () => {
    const { signEnrollmentToken } = await import("@/lib/ai/enrollment-token");
    await expect(signEnrollmentToken({ connectionId: "not-a-connection-id", provider: "openai" })).rejects.toThrow(
      "Invalid AI provider connection ID",
    );
  });

  it("rejects an unknown provider ID before signing anything", async () => {
    const { signEnrollmentToken } = await import("@/lib/ai/enrollment-token");
    const connectionId = generateAiProviderConnectionId();
    // @ts-expect-error deliberately invalid at the type level too — the runtime check must catch it
    await expect(signEnrollmentToken({ connectionId, provider: "azure_openai" })).rejects.toThrow("Invalid AI provider ID");
  });

  it("throws when the enrollment signing key is not configured", async () => {
    delete process.env.AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64;
    const { signEnrollmentToken } = await import("@/lib/ai/enrollment-token");
    await expect(
      signEnrollmentToken({ connectionId: generateAiProviderConnectionId(), provider: "openai" }),
    ).rejects.toThrow("AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64 environment variable is not set.");
  });
});

describe("ai/enrollment-token: signDeleteConnectionToken", () => {
  it("signs a token with the exact delete claim shape from 02A_MATCHBOARD_SECURITY_REQUIRED_DELTA.md", async () => {
    const { signDeleteConnectionToken } = await import("@/lib/ai/enrollment-token");
    const connectionId = generateAiProviderConnectionId();

    const jwt = await signDeleteConnectionToken({ connectionId, provider: "google_gemini" });
    const { payload } = await verify(jwt);

    expect(payload.iss).toBe("matchboard");
    expect(payload.aud).toBe("matchboard-ai-enrollment");
    expect(payload.op).toBe("delete-connection");
    expect(payload.connectionId).toBe(connectionId);
    expect(payload.provider).toBe("google_gemini");
  });

  it("uses the same enrollment keypair/audience as signEnrollmentToken, not a separate one", async () => {
    const { signEnrollmentToken, signDeleteConnectionToken } = await import("@/lib/ai/enrollment-token");
    const connectionId = generateAiProviderConnectionId();

    const enrollJwt = await signEnrollmentToken({ connectionId, provider: "ollama_cloud" });
    const deleteJwt = await signDeleteConnectionToken({ connectionId, provider: "ollama_cloud" });

    // Both must verify against the same public key.
    await expect(verify(enrollJwt)).resolves.toBeDefined();
    await expect(verify(deleteJwt)).resolves.toBeDefined();
  });
});
