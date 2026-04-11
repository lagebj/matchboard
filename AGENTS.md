<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Matchboard agent instructions

Matchboard is a local-first web app for youth football match selection, player rotation, and squad history tracking.

## Stack
- Next.js App Router
- TypeScript
- Tailwind
- Prisma
- SQLite

## Product boundaries
- Local-first only
- No auth
- No multi-user features
- No batch scheduling
- One match at a time
- Finalized selections become history and affect future selections

## Source of truth
The behavioral source of truth is:
- `features/matchboard.feature`

When implementing logic, UI, tests, or data flows:
- follow the Gherkin feature file first
- do not invent rules that are not expressed there unless explicitly requested
- if code and Gherkin conflict, treat the Gherkin as correct
- keep workbook-specific assumptions out of the implementation

## Domain context
- `docs/domain.md` is the shared domain model and terminology reference
- read it before changing schema, domain logic, explanations, or domain naming
- if `docs/domain.md` and `features/matchboard.feature` conflict, treat the Gherkin as correct

## Architecture rules
- Keep selection logic out of React components
- Put selection logic in `src/lib/selection/*`
- Put rule loading and validation in `src/lib/rules/*`
- Keep UI, rules config, and selection engine separate
- Prefer explicit domain code over generic abstractions

## Data safety
- Never commit real player names or private roster data
- Real player data stays only in ignored local files or local SQLite DB
- Example/demo data in the repo must be fake

## Implementation priorities
Build only what is needed for:
1. player registry
2. match creation
3. single-match selection generation
4. finalized selection history
5. human-readable explanations for selection decisions

## Coding style
- Prefer small files
- Prefer clear names over short names
- Return explanation objects from selection logic
- Validate inputs at boundaries
- Keep UI calm and operational

## Rules model
- Gherkin describes expected behavior
- RuleConfig stores editable thresholds and toggles
- selection engine code applies those rules
- Gherkin is not runtime config
- UI should edit RuleConfig, not duplicate rule logic
