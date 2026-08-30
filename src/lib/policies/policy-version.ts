import {
  getActivePackArtifactHash,
  getActivePackVersion,
  clearPackCaches,
} from "./policy-pack";

export function getPolicyArtifactHash(): string | null {
  return getActivePackArtifactHash();
}

export function getPolicyVersion(): string {
  return getActivePackVersion();
}

export function clearPolicyHashCache(): void {
  clearPackCaches();
}
