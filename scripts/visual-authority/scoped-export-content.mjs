// Visual Authority Gate (ADR-0159) — export-scoped content extraction for fingerprint.mjs
// (issue #827). `computeFingerprint()` hashes whatever content a path resolves to; this module
// lets a caller resolve a SHARED file (one listed in more than one scenario's `componentOwners`)
// to only the text of the specific named exports a scenario's OWN files actually import from it,
// instead of the whole file. Appending a brand-new, unrelated export to a shared fixture module
// then no longer changes every other scenario's fingerprint — only scenarios that actually import
// the changed/added export are affected.
//
// Deliberately conservative: any situation this can't safely bound (a wildcard `import * as ns`,
// a parse failure, an imported name whose own export text can't be found) returns `null`, telling
// the caller to fall back to whole-file hashing. Under-hashing (silently excluding content a
// scenario actually depends on) would let a real visual change through undetected — the one
// failure mode this must never produce. Over-hashing (occasionally falling back to the old
// whole-file behavior) only costs a human a redundant re-approval, the exact cost this fix exists
// to reduce, never eliminate at the cost of correctness.

import { basename, extname } from "node:path";
import ts from "typescript";

function scriptKindFor(fileName) {
  return fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function hasExportModifier(stmt) {
  if (!ts.canHaveModifiers(stmt)) return false;
  const modifiers = ts.getModifiers(stmt);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function exportedNamesOf(stmt) {
  if (!hasExportModifier(stmt)) return [];
  if (ts.isVariableStatement(stmt)) {
    return stmt.declarationList.declarations
      .map((d) => (ts.isIdentifier(d.name) ? d.name.text : null))
      .filter((name) => name !== null);
  }
  if (ts.isFunctionDeclaration(stmt) && stmt.name) return [stmt.name.text];
  if (ts.isTypeAliasDeclaration(stmt)) return [stmt.name.text];
  if (ts.isInterfaceDeclaration(stmt)) return [stmt.name.text];
  if (ts.isClassDeclaration(stmt) && stmt.name) return [stmt.name.text];
  if (ts.isEnumDeclaration(stmt)) return [stmt.name.text];
  return [];
}

/**
 * Parses a shared fixture file's source text and returns a Map from each top-level named export
 * to its own exact source text (including any leading comment/JSDoc, via `getFullStart()`, so a
 * doc-comment edit on one export still invalidates only that export). Returns `null` on a parse
 * failure rather than throwing — callers treat that as "could not safely scope, use the whole
 * file instead."
 *
 * @param {string} sourceText
 * @param {string} fileName - used only to pick TS vs TSX parsing; never read from disk here.
 * @returns {Map<string, string> | null}
 */
export function extractNamedExportTexts(sourceText, fileName) {
  let sourceFile;
  try {
    sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
  } catch {
    return null;
  }
  const result = new Map();
  for (const stmt of sourceFile.statements) {
    const names = exportedNamesOf(stmt);
    if (names.length === 0) continue;
    const text = sourceText.slice(stmt.getFullStart(), stmt.getEnd());
    for (const name of names) result.set(name, text);
  }
  return result;
}

function moduleSpecifierMatchesSharedFile(specifierText, sharedBasenameNoExt) {
  const lastSegment = specifierText.split("/").pop() ?? specifierText;
  return lastSegment === sharedBasenameNoExt;
}

/**
 * Parses a consumer file's source text and returns the Set of binding names it imports from a
 * shared module (matched by the shared file's own basename, extension stripped — imports are
 * always relative in this codebase, never resolved against tsconfig paths here). Returns:
 * - an empty Set if the consumer file never imports from that shared module at all;
 * - `null` if it imports from it in a way this can't safely bound (`import * as ns`, a default
 *   import, a re-export) — the caller must fall back to whole-file hashing for that shared path.
 *
 * @param {string} sourceText
 * @param {string} fileName
 * @param {string} sharedBasenameNoExt - e.g. "match-b-fixture" for ".../match-b-fixture.ts".
 * @returns {Set<string> | null}
 */
export function importedNamesFrom(sourceText, fileName, sharedBasenameNoExt) {
  let sourceFile;
  try {
    sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
  } catch {
    return null;
  }
  const names = new Set();
  for (const stmt of sourceFile.statements) {
    const isImport = ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt);
    if (!isImport || !stmt.moduleSpecifier || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (!moduleSpecifierMatchesSharedFile(stmt.moduleSpecifier.text, sharedBasenameNoExt)) continue;

    if (ts.isExportDeclaration(stmt)) return null; // re-export of the shared module — can't bound it.

    const clause = stmt.importClause;
    if (!clause) continue; // a bare `import "./match-b-fixture"` — no bindings, nothing to add.
    if (clause.name) return null; // default import — not a pattern this scopes safely.
    if (clause.namedBindings) {
      if (ts.isNamespaceImport(clause.namedBindings)) return null; // `import * as ns` — unbounded.
      if (ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          names.add((element.propertyName ?? element.name).text);
        }
      }
    }
  }
  return names;
}

/**
 * A `componentOwners` path used by more than one scenario (e.g. a shared fixture module like
 * src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts) needs export-scoped hashing; an
 * exclusively-owned file keeps the simpler, already-correct whole-file hash. Pure over the
 * already-loaded scenario registry — no file reads.
 *
 * @param {{ componentOwners: string[] }[]} scenarios
 * @returns {Set<string>}
 */
export function computeSharedComponentOwnerPaths(scenarios) {
  const counts = new Map();
  for (const scenario of scenarios) {
    for (const path of scenario.componentOwners) counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([path]) => path));
}

/**
 * Scopes a shared file's content to only the named exports this scenario's OWN other
 * `componentOwners` files actually import from it — so appending a brand-new, unrelated export
 * elsewhere in the same shared file no longer changes this scenario's fingerprint at all. Returns
 * `null` whenever this can't be done safely (a wildcard/default import/re-export anywhere, a
 * parse failure, or no resolvable usage at all), which the caller treats as "fall back to the
 * whole file" — under-scoping must never silently hide a real content change.
 *
 * @param {string} sharedPath
 * @param {string} sharedContent
 * @param {{ componentOwners: string[] }} scenario
 * @param {Map<string, string | null>} rawContentByPath - every other componentOwners path's own
 *   raw content at the same ref, already read by the caller.
 * @returns {string | null}
 */
export function scopedSharedContent(sharedPath, sharedContent, scenario, rawContentByPath) {
  const sharedBasenameNoExt = basename(sharedPath, extname(sharedPath));
  const usedNames = new Set();
  for (const consumerPath of scenario.componentOwners) {
    if (consumerPath === sharedPath) continue;
    const consumerContent = rawContentByPath.get(consumerPath);
    if (consumerContent === null || consumerContent === undefined) continue;
    const names = importedNamesFrom(consumerContent, consumerPath, sharedBasenameNoExt);
    if (names === null) return null;
    for (const name of names) usedNames.add(name);
  }
  if (usedNames.size === 0) return null;

  const exportTexts = extractNamedExportTexts(sharedContent, sharedPath);
  if (!exportTexts) return null;

  const parts = [];
  for (const name of [...usedNames].sort()) {
    const text = exportTexts.get(name);
    if (text === undefined) return null;
    parts.push(`${name}\n${text}`);
  }
  return parts.join("\u0000");
}
