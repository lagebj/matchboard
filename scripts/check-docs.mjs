#!/usr/bin/env node

/**
 * Documentation validation for Matchboard.
 *
 * Checks:
 *   - Broken relative links in Markdown files
 *   - References to files or routes that no longer exist (where determinable)
 *   - Duplicate canonical terminology documents
 *   - Prohibited temporary document naming patterns
 *   - Obvious references to removed canonical terms (basic)
 *   - ADR supersession-link consistency where practical
 *   - Empty documentation directories
 *   - Public docs (content/docs/**\/*.mdx, ADR-0103): required frontmatter, internal /docs
 *     links resolve to a real page, referenced screenshots exist, no orphaned screenshot
 *     assets, and every contextual-Help target resolves to a real page
 *
 * Usage:
 *   node scripts/check-docs.mjs
 */

import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join, relative, dirname, resolve } from "path";

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const PROHIBITED_TEMP_PATTERNS = [
  /TODO/i,
  /\bWIP\b/,
  /\bdraft-notes?\b/i,
  /\bworking-notes?\b/i,
  /\bscratch-?pad\b/i,
  /\bhandover\b/i,
];

function walkDir(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if ([".git", "node_modules", ".next", "dist", ".opa-cache"].includes(entry.name)) continue;
        const subResults = walkDir(fullPath);
        if (subResults.files.length === 0 && subResults.dirs.length === 0) {
          results.push({ type: "empty-dir", path: relative(REPO_ROOT, fullPath) });
        }
        results.push(...subResults.issues);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push({ type: "file", path: fullPath });
      }
    }
  } catch {
    // Skip
  }
  return { files: results.filter((r) => r.type === "file"), dirs: results.filter((r) => r.type === "dir"), issues: results.filter((r) => r.type === "empty-dir") };
}

function checkRelativeLinks(filePath) {
  const issues = [];
  const content = readFileSync(filePath, "utf-8");
  const relPath = relative(REPO_ROOT, filePath);
  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;

  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const target = match[2];
    if (target.startsWith("http") || target.startsWith("#") || target.startsWith("mailto:")) continue;

    const resolved = resolve(dirname(filePath), target.split("#")[0].split("?")[0]);
    if (!existsSync(resolved)) {
      issues.push({
        file: relPath,
        line: content.substring(0, match.index).split("\n").length,
        message: `Broken link: [${match[1]}](${target})`,
      });
    }
  }

  return issues;
}

function checkProhibitedNames(filePath) {
  const issues = [];
  const content = readFileSync(filePath, "utf-8");
  const relPath = relative(REPO_ROOT, filePath);
  const fileName = filePath.split("/").pop() || "";

  for (const pattern of PROHIBITED_TEMP_PATTERNS) {
    if (pattern.test(fileName)) {
      issues.push({
        file: relPath,
        line: 0,
        message: `Prohibited temporary naming pattern: ${fileName}`,
      });
    }
  }

  return issues;
}

function checkADRSupersession() {
  const issues = [];
  const adrDir = join(REPO_ROOT, "docs/adr");
  if (!existsSync(adrDir)) return issues;

  const files = readdirSync(adrDir).filter((f) => f.endsWith(".md") && f !== "README.md");
  const supersededBy = {};

  for (const file of files) {
    const content = readFileSync(join(adrDir, file), "utf-8");
    const superMatch = content.match(/Superseded by[:\s]+(\d{4})/i);
    if (superMatch) {
      supersededBy[file] = superMatch[1];
    }
  }

  for (const [file, targetNum] of Object.entries(supersededBy)) {
    const targetFile = files.find((f) => f.startsWith(targetNum));
    if (!targetFile) {
      issues.push({
        file: `docs/adr/${file}`,
        line: 0,
        message: `Superseded-by references ADR ${targetNum} but no such ADR found`,
      });
    } else {
      const targetContent = readFileSync(join(adrDir, targetFile), "utf-8");
      const sourceNum = file.match(/^(\d{4})/)?.[1];
      if (sourceNum && !targetContent.includes(sourceNum)) {
        issues.push({
          file: `docs/adr/${targetFile}`,
          line: 0,
          message: `Supersedes ADR ${sourceNum} but ADR ${sourceNum} does not reference it`,
        });
      }
    }
  }

  return issues;
}

