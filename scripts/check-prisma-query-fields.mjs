#!/usr/bin/env node

/**
 * Prisma query field-name safety check (Consolidation Programme C3 / ARR-0039).
 *
 * WHY THIS EXISTS
 * --------------
 * `db` in `src/lib/db.ts` is the generated Prisma client wrapped with a query-component
 * `$extends` (tenant RLS) and cast `as unknown as PrismaClient`. The cast preserves the
 * generated method signatures exactly — the extension does NOT weaken typing. However,
 * TypeScript + Prisma's generated `SelectSubset<T, U>` helper stop applying excess-property
 * checking to the *nested* `select` / `include` / `where` / `data` object once the query-args
 * object literal has two or more keys (e.g. `where` + `select` together). This is a generic
 * Prisma/TS limitation and reproduces identically on the raw, un-extended `PrismaClient`.
 *
 * Consequence: `db.match.findFirst({ where: {...}, select: { id: true, type: true } })` where
 * the real field is `matchType` passes `tsc` and `eslint` and only throws
 * `PrismaClientValidationError` at runtime — exactly the production "Follow live" incident
 * recorded in ARR-0039.
 *
 * WHAT THIS DOES
 * -------------
 * Statically scans every `<client>.<model>.<method>({...})` call in `src/` (excluding the
 * generated client and this script's own fixtures), extracts the *explicitly written* keys of
 * each nested `select` / `include` / `where` / `data` / `orderBy` / `omit` object literal, and
 * re-checks those keys by direct assignment to the concrete generated Prisma input type
 * (`Prisma.<Model>Select` etc.) in a throwaway probe file. Direct assignment to a concrete type
 * DOES trigger excess-property checking regardless of key count, so an invalid field name is
 * reported here — before runtime — with the original file:line.
 *
 * Spreads (`...orgFilter`), computed keys, and nested relation sub-objects are not expanded
 * (their values are replaced with `0 as never`); this check validates the *set of top-level
 * keys the author typed*, which is where the ARR-0039 class of bug lives. `data` keys are only
 * flagged when rejected by BOTH the checked and unchecked input variants, to avoid
 * false-positives on nested relation writes vs. raw FK writes.
 *
 * Usage:   node scripts/check-prisma-query-fields.mjs
 * Exit 0 — no invalid fields.  Exit 1 — invalid field(s) found.  Exit 2 — check itself failed.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const SRC_DIR = join(REPO_ROOT, "src");
const SCHEMA_PATH = join(REPO_ROOT, "prisma", "schema.prisma");
const WORK_DIR = join(REPO_ROOT, "node_modules", ".cache", "prisma-field-check");

/** Prisma delegate methods whose first argument carries select/include/where/data. */
const QUERY_METHODS = new Set([
  "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "findMany",
  "create", "createMany", "createManyAndReturn",
  "update", "updateMany", "updateManyAndReturn", "upsert",
  "delete", "deleteMany", "count", "aggregate", "groupBy",
]);
const CREATE_METHODS = new Set(["create", "createMany", "createManyAndReturn"]);
const UPDATE_METHODS = new Set(["update", "updateMany", "updateManyAndReturn"]);
/** Identifiers that, when the root of a `.<model>.<method>()` chain, denote a Prisma client. */
const CLIENT_ROOTS = new Set(["db", "tx", "prisma", "rawClient", "rawPrisma", "client"]);

function fail(msg) {
  console.error(`\n[check-prisma-query-fields] ${msg}`);
  process.exit(2);
}

