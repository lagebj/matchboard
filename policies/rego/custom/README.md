# Custom Rego Policies

Place custom Rego policy files here.

Custom policies must use the `matchboard.selection` package and export a `decision` rule.

See `docs/admin/policy-management.md` for the full workflow.

## Quick start

1. Copy an example policy from `policies/rego/examples/`
2. Edit it to match your instance requirements
3. Run `npm run policy:test` to test
4. Run `npm run policy:build` to compile to Wasm
5. Run `npm run policy:dry-run` to verify
6. Commit source and compiled artifact
7. Set `MATCHBOARD_POLICY_REGO_ENABLED=true` to enable