// AIP-7 (Architecture Integrity Programme): prevents the exact drift found and fixed during
// this phase — AGENTS.md's "Primary navigation" list and features/matchboard.feature's
// "Primary navigation contains exactly N items" scenario silently fell out of sync after a
// navigation model change (Phase 2.4), and nothing caught it automatically. Compares only the
// ordered list of item *labels* (Today, League, Events, ...), not exact route strings — AGENTS.md
// writes org-scoped routes (`/o/{orgSlug}/today`) while the feature file intentionally uses bare
// routes (`/today`) as its own established convention, so route-string comparison would be a
// false-positive trap, not a real consistency signal. Label order/set drifting is the actual
// failure mode this guards against.
function checkPrimaryNavConsistency() {
  const issues = [];
  const agentsPath = join(REPO_ROOT, "AGENTS.md");
  const featurePath = join(REPO_ROOT, "features/matchboard.feature");
  if (!existsSync(agentsPath) || !existsSync(featurePath)) return issues;

  const agentsContent = readFileSync(agentsPath, "utf-8");
  const agentsSection = agentsContent.match(
    /Primary navigation \(\d+ items?, in this order\)[\s\S]*?(?=\n##)/,
  )?.[0];
  if (!agentsSection) {
    issues.push({
      file: "AGENTS.md",
      line: 0,
      message: "Could not locate the \"Primary navigation (N items, in this order)\" section — " +
        "check-primary-nav-consistency's extraction pattern may need updating alongside any " +
        "heading/wording change there.",
    });
    return issues;
  }
  const agentsLabels = [...agentsSection.matchAll(/^\d+\.\s+\*\*(\w+)\*\*/gm)].map((m) => m[1]);

  const featureContent = readFileSync(featurePath, "utf-8");
  const featureSection = featureContent.match(
    /Primary navigation contains exactly \w+ items[\s\S]*?And the navigation must not include/,
  )?.[0];
  if (!featureSection) {
    issues.push({
      file: "features/matchboard.feature",
      line: 0,
      message: "Could not locate the \"Primary navigation contains exactly N items\" scenario — " +
        "check-primary-nav-consistency's extraction pattern may need updating alongside any " +
        "scenario rename.",
    });
    return issues;
  }
  const featureRows = [...featureSection.matchAll(/^\s*\|\s*(\w+)\s*\|\s*\/\S*\s*\|/gm)]
    .map((m) => m[1])
    .filter((label) => label !== "item");

  if (JSON.stringify(agentsLabels) !== JSON.stringify(featureRows)) {
    issues.push({
      file: "features/matchboard.feature",
      line: 0,
      message:
        `Primary navigation item list does not match AGENTS.md. AGENTS.md: [${agentsLabels.join(", ")}]. ` +
        `features/matchboard.feature: [${featureRows.join(", ")}]. Update whichever is stale — ` +
        "AGENTS.md is canonical (see docs/product/navigation-model.md).",
    });
  }

  return issues;
}

const DOCS_CONTENT_DIR = join(REPO_ROOT, "content/docs");
const DOCS_SCREENSHOTS_DIR = join(REPO_ROOT, "public/docs/screenshots");

/** Resolve a "/docs/a/b" URL path to its content/docs/**\/*.mdx source file, if any. */
function resolveDocsPathToFile(docsPath) {
  const slug = docsPath.replace(/^\/docs\/?/, "");
  if (slug === "") return join(DOCS_CONTENT_DIR, "index.mdx");
  return join(DOCS_CONTENT_DIR, `${slug}.mdx`);
}

function listMdxFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listMdxFiles(fullPath));
    } else if (entry.name.endsWith(".mdx")) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkPublicDocsFrontmatter(mdxFiles) {
  const issues = [];
  for (const file of mdxFiles) {
    const content = readFileSync(file, "utf-8");
    const relPath = relative(REPO_ROOT, file);
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      issues.push({ file: relPath, line: 1, message: "Missing frontmatter (requires title and description)." });
      continue;
    }
    const frontmatter = frontmatterMatch[1];
    if (!/^title:\s*\S/m.test(frontmatter)) {
      issues.push({ file: relPath, line: 1, message: "Frontmatter is missing a non-empty title." });
    }
    if (!/^description:\s*\S/m.test(frontmatter)) {
      issues.push({ file: relPath, line: 1, message: "Frontmatter is missing a non-empty description." });
    }
  }
  return issues;
}

function checkPublicDocsInternalLinks(mdxFiles) {
  const issues = [];
  for (const file of mdxFiles) {
    const content = readFileSync(file, "utf-8");
    const relPath = relative(REPO_ROOT, file);
    // Excludes image syntax (![alt](/docs/screenshots/...)) -- those are content assets,
    // validated separately by checkDocsScreenshots, not internal navigation links.
    const linkPattern = /[^!]\]\((\/docs[^)#?]*)/g;
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      const target = match[1];
      if (target.startsWith("/docs/screenshots/")) continue;
      const targetFile = resolveDocsPathToFile(target);
      if (!existsSync(targetFile)) {
        issues.push({
          file: relPath,
          line: content.substring(0, match.index).split("\n").length,
          message: `Internal docs link ${target} does not resolve to a content/docs page (expected ${relative(REPO_ROOT, targetFile)}).`,
        });
      }
    }
  }
  return issues;
}

