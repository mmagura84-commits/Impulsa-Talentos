# How the Tesla reference was applied to Impulsa Talentos

Reference: `docs/design/TESLA-DESIGN.md` (verbatim copy of VoltAgent/awesome-design-md, MIT; style
reference only — no Tesla branding, imagery or copy is used). This file records how its rules map to
our brand and where we deliberately differ.

## Mapping
| Rule | Implementation |
|---|---|
| Flat: no shadows, gradients, card borders | Shadow tokens zeroed in `src/index.css`; Card/Sheet/Switch flattened; gradients and blur blobs removed from public pages and app shell; cards are white on Light Ash (`#f4f4f4`) bands |
| Single accent | Impulsa indigo `#1f3a8a` (`--primary`). Gold survives only inside the logo. `--accent` is now a neutral hover surface |
| Neutral text | Carbon `#171a20`, Graphite `#393c41`, Pewter `#5c5e62` |
| Weights 400/500 only, normal tracking, no uppercase | Token overrides (`--font-weight-*: 500`, `--tracking-*: normal`) and `.uppercase { text-transform: none }` so existing markup follows without per-file edits |
| Hero ≤ 40px (28px phones), full-viewport photo, dots | Home, For employers; flat 45% overlay, circle dots with 24px hit area |
| 4px buttons, 12px photo cards | `--radius` scale; Button/Input/Badge rewritten |
| Transparent → frosted nav | `PublicHeader` (early-tap data hooks preserved) |
| 0.33s colour-only transitions, no scale/translate | `--default-transition-duration: 330ms`; hover lifts/scales removed; reveal is opacity only |
| ≤ 2 CTAs per screen | Hero pairs: primary + secondary, text only |

## Deliberate differences (usability first)
- **Typeface**: Universal Sans is proprietary. We use DM Sans (already shipped); serif headings (Lora) now resolve to DM Sans.
- Form fields keep a visible `#8e8e8e` border and Pewter placeholder (contrast), solid 2px focus rings everywhere, 16px public body copy.
- Auto-advancing hero photos pause on hover/focus/hidden tab and do not run under `prefers-reduced-motion`; the marquee of companies is now a static row.
- Semantic status colours (success/warning/error badges, Kanban stages, chart series) are kept — they carry meaning.
- Not added: arrow controls and chat bar from the reference (would need new copy/features).
