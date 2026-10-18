# PayRail PH design tokens

The chosen public portfolio direction uses an editorial serif for display text, a neutral sans-serif for controls and explanatory UI, and a restrained ink/cobalt/coral palette. Keep product screens calm and evidence-led.

## Color
| Token | Value | Use |
|---|---|---|
| --color-paper | #FAFAF7 | Main page background |
| --color-paper-raised | #FFFFFF | Small evidence surface when separation is needed |
| --color-ink | #14233D | Primary text and headings |
| --color-cobalt | #1854D8 | Primary links, buttons, focus outlines |
| --color-cobalt-deep | #123EAA | Hover/active primary controls |
| --color-coral | #F26D61 | Decorative status dot and non-text accent only |
| --color-muted | #53657B | Body copy and secondary labels |
| --color-line | #D8DEE8 | Rules and subtle boundaries |
| --color-blue-haze | #EAF0FA | Quiet diagram backgrounds |
| --color-success | #176B52 | Verified state text/icon only |
| --color-warning | #825100 | Pending or review-needed text/icon |

## Typography
- Display: DM Serif Display, regular weight.
- UI/body: DM Sans, 400–700.
- Body copy: 16–18 px with 1.55–1.7 line-height.
- Small labels: 12–13 px, uppercase, 0.12–0.16 em tracking.
- Keep display lines short and avoid low-contrast text.

## Layout and shape
- Main content width: 1280 px maximum.
- Desktop side padding: clamp(24px, 5.4vw, 80px).
- Section spacing: 64–96 px desktop; 44–64 px mobile.
- Use open layout, thin dividers, and square-to-soft 4–8 px corners. Avoid nested cards and heavy shadows.
- Preserve the reference's large whitespace around the hero, horizontal flow, and quiet footer illustration.

## Interaction and accessibility
- Use semantic landmarks and real links for navigation.
- Keyboard focus is always visible with a 3 px cobalt outline and 2 px offset.
- Interactive targets are at least 44 × 44 px on touch layouts.
- Honor prefers-reduced-motion; anchor scrolling is smooth only when motion is allowed.
- Do not use coral alone to convey a state. Pair every state with readable text.
- Maintain WCAG AA contrast for normal text and controls.