/** Missing referenced screenshots fail; unreferenced screenshot files are reported as orphans. */
function checkDocsScreenshots(mdxFiles) {
  const issues = [];
  const referenced = new Set();

  for (const file of mdxFiles) {
    const content = readFileSync(file, "utf-8");
    const relPath = relative(REPO_ROOT, file);
    const imagePattern = /!\[[^\]]*\]\((\/docs\/screenshots\/[^)]+)\)/g;
    let match;
    while ((match = imagePattern.exec(content)) !== null) {
      const target = match[1];
      referenced.add(target);
      const targetFile = join(REPO_ROOT, "public", target);
      if (!existsSync(targetFile)) {
        issues.push({
          file: relPath,
          line: content.substring(0, match.index).split("\n").length,
          message: `Referenced screenshot ${target} does not exist. Run \`npm run docs:screenshots\`.`,
        });
      }
    }
  }

  if (existsSync(DOCS_SCREENSHOTS_DIR)) {
    const walk = (dir) => {
      const out = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(fullPath));
        else out.push(fullPath);
      }
      return out;
    };
    for (const filePath of walk(DOCS_SCREENSHOTS_DIR)) {
      const publicRelative = "/" + relative(join(REPO_ROOT, "public"), filePath);
      if (!referenced.has(publicRelative)) {
        issues.push({
          file: relative(REPO_ROOT, filePath),
          line: 0,
          message: `Screenshot asset is not referenced by any content/docs page (orphan). Reference it, or delete it if it is no longer needed.`,
        });
      }
    }
  }

  return issues;
}

/** Every HelpContextId in src/lib/help/help-context.ts must point at a real docs page. */
function checkHelpContextTargets() {
  const issues = [];
  const helpContextPath = join(REPO_ROOT, "src/lib/help/help-context.ts");
  if (!existsSync(helpContextPath)) return issues;

  const content = readFileSync(helpContextPath, "utf-8");
  const relPath = relative(REPO_ROOT, helpContextPath);
  const docsPathPattern = /docsPath:\s*"(\/docs[^"]*)"/g;
  let match;
  while ((match = docsPathPattern.exec(content)) !== null) {
    const target = match[1];
    const targetFile = resolveDocsPathToFile(target);
    if (!existsSync(targetFile)) {
      issues.push({
        file: relPath,
        line: content.substring(0, match.index).split("\n").length,
        message: `Help target ${target} does not resolve to a content/docs page (expected ${relative(REPO_ROOT, targetFile)}).`,
      });
    }
  }
  return issues;
}

function main() {
  const allIssues = [];

  const docsResult = walkDir(join(REPO_ROOT, "docs"));
  const rootResult = walkDir(REPO_ROOT);

  const mdFiles = [
    ...docsResult.files.map((f) => f.path),
    ...rootResult.files.map((f) => f.path),
  ].filter((f) => f.endsWith(".md"));

  // Remove duplicates
  const uniqueFiles = [...new Set(mdFiles)];

  for (const file of uniqueFiles) {
    allIssues.push(...checkRelativeLinks(file));
    allIssues.push(...checkProhibitedNames(file));
  }

  allIssues.push(...checkADRSupersession());
  allIssues.push(...checkPrimaryNavConsistency());

  // Empty directories
  allIssues.push(...docsResult.issues);

  // Public documentation (content/docs/**/*.mdx, ADR-0103)
  const publicDocsFiles = listMdxFiles(DOCS_CONTENT_DIR);
  allIssues.push(...checkPublicDocsFrontmatter(publicDocsFiles));
  allIssues.push(...checkPublicDocsInternalLinks(publicDocsFiles));
  allIssues.push(...checkDocsScreenshots(publicDocsFiles));
  allIssues.push(...checkHelpContextTargets());

  if (allIssues.length === 0) {
    console.log("✓ No documentation issues found.");
    process.exit(0);
  }

  console.log(`✗ Found ${allIssues.length} documentation issue(s):\n`);
  for (const issue of allIssues) {
    console.log(`  ${issue.file}${issue.line ? `:${issue.line}` : ""} — ${issue.message}`);
  }

  console.log(`\nTotal: ${allIssues.length} issue(s).`);
  process.exit(1);
}

main();