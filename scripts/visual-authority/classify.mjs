// Visual Authority Gate (ADR-0159) — applicability classification. Pure, synchronous, no
// network/filesystem access, so it's directly unit-testable and so the gate workflow can call it
// the same way whether the changed-file list came from a `gh api` call or a test fixture.
//
// This answers a different question from scripts/is-build-skip-eligible.sh ("can this affect the
// deployed app at all?"). This classifier answers "can this change invalidate a UI Lab
// candidate's captured visual presentation?" — a narrower, UI-Lab-specific question. The two are
// deliberately not merged into one script.

const APPLICABLE_PREFIXES = [
  "src/app/dev/ui-lab/",
  "src/components/touchline/",
  "src/components/matches/match-detail/",
  "src/components/matches/match-insights/",
];

const APPLICABLE_EXACT = new Set(["scripts/ui-lab-visual-review.mjs"]);

function isUiLabManifestOrAttestation(path) {
  return (
    path.startsWith("docs/ui-lab/") &&
    (path.endsWith("/candidate_manifest.json") || path.endsWith("/capture-attestation.json"))
  );
}

function matchedRule(path) {
  if (APPLICABLE_EXACT.has(path)) return `exact path: ${path}`;
  for (const prefix of APPLICABLE_PREFIXES) {
    if (path.startsWith(prefix)) return `prefix: ${prefix}`;
  }
  if (isUiLabManifestOrAttestation(path)) return "UI Lab candidate_manifest.json/capture-attestation.json";
  return null;
}

// Best-effort scenario-id extraction from a matched path, e.g.
// "src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx" -> "gate-b/b01-planned-ready".
// Informational only — never used for the approve/reject decision itself.
function extractScenario(path) {
  const m = path.match(/dev\/ui-lab\/(gate-[a-z]\/[a-z0-9-]+)/);
  if (m) return m[1];
  const manifestMatch = path.match(/docs\/ui-lab\/([a-z0-9-]+)\//);
  if (manifestMatch) return manifestMatch[1];
  return null;
}

/**
 * @param {string[]} changedFiles
 * @param {{incomplete?: boolean}} [options]
 * @returns {{applicable: boolean, reason: string, scenarios: string[]}}
 */
export function classify(changedFiles, options = {}) {
  if (options.incomplete) {
    return {
      applicable: true,
      reason: "changed-file inventory incomplete — failing closed",
      scenarios: [],
    };
  }

  const scenarios = new Set();
  const matchedReasons = [];

  for (const path of changedFiles) {
    const rule = matchedRule(path);
    if (rule) {
      matchedReasons.push(`${path} (${rule})`);
      const scenario = extractScenario(path);
      if (scenario) scenarios.add(scenario);
    }
  }

  if (matchedReasons.length === 0) {
    return {
      applicable: false,
      reason: "no changed file matches a visual-authority-relevant path",
      scenarios: [],
    };
  }

  return {
    applicable: true,
    reason: `matched: ${matchedReasons.join("; ")}`,
    scenarios: [...scenarios].sort(),
  };
}

const INELIGIBLE_PATTERNS = [
  /^prisma\/schema\.prisma$/,
  /^prisma\/migrations\//,
  /^src\/workers\//,
  /worker.*\.(ts|js)$/i,
  /^src\/lib\/auth\//,
  /^src\/middleware\.ts$/,
  /^src\/proxy\.ts$/,
  /^\.github\/workflows\//,
  /\.env/,
  /secrets?/i,
];

function isTestFile(path) {
  return /\.test\.(ts|tsx|js|mjs)$/.test(path) || path.includes("__tests__/");
}

/**
 * Stricter, positive-leaning eligibility check used only by the lightweight visual-review
 * deploy workflow — distinct from (and stricter than) classify()'s broader "does this need
 * review at all" question.
 * @param {string[]} changedFiles
 * @returns {{eligible: boolean, reason: string}}
 */
export function classifyLightweightDeployEligibility(changedFiles) {
  for (const path of changedFiles) {
    for (const pattern of INELIGIBLE_PATTERNS) {
      if (pattern.test(path) && !(pattern.source.includes("worker") && isTestFile(path))) {
        return {
          eligible: false,
          reason: `${path} matches an ineligible pattern (${pattern}) — requires the full acceptance label path`,
        };
      }
    }
  }
  return { eligible: true, reason: "no changed file matches an ineligible pattern" };
}
