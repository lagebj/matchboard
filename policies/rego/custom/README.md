# Custom Rego Policies

Place custom Rego policy files here for the legacy flat structure.

**Note:** The primary policy management structure is now policy packs under `policies/packs/`. See `policies/examples/packs/custom-example/` for the recommended pack-based approach.

For the legacy flat structure, custom policies must use the `matchboard.selection` package and export a `decision` rule.

See `docs/admin/policy-management.md` for the full workflow.

## Quick start (legacy)

1. Copy an example policy from `policies/rego/examples/`
2. Edit it to match your instance requirements
3. Run `npm run policy:test` to test
4. Run `npm run policy:build` to compile to Wasm
5. Run `npm run policy:dry-run` to verify
6. Commit source and compiled artifact
7. Set `MATCHBOARD_POLICY_WASM_PATH` to point at the compiled artifact (Rego evaluation itself always runs — there is no separate enable flag, ADR-0107)

## Quick start (pack-based, recommended)

1. Create a pack directory under `policies/packs/<your-pack-id>/`
2. Add `policy-pack.json` metadata (schema v2: `entrypoints`, optionally `failureMode`)
3. Place Rego source in `rego/` subdirectory
4. Run `npm run policy:validate -- --pack <your-pack-id>`
5. Run `npm run policy:build -- --pack <your-pack-id>`
6. Run `npm run policy:dry-run -- --pack <your-pack-id> <fixture>`
7. Set `MATCHBOARD_POLICY_PACK_ID=<your-pack-id>` to activate it