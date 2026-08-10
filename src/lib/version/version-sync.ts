export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export type BumpType = "none" | "patch" | "minor" | "major";

export function parseVersion(version: string): SemVer {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: "${version}". Expected semver (e.g. 0.1.0).`);
  }
  return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10), patch: parseInt(match[3], 10) };
}

export function formatVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

export function isValidSemVer(version: string): boolean {
  try {
    parseVersion(version);
    return true;
  } catch {
    return false;
  }
}

export function isPreOneZero(version: string): boolean {
  const { major } = parseVersion(version);
  return major === 0;
}

export function applyBump(currentVersion: string, bumpType: BumpType, majorLock: number | null | undefined): string {
  let { major, minor, patch } = parseVersion(currentVersion);

  switch (bumpType) {
    case "major":
      if (majorLock !== null && majorLock !== undefined) {
        minor += 1;
        patch = 0;
      } else {
        major += 1;
        minor = 0;
        patch = 0;
      }
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    case "none":
      break;
  }

  if (majorLock !== null && majorLock !== undefined) {
    major = majorLock;
  }

  return formatVersion(major, minor, patch);
}