# Example Policies

This directory contains example Rego policies that are not deployed but serve as reference implementations.

## Structure

- `rego/` — Standalone example Rego files
- `packs/` — Complete example policy packs with metadata and fixtures

## Example Rego files

- `equal_opportunity.rego` — Boosts players with low recent match count
- `goalkeeper_coverage.rego` — Strict goalkeeper coverage warnings

## Example packs

- `custom-example/` — Demonstrates equal opportunity, goalkeeper coverage, event pool exclusion, and league period fairness

## Running example tests

```bash
npm run policy:test:examples
```

## Using an example as a starting point

1. Copy the pack directory to `policies/packs/<your-pack-id>/`
2. Edit `policy-pack.json` to set your pack ID and entrypoint
3. Set `"deployable": true` to make it a deployable pack
4. Edit the Rego source files
5. Run `npm run policy:sync` to test and compile