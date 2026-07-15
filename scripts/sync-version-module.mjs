#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const PKG_PATH = resolve(ROOT, "package.json");
const VERSION_MODULE_PATH = resolve(ROOT, "src/lib/version/index.ts");

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
const version = pkg.version;

const content = `export const APP_VERSION = "${version}";\n`;

writeFileSync(VERSION_MODULE_PATH, content, "utf-8");

console.log(`Updated src/lib/version/index.ts to version ${version}`);