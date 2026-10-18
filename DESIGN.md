# PayRail PH — Design System & Visual Philosophy (V2)

**Version:** 2.0.0  
**Target:** High-Precision Financial Infrastructure & Payment Orchestration  
**Influences:** Stripe, Wise Business, Mercury, Ramp, PayMongo, BSP QR Ph Standards  

---

## 1. Core Visual Philosophy

PayRail PH is an operational fintech platform. It is engineered to look and feel like critical banking infrastructure: **trustworthy, precise, fast, calm, human-designed, and authoritative.**

It is deliberately NOT:
- A generic AI-generated SaaS landing page
- A crypto, web3, or DeFi dashboard
- A gaming or neon cyberpunk interface
- A decorative template with floating 3D objects and glassmorphic blur

---

## 2. Anti-AI-Slop Rulebook

Every interface component and layout must adhere to these prohibitions:

1. **NO Generic Gradient Blobs & Mesh Backgrounds:** No floating blurred colored circles, cosmic backgrounds, or iridescent mesh wallpapers.
2. **NO Cyberpunk / Neon Accents:** No neon cyan, magenta, or electric purple text/borders.
3. **NO Excessive Backdrop Blur / Glassmorphism Everywhere:** Surfaces must have clear, solid physical contrast and containment.
4. **NO Random 3D Illustrations & Floating Credit Cards:** No decorative isometric floating bank cards, coins, robots, or rocket ships.
5. **NO 4-Equal-KPI-Card Syndrome:** Do not blindly stamp four identical metric cards on every page. Highlight only 2–3 high-priority operational metrics.
6. **NO Pill Explosion:** Do not turn every noun, label, or date into a rounded pill. Use clean typographic metadata. Full rounded capsules (`border-radius: 9999px`) are reserved strictly for operational status badges.
7. **NO Giant Inefficient Hero Sections:** The value proposition and interactive working product must be visible above the fold.
8. **NO Meaningless Animation or Physics Gimmicks:** No draggable canvas physics (no Matter.js), springy financial balances, or rotating elements. Motion must be subtle (<200ms) and communicate state changes only.
9. **NO Fake Testimonials, Bank Logos, or Decorative Numbers:** Every metric, transaction, and status shown must be mathematically and operationally truthful.

---

## 3. Design Tokens & Palette

### 3.1 Color Palette
A light-first, high-legibility operational aesthetic with high-contrast functional hierarchy:

* **Foundation Canvas (`--bg-canvas`):** `#f8fafc` (Slate 50) — A calm, clean, low-glare canvas.
* **Surface Default (`--bg-surface`):** `#ffffff` (Pure White) — Crisp containment for cards, tables, and dialogs.
* **Surface Subtle (`--bg-subtle`):** `#f1f5f9` (Slate 100) — Inset trays, table header rows, code backgrounds.
* **Text Primary (`--text-primary`):** `#0f172a` (Slate 900) — Dominant high-contrast text (>14:1 contrast ratio).
* **Text Secondary (`--text-secondary`):** `#475569` (Slate 600) — Form labels, column headers, metadata (>5.5:1 ratio).
* **Text Muted (`--text-muted`):** `#94a3b8` (Slate 400) — Disabled states, subtle hints.
* **Borders & Dividers (`--border-subtle`):** `#e2e8f0` (Slate 200) — Sharp, 1px structural boundaries.
* **Brand Accent (`--brand-primary`):** `#0f52ba` (Sapphire Cobalt) — High-trust financial anchor for primary actions.
* **Brand Accent Hover (`--brand-hover`):** `#0c4196` (Deep Sapphire).

### 3.2 Semantic State Tokens
Restricted strictly to meaningful operational states:
* **Success / Terminal Succeeded:**
  * Background: `#ecfdf5` (Emerald 50) | Text: `#065f46` (Emerald 800) | Border: `#a7f3d0` (Emerald 200)
* **Processing / Awaiting Payment:**
  * Background: `#fffbeb` (Amber 50) | Text: `#92400e` (Amber 800) | Border: `#fde68a` (Amber 200)
* **Failed / Terminal Failure:**
  * Background: `#fef2f2` (Rose 50) | Text: `#991b1b` (Rose 800) | Border: `#fecdd3` (Rose 200)
