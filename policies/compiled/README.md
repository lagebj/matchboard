This directory contains the compiled Wasm policy artifact.

The file `matchboard_selection.wasm` is compiled from `policies/rego/matchboard_selection.rego`
using the OPA CLI and the build script `scripts/build-opa-policy.mjs`.

Do not edit the compiled Wasm artifact directly.
Edit Rego source in `policies/rego/`, then run `npm run policy:build` to recompile.