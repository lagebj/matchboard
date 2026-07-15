export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export type BumpType = "none" | "patch" | "minor" | "major";

export interface ClassificationResult {
  type: string;
  bump: BumpType;
}

const CONVENTIONAL_COMMIT_RE = /^([a-zA-Z]+)(?:\([^)]+\))?!?:\s*.+/;
const BREAKING_FOOTER_RE = /^BREAKING CHANGE:\s*.+/m;

const BUMP_PRIORITY: Record<BumpType, number> = { none: 0, patch: 1, minor: 2, major: 3 };

const NON_BUMP_TYPES = new Set(["docs", "test", "chore", "ci", "build", "refactor"]);
const PATCH_TYPES = new Set(["fix", "perf"]);
const MINOR_TYPES = new Set(["feat"]);

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

export function classifyCommitMessage(message: string): ClassificationResult {
  const firstLine = message.split("\n")[0];
  const match = firstLine.match(CONVENTIONAL_COMMIT_RE);

  if (!match) {
    throw new Error(`Malformed conventional commit message: "${firstLine}". Expected format: type(scope)!: description`);
  }

  const typePrefix = match[1];
  const isBreakingBang = firstLine.includes("!");
  const hasBreakingFooter = BREAKING_FOOTER_RE.test(message);
  const isBreaking = isBreakingBang || hasBreakingFooter;

  const type = typePrefix.toLowerCase();

  if (isBreaking) {
    return { type, bump: "major" };
  }
  if (MINOR_TYPES.has(type)) {
    return { type, bump: "minor" };
  }
  if (PATCH_TYPES.has(type)) {
    return { type, bump: "patch" };
  }
  if (NON_BUMP_TYPES.has(type)) {
    return { type, bump: "none" };
  }
  throw new Error(`Unknown conventional commit type: "${type}" in: "${firstLine}"`);
}

export function calculateBump(messages: string[], majorLock: number | null | undefined): BumpType {
  let highestBump: BumpType = "none";

  for (const msg of messages) {
    const { bump } = classifyCommitMessage(msg);
    if (BUMP_PRIORITY[bump] > BUMP_PRIORITY[highestBump]) {
      highestBump = bump;
    }
  }

  if (majorLock !== null && majorLock !== undefined) {
    if (highestBump === "major") {
      highestBump = "minor";
    }
  }

  return highestBump;
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