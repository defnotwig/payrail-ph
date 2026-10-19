# PayRail PH — Operations Experience V4 Design System (DESIGN.md)

**Version:** 4.0.0  
**Project Classification:** Philippine Financial Infrastructure & Payment Orchestration  
**Stitch MCP Project:** `https://stitch.google.com/projects/9384472954066961863` (PayRail PH — Operations V3)  
**Influences:** Stripe Dashboard & Developer Tools, Mercury, Modern Treasury, BSP QR Ph Standards  

---

## 1. Executive Summary & Visual Philosophy

PayRail PH is critical Philippine payment orchestration infrastructure. The V3 Operations Experience is engineered to be **precise, trustworthy, quiet, information-dense, and operationally authoritative**.

It is deliberately NOT:
- A Stripe clone or generic shadcn admin template
- A generic AI SaaS with glowing gradients and glassmorphism
- A crypto dashboard with dark neon accents
- A prototype with fabricated numbers and fake transaction rows

Every single metric, latency figure, and row in the operations console is derived from **actual persisted PostgreSQL application data**, or displays an honest empty state (`—` or `No activity yet`).

---

## 2. Google Stitch MCP Divergent Exploration & Convergence

We explored three distinct structural paradigms generated via Google Stitch MCP (`project/9384472954066961863`):

| Aspect | Concept A: Financial Operations First | Concept B: Modern Infrastructure Console | Concept C: Financial Control Center |
|---|---|---|---|
| **Core Influence** | Stripe Dashboard | Stripe Developer Tools + Datadog | Modern Treasury / Mercury |
| **Primary Mental Model** | Transaction lifecycle as centerpiece | Command-first split investigation console | Balance sheet & settlement batches |
| **Navigation** | 240px collapsible left sidebar | Command bar (`Cmd+K`) + minimal dock | Horizontal tabs + activity feed |
| **Data Density** | Very High (40px compact table rows) | High (split 60/40 forensic split pane) | Moderate (card-based settlement blocks) |
| **Exception Visibility**| Dedicated Needs Attention triage queue | Event stream anomaly markers | Reconcile drawer |
| **Mobile Adaptability** | Converts to navigation drawer + cards | Dense; requires desktop viewport | Stacks into financial stream |

### Convergence Decision: The Operations Console Standard
We converged on a synthesis of **Concept A** (navigation, high-density tables, Needs Attention queue) and **Concept B** (global command bar, split forensic inspection workstation for payment details, correlation tracking):
- **Desktop:** 240px collapsible left sidebar with grouped hierarchy, quiet top utility bar with `/` global search and global environment indicator, 4-metric real KPI performance strip, and deep 6-tab forensic transaction workstation.
- **Tablet (768px–1024px):** Compact 64px sidebar dock, horizontally scrollable data tables with fixed column headers.
- **Mobile (<768px):** Navigation drawer, full-width touch targets (44px+), responsive stacked transaction cards with clear state indicators.

---

## 3. Laws of UX Applied

1. **Jakob's Law (Familiar Mental Models):**
   - Left sidebar with predictable groupings.
   - Global search accessible via keyboard shortcut `/` or `Ctrl+K`.
   - Familiar status pill badges, standard data tables, and tabbed detail inspectors.
2. **Hick's Law (Reduced Cognitive Load):**
   - Replaced flat 11-item top navigation with structured, collapsible groups:
     - **HOME:** Overview
     - **PAYMENTS:** Payments, Refunds, Reconciliation
     - **MONEY:** Ledger
     - **DEVELOPERS:** Webhooks, API Logs, API Keys, API Docs
     - **RELIABILITY:** System Health, Provider Health, Jobs & DLQ, Reliability Lab
     - **SECURITY:** Audit, Access
     - **LABS:** Cards & 3DS, ISO 8583
     - **SETTINGS:** Settings
3. **Tesler's Law (Conservation of Complexity):**
   - The system absorbs complexity. Raw provider payloads, signature HMAC hashes, and internal attempt IDs are tucked behind progressive disclosure (expandable JSON viewers and inspection tabs).
4. **Fitts's Law (Action Target Sizing):**
   - Primary operational actions (`Generate QR`, `Simulate test payment`, `Replay webhook`, `Retry job`) have large, unambiguous target sizes (minimum 44px on mobile, 36px on desktop).
   - Destructive actions (refunds, cancellations) are visually isolated and never adjacent to primary triggers.
5. **Law of Proximity & Common Region:**
   - Group related financial information (Amount, Status, Provider, Order Number) into cohesive visual blocks using whitespace and subtle borders rather than nested cards.
6. **Von Restorff Effect (Isolation Effect):**
   - Only one primary action button per surface.
   - Healthy operations remain visually quiet and neutral; exceptions in Needs Attention (`UNKNOWN_REQUIRES_RECONCILIATION`, failed webhooks, DLQ items) stand out with amber/rose accenting.
