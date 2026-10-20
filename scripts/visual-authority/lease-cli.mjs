#!/usr/bin/env node
// ADR-0159 — thin CLI over test-slot-lease.mjs, for workflow `run:` steps to call instead of
// shelling out to `gh variable ...` (which the default GITHUB_TOKEN cannot write at all — see
// test-slot-lease.mjs's header comment for the real HTTP 403 that proved this).
//
// Usage:
//   node lease-cli.mjs get              -> prints the current lease as one line of JSON
//   node lease-cli.mjs set '<json>'     -> replaces the lease wholesale
//   node lease-cli.mjs clear            -> resets to the empty/released lease
//
// Required env: GH_TOKEN, GITHUB_REPOSITORY (owner/repo)

import { getLease, setLease, clearLease } from "./test-slot-lease.mjs";

const token = requireEnv("GH_TOKEN");
const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
const [, , command, arg] = process.argv;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function fetchImpl(path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "matchboard-visual-authority-gate",
      ...(init.headers ?? {}),
    },
  });
}

const ctx = { owner, repo, fetchImpl };

async function main() {
  if (command === "get") {
    console.log(JSON.stringify(await getLease(ctx)));
    return;
  }
  if (command === "set") {
    if (!arg) throw new Error("Usage: lease-cli.mjs set '<json>'");
    await setLease(ctx, JSON.parse(arg));
    return;
  }
  if (command === "clear") {
    await clearLease(ctx);
    return;
  }
  throw new Error(`Usage: lease-cli.mjs <get|set '<json>'|clear>, got "${command}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
