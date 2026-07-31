import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { signMachineToken, verifyMachineToken } from "../machine-token";

describe("machine token", () => {
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeAll(() => {
    process.env.AUTH_SECRET = "test-secret-for-machine-token-tests-at-least-32-chars";
  });

  afterAll(() => {
    if (originalAuthSecret) {
      process.env.AUTH_SECRET = originalAuthSecret;
    } else {
      delete process.env.AUTH_SECRET;
    }
  });

  describe("signMachineToken", () => {
    it("signs a token with valid payload", async () => {
      const token = await signMachineToken({
        principalId: "principal-123",
        organisationId: "org-456",
        scopes: ["scenario:read", "fixtures:read"],
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT format
    });

    it("signs a token with custom expiry", async () => {
      const token = await signMachineToken({
        principalId: "principal-123",
        organisationId: "org-456",
        scopes: ["scenario:read"],
        expiresIn: 300,
      });

      const payload = await verifyMachineToken(token);
      expect(payload.principalId).toBe("principal-123");
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(301);
    });

    it("rejects token lifetime below 60 seconds", async () => {
      await expect(
        signMachineToken({
          principalId: "principal-123",
          organisationId: "org-456",
          scopes: ["scenario:read"],
          expiresIn: 30,
        }),
      ).rejects.toThrow("at least 60 seconds");
    });

    it("rejects token lifetime above maximum", async () => {
      await expect(
        signMachineToken({
          principalId: "principal-123",
          organisationId: "org-456",
          scopes: ["scenario:read"],
          expiresIn: 999999,
        }),
      ).rejects.toThrow("must not exceed");
    });

    it("throws if AUTH_SECRET is not set", async () => {
      const saved = process.env.AUTH_SECRET;
      delete process.env.AUTH_SECRET;
      try {
        await expect(
          signMachineToken({
            principalId: "principal-123",
            organisationId: "org-456",
            scopes: ["scenario:read"],
          }),
        ).rejects.toThrow("AUTH_SECRET");
      } finally {
        process.env.AUTH_SECRET = saved;
      }
    });
  });

  describe("verifyMachineToken", () => {
    it("verifies a valid token", async () => {
      const token = await signMachineToken({
        principalId: "principal-abc",
        organisationId: "org-def",
        scopes: ["scenario:read", "scenario:execute"],
      });

      const payload = await verifyMachineToken(token);

      expect(payload.principalId).toBe("principal-abc");
      expect(payload.organisationId).toBe("org-def");
      expect(payload.scopes).toEqual(["scenario:read", "scenario:execute"]);
      expect(payload.jti).toBeDefined();
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it("rejects an invalid token", async () => {
      await expect(verifyMachineToken("invalid.token.here")).rejects.toThrow("Invalid or expired");
    });

    it("rejects a token signed with a different secret", async () => {
      const saved = process.env.AUTH_SECRET;
      process.env.AUTH_SECRET = "test-secret-for-machine-token-tests-at-least-32-chars";
      const token = await signMachineToken({
        principalId: "principal-123",
        organisationId: "org-456",
        scopes: ["scenario:read"],
      });

      process.env.AUTH_SECRET = "different-secret-must-be-at-least-32-characters-long";
      try {
        await expect(verifyMachineToken(token)).rejects.toThrow("Invalid or expired");
      } finally {
        process.env.AUTH_SECRET = saved;
      }
    });
  });
});