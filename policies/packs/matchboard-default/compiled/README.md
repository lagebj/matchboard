This directory contains the compiled Wasm policy artifact for the matchboard-default policy pack.

The file `matchboard_selection.wasm` is compiled from `policies/packs/matchboard-default/rego/matchboard_selection.rego`
using the OPA CLI and the build script `scripts/policy-build.mjs`.

Do not edit the compiled Wasm artifact directly.
Edit Rego source in `policies/packs/matchboard-default/rego/`, then run `npm run policy:build -- --pack matchboard-default` to recompile.