/** Model names declared in the Prisma schema. */
function readSchemaModels() {
  let text;
  try {
    text = readFileSync(SCHEMA_PATH, "utf8");
  } catch {
    fail(`cannot read ${relative(REPO_ROOT, SCHEMA_PATH)}`);
  }
  const models = new Set();
  const re = /^\s*model\s+([A-Za-z_]\w*)\s*\{/gm;
  let m;
  while ((m = re.exec(text))) models.add(m[1]);
  if (models.size === 0) fail("parsed zero models from schema.prisma");
  return models;
}

/** All *.ts / *.tsx under src/, excluding generated client, tests' snapshots, and node_modules. */
function collectSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(REPO_ROOT, full);
    if (rel.startsWith("src/generated/")) continue;
    if (entry === "node_modules") continue;
    const st = statSync(full);
    if (st.isDirectory()) collectSourceFiles(full, out);
    // `.test-d.ts` files deliberately contain invalid queries guarded by `@ts-expect-error`.
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".d.ts") && !entry.endsWith(".test-d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Each kind maps to the generated Prisma type(s) whose `keyof` is the set of valid top-level
 * keys. `data` accepts a key present in EITHER the checked or the unchecked input variant
 * (nested relation write vs. raw FK write), so both are unioned.
 */
const KIND_TO_TYPE = {
  select: (model) => [`Prisma.${model}Select`],
  include: (model) => [`Prisma.${model}Include`],
  omit: (model) => [`Prisma.${model}Omit`],
  // `where` accepts either the general filter shape or, for findUnique/update/delete/upsert, the
  // unique shape (which is where a `@@unique([a,b])` surfaces as the compound `a_b` key).
  where: (model) => [`Prisma.${model}WhereInput`, `Prisma.${model}WhereUniqueInput`],
  orderBy: (model) => [`Prisma.${model}OrderByWithRelationInput`],
  dataCreate: (model) => [`Prisma.${model}CreateInput`, `Prisma.${model}UncheckedCreateInput`],
  dataUpdate: (model) => [`Prisma.${model}UpdateInput`, `Prisma.${model}UncheckedUpdateInput`],
};

/** Extract top-level property-name keys actually written in an object literal. */
function literalKeys(objLiteral) {
  const keys = [];
  for (const prop of objLiteral.properties) {
    if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
      const name = prop.name;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name)) keys.push(name.text);
    }
    // SpreadAssignment / computed / method — skipped (not statically an author-typed key).
  }
  return keys;
}

