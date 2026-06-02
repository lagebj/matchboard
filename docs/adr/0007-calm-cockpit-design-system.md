---
type: ADR
id: "0007"
title: Calm coach-cockpit design system and shared UI primitives
status: active
date: 2026-06-02
supersedes:
superseded_by:
tags: [design-system, ui, accessibility, primitives]
---

## Context

Matchboard's UI had accumulated three competing visual languages and many duplicated raw-Tailwind patterns:

1. A "frosted" surface (`rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)]`) used across most pages.
2. A "raw zinc" surface (`rounded-md border border-zinc-700/40 bg-zinc-800/20`) used inside the assistant feature.
3. An oversized hero treatment (`rounded-[1.6rem]/[1.9rem]`, `tracking-[0.22em]` eyebrows, `app-panel-raised` gradients) used only in `team-detail.tsx` and `player-editor-form.tsx`.

Beyond surface inconsistency, the same modal markup was repeated five times (clear round, finalize match, unfinalize round, decision modal, recommendation modal), six distinct button shapes existed for the same primary-action concept, and three competing PlayerChip implementations ran in parallel. Status colour usage was inconsistent — semantic tokens (`--accent`, `--warning`, `--danger`, `--info`, `--dev`) were defined but most components still used raw `bg-emerald-900/20`, `border-amber-700/40`, etc. Plan-integrity banners dominated screens even when no blocker existed.

The effect was a UI that looked like a dark admin console rather than a coach-facing operations cockpit, with excess visual noise that obscured the question every screen must answer: "what needs attention now?"

This work introduces durable design rules. Without an ADR, future tasks will reintroduce the noise. The change is design-affecting (not architecture-affecting): no schema, no public API, no auth, no domain logic, no contracts change.

## Decision

Adopt a single calm-cockpit design system, expressed as shared UI primitives and a tightened token set. Future user-facing work must use these primitives instead of inlining raw Tailwind patterns.

1. **One quiet surface system.** All panels, cards, banners, and dialogs use the `Surface` primitive (`src/components/ui/surface.tsx`). Variants: `default | raised | subtle | active | danger | warning | success | info`. Default is matte and uses spacing/background contrast rather than borders. Raised surfaces are reserved for the highest-priority single moment on a page; multiple raised surfaces on one page is a design smell. Bespoke radii (`rounded-[1.4rem]`, `rounded-[1.6rem]`, `rounded-[1.9rem]`) are no longer used.

2. **Stronger hierarchy, fewer borders.** Page structure relies on type hierarchy (`PageHeader`, `SectionHeader`) and spacing first; borders are a hairline that should not draw the eye. The `app-panel` and `app-panel-raised` legacy CSS classes are removed.

3. **Decision-first plan integrity.** Plan integrity signals use the `DecisionBanner` primitive with strict variants: `blocked` (red, hard stop), `decision` (amber, coach judgement required), `note` (slate, informational), `finalized` (green, locked), `success` (calm confirmation). Banners appear only when their condition is true. Planning notes are collapsed by default. Generic "warning" colour is forbidden — every coloured banner must carry one of the four meanings above.

4. **One status pill family.** `StatusPill` (`src/components/ui/status-pill.tsx`) replaces ad-hoc badges. Variants: `neutral | success | warning | danger | info | development | support | core | locked | finalized`. Status text is always readable without relying on colour. Existing domain badges (`RoleBadge`, `SignalBadge`, `StatusBadge`) are kept as thin wrappers over `StatusPill` for backwards compatibility.

5. **One button hierarchy.** `Button` (`src/components/ui/button.tsx`) variants: `primary | secondary | ghost | danger | warning | quiet`. One primary per page region. Reopen/unfinalize uses `warning`, not `danger`. The lone `bg-blue-600/80` save button in `team-reflection-section.tsx` is removed.

6. **One PlayerChip.** `PlayerChip` (`src/components/ui/player-chip.tsx`) replaces three inline duplicates. Default chip shows name + position + role marker. Verbose metadata moves to selected state, tooltip, expanded row, or inspector. Role colours are subtle and never visually imply permanent ranking.

7. **Other shared primitives.** `PageHeader`, `SectionHeader`, `EmptyState`, `DataTable`, `TabRail`, and `Dialog` are introduced. The same modal markup that was previously inlined five times now lives in `Dialog`.

8. **Token discipline.** `globals.css` introduces softer default borders, clearer surface levels (`base`, `raised`, `muted`, `hover`), and a refined typography rhythm. Semantic colour tokens (`--accent`, `--warning`, `--danger`, `--info`, `--dev`, plus their `-subtle` variants) become the canonical way to express state. Raw Tailwind colour classes (`bg-emerald-900/20`, `border-amber-700/40`, etc.) are forbidden in new component code.

9. **Accessibility floor.** Visible focus states, readable contrast (WCAG 2.2 AA), keyboard reachability, and non-colour status indicators are non-negotiable. Plan-integrity colours always carry a textual label and an icon or shape.

10. **Dark theme remains.** No light-mode work in this change. The cockpit is dark by design and intentionally calm.

## Alternatives considered

- Option 1: Keep the existing three visual languages and only add new primitives where missing — rejected because the underlying noise (border dominance, raised hero treatment, banner saturation) would persist.
- Option 2: Adopt a third-party design system (shadcn/ui, Radix Themes) — rejected because Matchboard's domain semantics (movement, support, development, plan integrity) need bespoke variants, and the existing token set is already coherent.
- Option 3: Preserve the oversized `team-detail` hero language for marquee surfaces — rejected because it competes with the page title in the new top bar and signals "profile landing page" rather than "workspace".
- Option 4: Rename domain concepts in code as part of the copy cleanup — rejected because it would expand scope into a domain-model change. Copy cleanup only touches visible labels, never enum values, route names, or domain types.

## Consequences

- Positive: One coherent visual system. Fewer borders. Stronger hierarchy. Calmer planning surfaces. Repeated modal/dialog markup eliminated.
- Positive: Coach can identify the next action faster because warnings only appear when warranted.
- Positive: Future UI work has a clear primitive vocabulary; raw Tailwind colour classes are now a code-review red flag.
- Positive: PlayerChip no longer visually implies permanent ranking.
- Positive: All existing domain rules (selection engine, plan integrity, fairness, finalization, manual override, child-safety language) remain unchanged.
- Negative: The "designed" hero feel of `team-detail.tsx` is intentionally muted. Some users may miss the visual signature.
- Negative: Visual diff is large because most user-facing files are touched.
- Neutral trade-offs: Some inline class strings become longer when migrating to primitives in the same commit; net code volume drops over time as duplicated markup collapses into primitive usage.

## Re-evaluation triggers

- If user feedback shows the calm direction reduces decisiveness rather than increasing it.
- If a future feature requires light-mode support (would require a token-level rework).
- If a new domain concept needs a primitive that doesn't fit any existing variant (in which case extend the primitive rather than re-introducing raw Tailwind).
- If accessibility audits surface contrast or focus regressions introduced by the softer borders.
