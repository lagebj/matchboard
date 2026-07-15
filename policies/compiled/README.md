This directory contains the compiled Wasm policy artifact for the legacy flat structure.

**Note:** The primary policy management structure is now policy packs under `policies/packs/`. This legacy directory is preserved for backward compatibility. New deployments should use policy packs.

The file `matchboard_selection.wasm` is compiled from `policies/rego/matchboard_selection.rego`
using the OPA CLI and the build script `scripts/build-opa-policy.mjs`.

For the pack-based structure, use:
- `policies/packs/matchboard-default/compiled/matchboard_selection.wasm`
- Build with: `npm run policy:build -- --pack matchboard-default`

Do not edit the compiled Wasm artifact directly.
Edit Rego source, then run `npm run policy:build` (legacy) or `npm run policy:build -- --pack <id>` (pack-based) to recompile.