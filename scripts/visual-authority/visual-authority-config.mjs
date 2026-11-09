// Visual Authority Gate (ADR-0159 follow-up) — the configured Visual Authority allowlist.
// `check-actor-permission.mjs`'s `hasWriteAccess` answers "does this actor currently have general
// repository write access?" — necessary, but not narrow enough on its own: any contributor with
// write access could otherwise grant golden-reference visual approval. A valid approval requires
// BOTH current repository write access AND membership in this small, repository-controlled,
// explicitly-maintained allowlist. Starts with exactly the one real approver already acting in
// this repository's history (`lagebj`); additional approvers require a deliberate edit here, never
// an inferred delegation.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "visual-authority.config.json");

/** @returns {{ approvers: string[] }} */
export function loadVisualAuthorityConfig() {
  const raw = readFileSync(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.approvers)) {
    throw new Error(`${CONFIG_PATH} must define an "approvers" array`);
  }
  return { approvers: parsed.approvers };
}

/**
 * @param {string} login - a GitHub login, exactly as returned by the API (case-sensitive; GitHub
 *   logins are case-insensitive for routing but this allowlist is matched literally against what
 *   is configured, to avoid inventing a normalization rule this module doesn't own).
 * @param {{ approvers: string[] }} config
 * @returns {boolean}
 */
export function isConfiguredApprover(login, config) {
  return config.approvers.includes(login);
}
