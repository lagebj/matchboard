import {
  getActivePackArtifactHash,
  getActivePackVersion,
  clearPackCaches,
  isRegoEnabled,
  getRegoFailureMode,
} from "./policy-pack";

export function getPolicyArtifactHash(): string | null {
  if (!isRegoEnabled()) {
    return null;
  }
  return getActivePackArtifactHash();
}

export function getPolicyVersion(): string {
  if (!isRegoEnabled()) {
    return "default-typescript";
  }
  return getActivePackVersion();
}

export function clearPolicyHashCache(): void {
  clearPackCaches();
}

export { isRegoEnabled, getRegoFailureMode };