function analyseFile(file, models, probes) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relFile = relative(REPO_ROOT, file);

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.arguments.length >= 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const method = node.expression.name.text;
      const delegateExpr = node.expression.expression; // <root>.<model>
      if (
        QUERY_METHODS.has(method) &&
        ts.isPropertyAccessExpression(delegateExpr) &&
        ts.isIdentifier(delegateExpr.expression)
      ) {
        const rootName = delegateExpr.expression.text;
        const delegateName = delegateExpr.name.text;
        const model = delegateName.charAt(0).toUpperCase() + delegateName.slice(1);
        if (CLIENT_ROOTS.has(rootName) && models.has(model)) {
          const argObj = node.arguments[0];
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          for (const prop of argObj.properties) {
            if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
            const key = prop.name.text;
            const value = prop.initializer;
            if (!ts.isObjectLiteralExpression(value)) continue;
            let kind = null;
            if (key === "select" || key === "include" || key === "where" || key === "omit" || key === "orderBy") {
              kind = key;
            } else if (key === "data") {
              kind = CREATE_METHODS.has(method) ? "dataCreate"
                : UPDATE_METHODS.has(method) ? "dataUpdate" : null;
            }
            if (!kind) continue;
            const keys = literalKeys(value);
            if (keys.length === 0) continue;
            probes.push({
              file: relFile,
              line: line + 1,
              kind,
              model,
              keys,
              types: KIND_TO_TYPE[kind](model),
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

function buildProbe(probes) {
  const lines = [
    "// AUTO-GENERATED by scripts/check-prisma-query-fields.mjs — do not edit / do not commit.",
    'import type { Prisma } from "@/generated/prisma/client";',
    "",
  ];
  // meta: 1-based tsc line number -> { probeIndex, key }
  const meta = new Map();
  probes.forEach((p, i) => {
    const keyofUnion = p.types.map((t) => `keyof (${t})`).join(" | ");
    for (const key of p.keys) {
      // `true` is assignable to `false` only via TS2322 -> key is NOT in the valid key set.
      lines.push(`const _c${i}_${lines.length}: (${JSON.stringify(key)} extends ${keyofUnion} ? true : false) = true;`);
      meta.set(lines.length, { probeIndex: i, key }); // this line's 1-based number
    }
  });
  return { text: lines.join("\n") + "\n", meta };
}

function runTsc(probeFile) {
  const tsconfig = join(WORK_DIR, "tsconfig.probe.json");
  writeFileSync(
    tsconfig,
    JSON.stringify(
      {
        compilerOptions: {
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          module: "esnext",
          moduleResolution: "bundler",
          target: "es2022",
          // No baseUrl (deprecated in TS 6): `paths` resolves relative to this tsconfig's dir,
          // so map with an absolute glob into the repo's src tree.
          paths: { "@/*": [join(REPO_ROOT, "src", "*")] },
          types: [],
        },
        include: [probeFile],
      },
      null,
      2,
    ),
  );
  try {
    execFileSync(
      process.execPath,
      [join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfig],
      { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    return "";
  } catch (err) {
    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
}

function main() {
  const models = readSchemaModels();
  // Default scan target is src/; an explicit path arg is used by the self-test fixture.
  const scanRoot = process.argv[2] ? resolve(process.argv[2]) : SRC_DIR;
  const files = collectSourceFiles(scanRoot);
  const probes = [];
  for (const f of files) analyseFile(f, models, probes);

  if (probes.length === 0) {
    console.log("[check-prisma-query-fields] no analysable db.<model> query literals found.");
    return;
  }

  mkdirSync(WORK_DIR, { recursive: true });
  const probeFile = join(WORK_DIR, "probe.ts");
  const { text, meta } = buildProbe(probes);
  writeFileSync(probeFile, text);

  const output = runTsc(probeFile);

  // Each probe line asserts `"<key>" extends keyof <Type> ? true : false` = true.
  // TS2322 on that line => the conditional resolved to `false` => the key is invalid.
  const violations = [];
  const errRe = /probe\.ts\((\d+),\d+\): error TS2322\b/g;
  let m;
  while ((m = errRe.exec(output))) {
    const info = meta.get(Number(m[1]));
    if (info) violations.push({ ...probes[info.probeIndex], key: info.key });
  }

  // Any non-TS2322 error means a probe type name didn't resolve (e.g. a model without a given
  // input type) — the check cannot be trusted then. Fail loudly rather than silently pass.
  const otherErrors = output
    .split("\n")
    .filter((l) => /error TS/.test(l) && !/error TS2322\b/.test(l));
  if (otherErrors.length > 0) {
    console.error("[check-prisma-query-fields] unexpected tsc errors in probe — check is inconclusive:");
    for (const l of otherErrors.slice(0, 20)) console.error("  " + l);
    process.exit(2);
  }

  rmSync(WORK_DIR, { recursive: true, force: true });

  if (violations.length === 0) {
    console.log(
      `[check-prisma-query-fields] OK — ${probes.length} query literal(s) checked, no invalid fields.`,
    );
    return;
  }

  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  console.error(
    `\n[check-prisma-query-fields] ${violations.length} invalid Prisma field(s) — these fail only at runtime:\n`,
  );
  for (const v of violations) {
    const typeLabel = v.kind.startsWith("data")
      ? `${v.model} ${v.kind === "dataCreate" ? "create" : "update"} data`
      : v.types[0]; // e.g. "Prisma.MatchSelect", "Prisma.MatchWhereInput"
    console.error(`  ${v.file}:${v.line}  '${v.key}' is not a field of ${typeLabel}`);
  }
  console.error("");
  process.exit(1);
}

try {
  main();
} catch (err) {
  fail(err?.stack ?? String(err));
}
