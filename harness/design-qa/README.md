# Phase 01 design QA

The public landing page implements the selected third design direction. The review used the running production build at `http://127.0.0.1:3000/` and kept the visible state honest: sandbox integration evidence is marked pending.

| Check | Result |
|---|---|
| Desktop viewport | 1487 × 1058; no horizontal overflow. |
| Responsive sweep | No horizontal overflow at 320, 375, 390, 768, 800, 801, 1024, 1280, or 1487 CSS pixels. |
| Mobile viewport | 390 × 844; document client and scroll widths both 375 CSS pixels; no horizontal overflow; full-page height 1447 pixels after the diagram-caption spacing fix. |
| Navigation | All five in-page links resolved to their intended `#top`, `#system`, `#reliability`, or `#access` targets. |
| Keyboard | First Tab focused the home link with a visible 3px cobalt outline. Navigation targets have a 44px minimum height at the narrow breakpoint. |
| Images | Both local images loaded. The diagram and mountain artwork total about 148 KB on disk after local resizing/compression. No `/_next/image` request was made; static artwork does not rely on a hosted image optimizer. |
| Browser console | 0 errors and 0 warnings on a fresh page load. |
| Content safety | No checkout capability or scannable QR is exposed. Sandbox evidence remains explicitly pending. |

Captured local browser evidence:

- Desktop full page: [payrail-desktop.png](payrail-desktop.png)
- Mobile full page: [payrail-mobile.png](payrail-mobile.png)

The automated design critique could not accept the supplied 1.5 MB reference image because its input limit is 1 MB. The selected reference, responsive browser captures, link checks, keyboard focus, image loading, and console state were reviewed directly instead.
