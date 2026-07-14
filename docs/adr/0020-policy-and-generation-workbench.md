# ADR 0020: Policy and Generation Workbench

## Status

Proposed

## Context

Matchboard's policy pipeline (core invariants → default TypeScript policy → optional Rego/Wasm) and generation engine (league rounds, event squads, lineups, helpers) produce complex decisions. When a player is blocked, a score adjustment is applied, or a squad is generated in an unexpected way, coaches and developers need to understand why.

Currently, policy and generation behavior can only be inspected through:
- CLI dry-run scripts (`scripts/policy-dry-run.mjs`)
- Admin API endpoints that read config state (`/api/admin/policy`)
- Test fixtures that exercise specific scenarios
- Direct database queries on plan integrity signals and explanations

There is no unified tool for:
- Dry-running policy against specific inputs without committing changes
- Comparing default-only vs Rego-enabled policy results
- Seeing which policy layer produced a specific block, warning, or adjustment
- Understanding what input the engine used for a specific decision
- Running generation in a sandbox without persisting results

## Decision

Create a Policy and Generation Workbench — a logged-in-user tool for inspecting and dry-running policy and generation behavior.

Key design decisions:

1. **Dry-run only.** The workbench never commits generated squads, league selections, lineups, helpers, reports, or policy changes. It reads and evaluates but does not write.

2. **Fixture-based input.** Primary input source is anonymized JSON fixtures stored in `test/fixtures/workbench/`. The workbench can also load real app data (summarized safely, not raw rows).

3. **Policy source attribution.** Each block, warning, score adjustment, and explanation carries a `source` field indicating which policy layer produced it: `core`, `default_policy`, or `rego`.

4. **Policy diff.** A diff helper compares default-only vs Rego-enabled evaluation, showing what Rego added or changed.

5. **Authenticated-user access.** The workbench is available to all logged-in users. When Matchboard introduces admin/developer roles, this route should move behind that permission boundary.

6. **No in-app policy editing.** The workbench is for inspection and understanding, not for modifying policy rules, uploading Rego, or runtime compilation.

7. **No raw data exposure.** Real app data is summarized in the UI. Full raw JSON is available only in a collapsed developer section with fixture-only or sanitized content.

8. **Both league and event contexts.** The workbench supports all six `PolicyDecisionType` values and both `PolicyMode` values.

9. **Service layer outside React.** All workbench logic lives in `src/lib/workbench/`, testable without UI components.

10. **CLI parity.** The existing `npm run policy:dry-run` CLI script continues to work. A new `npm run workbench:dry-run` script supports fixture-based dry-runs from the command line.

## Consequences

### Positive
- Coaches and developers can understand why specific policy decisions were made
- Default vs Rego comparison is possible without manual scripting
- Fixture-based dry-runs provide reproducible test scenarios
- Generation behavior is inspectable without committing data
- Policy source attribution makes the three-layer pipeline transparent

### Negative
- Additional route and page to maintain
- Fixture files need maintenance when policy input schemas change
- Real data lookup requires care to avoid leaking player information

### Risks
- Exposing policy internals to all authenticated users — mitigated by documentation stating future admin-only access
- Fixture schema drift — mitigated by fixture tests that validate against current types

## Rejected alternatives

- **In-app Rego editor:** Too risky without proper validation, testing, and role model
- **Policy upload UI:** Would enable arbitrary policy changes without review
- **Public diagnostics route:** Would expose internal system behavior
- **Admin-only route before admin model exists:** Would create a fake admin role
- **Manual debugging through logs only:** Insufficient for understanding complex policy interactions
- **Committing generated output from diagnostic view:** Violates dry-run-only principle