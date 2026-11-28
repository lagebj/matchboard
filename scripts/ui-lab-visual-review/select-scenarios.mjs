// ADR-0161: deterministic, bounded scenario selection for the on-demand UI Lab capture workflow.
// Pure and side-effect free so it is directly unit-testable; scripts/ui-lab-visual-review.mjs
// imports and uses it as-is, with every scenario definition, interaction handler, and viewport in
// that script left untouched.

/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ mode: "all" | "targeted", requested: string[] | null }}
 */
export function parseCaptureArgs(argv) {
  const all = argv.includes("--all");
  const scenariosArg = argv.find((arg) => arg.startsWith("--scenarios="));

  if (all && scenariosArg) {
    throw new Error("--all and --scenarios= are mutually exclusive.");
  }

  if (!all && !scenariosArg) {
    // No selection given at all — preserves this script's original contract for ad-hoc local/
    // manual invocation: capture everything, exactly as before this module existed.
    return { mode: "all", requested: null };
  }

  if (all) {
    return { mode: "all", requested: null };
  }

  const raw = scenariosArg.slice("--scenarios=".length);
  const requested = raw.split(",").map((slug) => slug.trim());

  if (raw.trim().length === 0 || requested.some((slug) => slug.length === 0)) {
    throw new Error("--scenarios= must be a non-empty comma-separated list with no empty entries.");
  }

  const seen = new Set();
  const duplicates = new Set();
  for (const slug of requested) {
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  if (duplicates.size > 0) {
    throw new Error(`Duplicate scenario selection: ${[...duplicates].join(", ")}`);
  }

  return { mode: "targeted", requested };
}

/**
 * @param {{ slug: string }[]} allScenarios - the full, unfiltered registered scenario list.
 * @param {{ mode: "all" | "targeted", requested: string[] | null }} parsed
 * @returns {{ selected: { slug: string }[], requestedIds: string[] }}
 */
export function resolveSelectedScenarios(allScenarios, parsed) {
  if (parsed.mode === "all") {
    return { selected: allScenarios, requestedIds: allScenarios.map((s) => s.slug) };
  }

  const registered = new Set(allScenarios.map((s) => s.slug));
  const unknown = parsed.requested.filter((slug) => !registered.has(slug));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown scenario id(s): ${unknown.join(", ")}. Registered: ${[...registered].sort().join(", ")}`,
    );
  }

  // Preserve registration order, not requested-argument order — matches the capture script's
  // existing deterministic iteration and keeps manifest.json's `captures` ordering stable
  // regardless of how a dispatch input lists its scenarios.
  const requestedSet = new Set(parsed.requested);
  const selected = allScenarios.filter((s) => requestedSet.has(s.slug));

  return { selected, requestedIds: parsed.requested };
}
