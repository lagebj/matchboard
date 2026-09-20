import "server-only";
import { SignJWT, importPKCS8 } from "jose";

/**
 * Internal Ed25519/EdDSA signing helper shared by `enrollment-token.ts` and
 * `credential-access-token.ts` (02_SECURITY_BOUNDARY.md). Not exported outside this directory —
 * every caller goes through one of those two modules so the claim shapes stay exactly what the
 * matchboard-security contract expects. Uses `jose`'s own PKCS#8/EdDSA support; per
 * 10_MANUAL_VERCEL_SECRET_SETUP.md, Matchboard must never implement Ed25519/JWT cryptography
 * manually.
 */

/** Every AI security-boundary token is exactly 90 seconds, per 02_SECURITY_BOUNDARY.md /
 * 02A_MATCHBOARD_SECURITY_REQUIRED_DELTA.md. Not configurable — a longer-lived token here would
 * widen the window an intercepted enrollment/credential-access/delete token remains usable. */
export const AI_SECURITY_TOKEN_LIFETIME_SECONDS = 90;

async function importEd25519PrivateKey(privateKeyPkcs8Base64: string) {
  const pem = Buffer.from(privateKeyPkcs8Base64, "base64").toString("utf8");
  return importPKCS8(pem, "EdDSA");
}

export async function signAiSecurityBoundaryToken(params: {
  privateKeyPkcs8Base64: string;
  audience: string;
  /** Merged into the JWT payload verbatim (op, connectionId, provider, ...). Must not include
   * `iss`, `aud`, `iat`, `nbf`, `exp`, or `jti` — those are always set here, never by the caller. */
  claims: Record<string, string>;
}): Promise<string> {
  const key = await importEd25519PrivateKey(params.privateKeyPkcs8Base64);
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ ...params.claims, jti })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer("matchboard")
    .setAudience(params.audience)
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + AI_SECURITY_TOKEN_LIFETIME_SECONDS)
    .setJti(jti)
    .sign(key);
}