7. **Doherty Threshold (Instant Feedback):**
   - Micro-feedback in <150ms.
   - Optimistic states, loading spinners, and skeleton loaders for async operations exceeding 200ms. Zero frozen buttons.

---

## 4. Anti-AI-Slop Rulebook

Every screen must strictly enforce:
1. **NO 12-Card Overload:** Never place dozens of equal-weight KPI cards on a page. Exactly 4 core operational metrics on Overview.
2. **NO Cards Inside Cards Inside Cards:** Max 1 level of card elevation above the canvas.
3. **NO Decorative Gradients or Glows:** No purple/cyan gradient text, glowing neon border pulses, or floating 3D coins/cards.
4. **NO Fabricated Numbers:** Remove static strings like `99.8%`, `₱184,500`, `185ms`, `369 transactions`. If no data exists, display `—` or `No activity yet`.
5. **NO Merged Fake Rows:** Never mix `sessionStorage` demo items into the authoritative database tables.
6. **NO Generic Centering:** Tables and data views must be left-aligned for text/status and strictly **right-aligned for numerical currency amounts**.

---

## 5. Design Tokens & Visual Hierarchy

### 5.1 Color Palette
A light-first, clinical slate foundation:
- **Canvas Base (`--bg-canvas`):** `#f8fafc` (Slate 50)
- **Surface Default (`--bg-surface`):** `#ffffff` (Pure White)
- **Surface Subtle (`--bg-subtle`):** `#f1f5f9` (Slate 100) — Inset trays, table headers
- **Surface Hover (`--bg-hover`):** `#f8fafc` (Slate 50)
- **Text Primary (`--text-primary`):** `#0f172a` (Slate 900) — Dominant text (>14:1 contrast ratio)
- **Text Secondary (`--text-secondary`):** `#475569` (Slate 600) — Labels, headers, metadata (>5.5:1 ratio)
- **Text Muted (`--text-muted`):** `#94a3b8` (Slate 400) — Placeholders, disabled text
- **Borders (`--border-subtle`):** `#e2e8f0` (Slate 200) — 1px crisp separation
- **Structural Borders (`--border-strong`):** `#cbd5e1` (Slate 300) — Active inputs, selected tabs
- **Brand Primary (`--brand-primary`):** `#0f52ba` (Sapphire Cobalt) — High-trust financial anchor
- **Brand Hover (`--brand-hover`):** `#0c4196`

### 5.2 Functional Status Tokens
- **`SUCCEEDED` / `SETTLED`:** Text `#047857`, Surface `#ecfdf5`, Border `#a7f3d0`
- **`AWAITING_PAYMENT` / `PROCESSING`:** Text `#b45309`, Surface `#fffbeb`, Border `#fde68a`
- **`FAILED` / `EXPIRED`:** Text `#be123c`, Surface `#fff1f2`, Border `#fecdd3`
- **`UNKNOWN_REQUIRES_RECONCILIATION`:** Text `#4338ca`, Surface `#eef2ff`, Border `#c7d2fe`
- **Environment Indicator:**
  - Sandbox: Text `#78350f`, Surface `#fef3c7`, Border `#fcd34d`
  - Live: Reserved for future production with red/crimson containment

### 5.3 Typography Scale
- **Display / Page Header:** 24px–28px / font-weight 700 / letter-spacing -0.02em
- **Section Title:** 16px–18px / font-weight 600
- **Body / Table Content:** 13px–14px / font-weight 400 / line-height 20px
- **Caption / Meta:** 11px–12px / font-weight 500 / letter-spacing 0.02em
- **Tabular Numerals (`JetBrains Mono` / `tnum`):** Enforced on all Philippine Peso amounts (`₱1.00`), timestamps, transaction hashes, latencies, and ledger lines.

---

## 6. QR Ph Checkout Dialog Architecture

1. **Trigger:** Simple card at `/demo/qrph` with preset ₱1.00 and single button `[ Generate QR Ph ]`.
2. **Accessible Dialog:** Opens centered modal (540px desktop) or bottom sheet (mobile). Focus is trapped inside the dialog. `aria-modal="true"`, `role="dialog"`.
3. **Unaltered Provider QR:** Renders the exact PayMongo `next_action.code.image_url` output without cropping, recoloring, or artificial center logos.
4. **Authoritative Expiration:** Dynamic 30-minute countdown derived from creation timestamp.
5. **Sandbox Safety:**
   - Prominent banner: *"TEST MODE — Do not pay this test QR using a real banking or e-wallet application."*
   - Primary simulator action: `[ Simulate ₱1 payment ]` opening PayMongo `test_url`.
   - Phone simulator shortcut: Collapsible secondary section labeled *"TEST SIMULATOR QR"* encoding ONLY `test_url`.
