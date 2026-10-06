# Kawdly People — Bold Editorial / Ledger

The visual identity for KAWDLY PEOPLE, an HR platform. Approved direction: **Bold Editorial**, refined into its **Ledger / Command Console** variant — confident, navy-dominant, and dense enough to read as a precision instrument rather than a soft SaaS dashboard.

Extracted from `HR Dashboard Ledger EN.dc.html`, the mockup approved 2026-09-30. Every token in `tokens.json` was re-verified against that exact file by script — colors and font sizes are not approximations.

## How to use this system

Read `tokens.json` for every exact value. Read this file for the *why* behind them, so a new page stays recognizably the same product instead of drifting page-to-page.

If you need a value this system doesn't have yet (a new color, a new type size, a new spacing step), **don't invent one silently** — check whether an existing token can honestly serve the purpose first, and if not, say so explicitly so it can be added here and reused everywhere, not left as a one-off hex buried in a component.

## Three decisions that make this "Bold," not just dark

Everything else follows from these. Drop any one of them and the system reads as a generic dark-header dashboard instead of a deliberate identity.

1. **Grayscale photography, always.** Every person photo — avatars, the decision-queue stacks, the "Coming up" list, the header user photo — is desaturated (`filter: grayscale(1)`, the header user photo adds `contrast(1.05)`). A color photo here reads as generic stock-photo warmth; grayscale reads as editorial and considered. This is non-negotiable across every future page: if a page shows a person, their photo is grayscale.
2. **Sharp-and-pill, mixed on purpose.** Almost every surface uses `radius-sm` (3px) — logo tile, buttons, cards, photos. The *only* fully rounded shapes are pills: tags, chips, the coral CTA, the search field, count badges. Never let a card creep toward "friendly" 12-20px rounding, and never make a pill element sharp — the contrast between the two is the point.
3. **Hairline structure, no shadows.** Sections separate from each other by a 1px grid (the `hairline` color filling the gap between blocks), not by elevation. `shadow` has zero tokens on purpose. Adding a `box-shadow` to a card is the single fastest way to pull this back toward a generic template look.

## Color

One theme (light) — see `tokens.json` for every hex. The palette is deliberately narrow: **navy** (trust, primary actions, the dominant surface) and **coral** (urgency, the one CTA color, identity accents). There is no separate green/red success-vs-error pair — this system signals attention with navy-vs-coral, not traffic lights. If a genuinely destructive action (delete, irreversible) is needed later, that's an open decision, not something to invent by reaching for red.

**Known, flagged issue:** plain `coral` (#E4714E) against white measures 3.10:1 — it passes for large text (24px+) and decorative fills, but the source file currently uses it at small sizes twice ("Urgent" tag text, the CTA button label) where it technically fails WCAG AA (4.5:1). This is documented on the `coral` token itself. It hasn't been silently patched with an invented darker variant — that's a call to make deliberately, not something a design-system pass should decide alone.

The many `on-navy-*` overlay tokens (different white alpha values for borders, fills, and secondary text on the navy hero) are kept as distinct, exact values rather than rounded into a clean 3-step scale — the source file hand-tuned each one slightly differently (`.5` vs `.6` for borders, `.7` vs `.75` vs `.85` for secondary text). Forcing these into a tidier scale would itself be a deviation from what was approved.

## Typography

Two families, used for two different jobs — never mixed within one job:

- **IBM Plex Sans** (`type.families.sans`) — everything a human reads as language: the greeting, section titles, row titles, body copy, button labels, captions. IBM Plex Sans Arabic is the paired family for Arabic content (`type.families.sans-ar`), since this product is bilingual.
- **JetBrains Mono** (`type.families.mono`) — every number that is *data*, always with tabular numerals: KPI values, the hero decision counter, department headcounts, row indices, deltas, day labels. If a number represents a count, a metric, or a measurement, it's mono. If it's part of a sentence ("22 items"), the sentence is sans but the number itself can still be mono inline — see the hero's "22" badge.

Several headline sizes in the source are fluid (`clamp()`), scaling down on narrower viewports. `tokens.json` stores the desktop-settled value (the clamp's max, which is what any normal desktop width already shows) — implementation should keep the real fluid clamp, not hardcode the flat number outside of a fixed-width context like this design system's own previews.

## Spacing & radius

Spacing in `tokens.json` is the *actual* set of values found in the approved mockup (4 through 40px), including some odd-feeling steps like 6, 10 and 14px that don't sit on a clean 4px grid. These were hand-placed in the source, not derived from a system originally — they're documented exactly as built rather than silently rounded to neighboring "nicer" numbers, per the same exact-values discipline as color.

Radius has exactly three values: `radius-sm` (3px, the default), `radius-pill` (999px, the deliberate exception), `radius-circle` (50%, photos and dots). Nothing else.

## What's in this version

Tokens (color, type, spacing, radius) and this brand book. No component bundle (live Button/Card/Avatar previews) yet — that's the natural next addition once this token set has been used to build one or two more real pages and has proven stable. Until then, treat the approved `.dc.html` mockups themselves as the component reference alongside these tokens.

## Open items, not decided here

- The coral small-text contrast issue above.
- The two different avatar-fallback colors (#C9D2DA vs #8FA3B5) for the header avatar vs. everywhere else — likely an oversight in the source, not confirmed either way.
- No dark theme exists yet.
