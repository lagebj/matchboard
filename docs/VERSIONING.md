# Matchboard Versioning Policy

Matchboard uses Semantic Versioning in the `0.x.y` range during its current pre-1.0 development phase.

## Version format

```
MAJOR.MINOR.PATCH
```

During pre-1.0: `0.MINOR.PATCH`

## Canonical version source

```
package.json → version
```

One canonical source. All other consumers derive from this value.

- `src/lib/version/index.ts` is derived at build time via `npm run prebuild` (which runs `sync-version-module`).
- `package-lock.json` is synced by `npm install --package-lock-only` after any version change.
- No other files may hard-code the application version independently.

## Classification rules

### MINOR bump (0.x.y → 0.(x+1).0)

Increment MINOR when the change introduces a meaningful new capability, changes product behaviour substantially, changes an important domain model, or introduces a breaking pre-1.0 change.

Examples:

- New user-facing feature
- New major workflow
- New Team/Event/Match capability
- New domain concept
- Significant selection-engine behaviour change
- New reporting/export capability
- Substantial permissions model change
- Schema changes introducing meaningful new product behaviour
- API/interface changes that existing consumers would need to adapt to
- Removal or replacement of existing behaviour
- Meaningful navigation/information-architecture changes
- Breaking pre-1.0 changes (while MAJOR is locked at 0)

When MINOR increments, PATCH resets to zero.

### PATCH bump (0.x.y → 0.x.(y+1))

Increment PATCH when the change improves, fixes, hardens, or refines existing behaviour without introducing a meaningful new product capability.

Examples:

- Bug fixes
- Security hardening without material product-contract change
- Performance improvements
- Routing fixes
- UI corrections
- Accessibility fixes
- Test improvements accompanying an existing-behaviour fix
- Dependency upgrades without meaningful product changes
- Internal refactoring
- Reliability improvements
- Small UX refinements to an existing workflow
- Tooling/CI changes affecting build, test, or deploy
- Database migration adding an index or correcting a safe default

### No version bump

Changes that cannot affect a deployed Matchboard application or its supported development/release environment:

- Typo-only documentation changes
- README clarification
- Comment-only changes
- Non-functional formatting
- Purely explanatory ADR/documentation changes

Tooling or infrastructure changes that affect build, test, deploy, or security should normally receive at least a PATCH increment.

## Mixed change sets

Use the highest applicable version increment:

- Feature + bug fixes = MINOR
- Breaking pre-1.0 change + fixes = MINOR
- Several unrelated fixes = PATCH

Never increment the version multiple times within one logical change set.

The unit of versioning is the releasable product change, not the individual Git commit.

## Pre-1.0 breaking changes

While MAJOR is locked at 0:

- PATCH = compatible correction/refinement
- MINOR = new capability or potentially incompatible product evolution
- MAJOR remains 0

A breaking change such as `0.21.3` becomes `0.22.0`, not `1.0.0`, unless the product owner explicitly authorises v1.

This is an intentional deviation from strict SemVer's "breaking = major" rule, using SemVer's own `0.x` convention: "anything may change at any time."

## Major version

Do NOT increment the major version beyond 0 unless explicitly instructed by the product owner.

`1.0.0` represents a deliberate product maturity/release decision. No coding agent may infer `1.0.0` automatically.

## Version bump commands

```bash
npm run version:patch   # 0.2.0 → 0.2.1
npm run version:minor   # 0.2.0 → 0.3.0
```

These commands:

- Update `package.json` version
- Sync `src/lib/version/index.ts`
- Update `package-lock.json`
- Do NOT create a Git commit
- Do NOT create a Git tag
- Do NOT publish anything

The coding agent should use these as part of its normal completion workflow after classifying the change set.

## CI validation

CI validates that:

1. The canonical version is valid SemVer (`0.MINOR.PATCH`)
2. While pre-1.0, the version does not exceed `0.x.y` (no `1.0.0` or higher without explicit authorisation)
3. `src/lib/version/index.ts` is consistent with `package.json`

Run locally: `npm run version:verify`

## Database migrations

A database migration does not automatically determine the version increment. Classify based on product impact:

- New persistence required for a new feature → MINOR
- Adding an index to improve an existing query → PATCH
- Correcting a safe default → PATCH
- Large incompatible domain/schema redesign → MINOR (while pre-1.0)

## Dependencies

- Routine dependency update with no product-visible change → PATCH
- Security dependency update → PATCH
- Runtime/framework migration with material behavioural change → MINOR
- Dependency change enabling a new feature → classify based on the feature, normally MINOR

## Coding-agent completion workflow

Before completing any substantive implementation:

1. Determine the current application version from `package.json`.
2. Classify the overall change set as `none`, `patch`, or `minor` per this document.
3. Apply exactly one appropriate version bump using `npm run version:patch` or `npm run version:minor`.
4. Run the normal validation/tests.
5. Report the previous and new versions in the completion summary.

Example:

```
Version: 0.2.0 → 0.2.1
Classification: patch
Reason: Bug fix for Event deletion and routing correction without new product capability.
```

## Version bump anti-patterns

Do NOT infer version bumps from:

- Commit count
- PR count
- Branch names
- Date
- Number of changed files

Version numbers describe the resulting product change, not the process that produced it.

## Git tags and releases

Updating the application version is part of normal implementation. Do NOT automatically:

- Create Git tags
- Create GitHub Releases
- Publish npm packages
- Deploy production
- Push tags

Those are release operations that require explicit instruction.

The version format must remain directly usable as a Git tag: `v0.2.1`

## Scope

This policy covers version decision, application version, and tested releasable commits.

Release notes, GitHub Releases, automated deployment promotion, changelog generation, release branches, and production tagging are separate concerns to be added when needed.