* **Unknown / Reconciliation Required:**
  * Background: `#f8fafc` (Slate 50) | Text: `#334155` (Slate 700) | Border: `#cbd5e1` (Slate 300)
* **Sandbox / Environment Badge:**
  * Background: `#fef3c7` (Amber 100) | Text: `#78350f` (Amber 900) | Border: `#fcd34d` (Amber 300)

---

## 4. Typography & Tabular Figures

* **Primary Font Family:** System UI Sans / `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif.
* **Tabular Figures (`tnum`):** Enforced globally on all financial numbers, minor-unit amounts, timestamps, transaction references, latencies, and ledger lines:
  ```css
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  ```
* **Scale Rhythm:**
  * `display`: 2rem (32px) / line-height 1.25 / font-weight 700 / letter-spacing -0.02em
  * `h1`: 1.5rem (24px) / line-height 1.3 / font-weight 700 / letter-spacing -0.015em
  * `h2`: 1.25rem (20px) / line-height 1.35 / font-weight 600 / letter-spacing -0.01em
  * `h3`: 1rem (16px) / line-height 1.4 / font-weight 600
  * `body`: 0.875rem (14px) / line-height 1.5 / font-weight 400
  * `body-sm`: 0.75rem (12px) / line-height 1.4 / font-weight 400
  * `caption`: 0.6875rem (11px) / line-height 1.3 / font-weight 600 / uppercase / letter-spacing 0.05em

---

## 5. Spacing, Shapes & Elevation

* **Base Grid:** 4px baseline.
  * `space-1`: 4px (micro adjustments, badge insets)
  * `space-2`: 8px (component gaps, button padding)
  * `space-3`: 12px (form control gaps, tight lists)
  * `space-4`: 16px (card padding, table cells)
  * `space-6`: 24px (card padding on desktop, section breaks)
  * `space-8`: 32px (major layout blocks)
* **Corner Radius:**
  * `radius-sm`: 4px (micro badges, code tags)
  * `radius-md`: 6px (buttons, inputs, select menus)
  * `radius-lg`: 10px (standard cards, modal dialogs)
  * `radius-full`: 9999px (strictly for status pill indicators)
* **Elevation & Shadows:**
  * `shadow-none`: flat borders only (default for most internal operational tables)
  * `shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` (cards, active containers)
  * `shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)` (modals, dropdowns)

---

## 6. Financial UX Laws

1. **Information Hierarchy:**
   1. `#1 Amount` (prominent, high-contrast, tabular numerals, currency symbol aligned)
   2. `#2 State` (clear, color-coded, human readable: "Payment confirmed", "Awaiting payment")
   3. `#3 Counterparty / Order Reference`
   4. `#4 Payment Method` (QR Ph, Card)
   5. `#5 Date & Timestamp` (ISO 8601 formatted clearly in local time)
   6. `#6 Transaction Reference` (copyable with one click)
   7. `#7 Technical Metadata` (expandable in progressive disclosure)
2. **Amount Alignment:**
   * In all data tables, numbers and currency amounts **MUST BE RIGHT-ALIGNED**.
   * Text and statuses must be left-aligned.
3. **No Ambiguous Errors:**
   * Never say "Something went wrong". Specify whether the payment failed, whether the provider timed out, and whether the card was charged or not.
   * If state is `UNKNOWN_REQUIRES_RECONCILIATION`: explicitly instruct "We are verifying this transaction. Do not submit a duplicate payment."
4. **QR Ph Sandbox Safety:**
   * Prominently display: "TEST MODE — Do not scan this test QR with your real banking or e-wallet application."
   * Always provide the official PayMongo `test_url` via a clear "Simulate ₱1 Payment" button.
5. **Calm Receipts:**
   * Success receipts must feel settled and definitive. Clean checkmark, clear metadata breakdown, print/download receipt action, and option to make another test payment.

---

## 7. Accessibility Standards (WCAG 2.2 AA)

* Minimum contrast of 4.5:1 for standard text and 3:1 for large text/icons.
* Minimum interactive touch target of 44×44px on mobile viewports.
* Clear `:focus-visible` outline (`2px solid #0f52ba`, `offset 2px`).
* `aria-live="polite"` on dynamic payment status updates.
* Full keyboard navigation (Tab, Enter, Space, Escape on dialogs).
* Complete support for `prefers-reduced-motion`.