6. **Automatic Polling & Calm Success:**
   - Polls `/api/payments/[id]` every 2s until `SUCCEEDED`.
   - Transitions to settled receipt: *"Payment successful"*, ₱1.00, reference, timestamp, `[ View in Operator Dashboard ]`, `[ Make another payment ]`. No confetti, no fireworks.

---

## 7. Component Library Manifest

- **Navigation:** `AppShell`, `Sidebar`, `CommandBar`, `PageHeader`, `NavGroup`, `NavItem`
- **Status & Indicators:** `EnvironmentIndicator`, `HealthIndicator`, `StatusBadge`, `ProviderBadge`
- **Data Display:** `DataTable`, `FilterBar`, `SearchInput`, `Amount`, `Timeline`, `ActivityFeed`, `DefinitionList`
- **Metrics:** `MetricCard`, `MetricGrid`
- **Containers:** `Dialog`, `Drawer`, `Tabs`, `DetailSection`, `EmptyState`, `ErrorState`, `Skeleton`
- **Diagnostics:** `CodeBlock`, `JsonViewer`

---

## 8. Version 4.0.0 Specifications

### 8.1 Geometric "PR" Rail Monogram Brand Identity
- **Monogram Architecture:** The twin parallel rails represent Philippine retail settlement infrastructure (InstaPay real-time credit transfer and PESONet batch settlement), routing through PayRail's automated switch.
- **Glyph Integration:** 
  - Inner rail sweeps through upper bowl and returns horizontally to stem at $y=14.0$, creating a closed letter **P**.
  - Outer rail arches concentric to the inner rail and diverges at the turnout waistline ($y=18.5$) into a $45^\circ$ diagonal leg ending at $(25.5, 27.5)$, creating a crisp letter **R**.
- **Vector Master Assets:**
  - `/public/brand/payrail-mark.svg` (32×32 viewBox, 1-color capable `#0f52ba` / `currentColor`)
  - `/public/brand/payrail-wordmark.svg` (144×32 viewBox, DM Sans 700 with dark/light mode `tspan` fills)
  - `/public/brand/payrail-lockup.svg` (184×32 viewBox, horizontal lockup)
  - `/public/favicon.svg` (32×32 viewBox, `#0f52ba` rounded container with crisp white monogram)

### 8.2 Collapsed Sidebar Overlap Invariant
- **Geometry:** 240px expanded $\rightarrow$ 64px collapsed width.
- **Seam-Mounted Toggle Button:** The collapse button floats directly on the sidebar border seam (`right: -12px; width: 24px; height: 24px; border-radius: 50%`). Because it does not occupy horizontal space in `.sidebarHeader`, the 32×32 logo mark is centered at $x=[16\text{px}, 48\text{px}]$ across all viewport widths.
- **Zero Collision Transition:** Brand text and subtitle use `max-width: 0; opacity: 0; pointer-events: none; visibility: hidden;` in collapsed mode, eliminating text wrapping or under-logo stacking at intermediate widths (64, 80, 160, 240px).

### 8.3 Truthful Aggregated Health Model
- **Status State Machine:** Components report `HEALTHY`, `DEGRADED`, `UNAVAILABLE`, or `UNKNOWN`.
- **Epistemic Invariant:** Health requires fresh, verifiable telemetry. Never default to `HEALTHY`.
- **Decoupled Gateway Observation:** When the Web client cannot reach the API Gateway:
  - API Gateway = `UNAVAILABLE`
  - Downstream Database, PayMongo, Webhook Ingestion, and Workers = `UNKNOWN`
  - Header pill renders `PayMongo: UNAVAILABLE` or `Telemetry: UNKNOWN` in calm amber/rose/slate (never green).
  - Triage panel renders `Operational visibility degraded` with specific diagnostic details.
- **Nominal Banner Gate:** The banner `"All payment pipelines nominal · 0 invariant violations · 0 DLQ items"` renders **only** when all components have verified fresh positive telemetry, DLQ is 0, and the double-entry ledger is balanced.

### 8.4 Confirmation Latency Metric Formalization
- **Correct Naming:** `P95 Confirmation Latency (webhook-to-balanced-ledger)`.
- **Financial Rationale:** Distinguishes real-time payment confirmation and balanced ledger recording from interbank clearing (T+1/T+2 multilateral settlement).
- **Authoritative SQL Computation:**
  ```sql
  SELECT
    count(*)::int AS sample_size,
    percentile_cont(0.50) WITHIN GROUP (
      ORDER BY extract(epoch from (p.updated_at - p.created_at)) * 1000
    )::int AS p50_confirmation_latency_ms,
    percentile_cont(0.95) WITHIN GROUP (
      ORDER BY extract(epoch from (p.updated_at - p.created_at)) * 1000
    )::int AS p95_confirmation_latency_ms
  FROM payrail_private.payment_intents p
  WHERE p.merchant_id = $1
    AND p.state = 'SUCCEEDED'
    AND p.created_at >= $2;
  ```
  If `sample_size = 0`, the metric renders `—`, never falling back to fabricated numbers.

