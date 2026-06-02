# Spec: Player Profile Refactor

## Objective

Refactor the Player Detail page from a sparse stacked-panel layout into a Football Manager-inspired player profile with inline editing. The profile is the form — clean by default, editable on click. No separate edit section.

## Tech Stack

- Next.js 16 App Router, TypeScript, Tailwind, Prisma, PostgreSQL
- motion (installed), lucide-react (installed), cva (installed), clsx+tailwind-merge (cn utility)
- Existing server actions for mutations

## Commands

- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Dev: `npm run dev`

## Boundaries

- Always: preserve existing server actions, keep tests passing, respect AGENTS.md domain rules
- Never: change database schema, add new player attributes, use stars as main visual pattern, expose raw JSON in UI, create a separate edit section
- Ask first: adding new npm dependencies, changing shared component APIs

## Success Criteria

1. Player profile is a three-column FM-inspired layout, not stacked panels
2. All existing editable fields remain editable inline (click to edit)
3. No separate "Edit player" section exists
4. Player attributes display as compact number tiles, not star ratings
5. Readiness signals use segmented controls, not toggle buttons
6. Movement history uses MovementArrow-style rows
7. Explanations show human-readable text, not raw JSON
8. Destructive actions (remove, set inactive) are in a header overflow menu
9. PositionMap shows a detailed FM-style SVG pitch with position markers
10. All tests pass, build succeeds

## Implementation Plan

1. Shared inline-edit primitives (InlineEditField, InlineEditSelect, InlineEditSegmented)
2. PositionMap SVG component
3. Explanation formatter utility
4. Player profile layout + header
5. Player identity panel (left column)
6. Player coaching context panel (center column)
7. Player stats/history panel (right column)
8. Integration: wire up data, actions, and the full page
9. Remove old edit form from detail page, cleanup
10. QA: lint, typecheck, test, build