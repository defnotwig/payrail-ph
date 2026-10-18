# Fintech Product Design Research & Benchmark (2026)

**Audience:** PayRail PH Product Engineering & Design  
**Date:** 2026-10-19  
**Subjects Analyzed:** Stripe, Wise Business, Mercury, Ramp, PayMongo, Bangko Sentral ng Pilipinas (BSP) QR Ph  

---

## 1. Executive Summary

This document establishes the empirical design foundations for PayRail PH Product Experience V2. By examining industry-leading payment platforms, enterprise financial portals, and local Philippine payment standards, we identify the exact patterns that generate customer trust, prevent operational errors, and provide seamless, transparent payment orchestration.

---

## 2. Competitive Benchmarking

### 2.1 Stripe (Checkout & Dashboard)

#### What Works
- **Amount Prominence:** The payable amount is anchored at the top of the viewport in high-contrast tabular typography with clear currency denomination.
- **Dynamic Payment Method Presentation:** Methods adapt to currency and geography without overwhelming choices (Hick's Law).
- **Calm Payment Completion:** A restrained checkmark animation (<200ms) with unambiguous confirmation copy ("Payment complete", "Receipt sent to customer").
- **Progressive Disclosure in Diagnostics:** The Dashboard highlights high-level payment outcomes first, tucking raw API responses, webhooks, and ISO response codes into secondary expandable tabs.

#### What Does Not Apply
- Heavy multi-currency cross-border conversion toggles (PayRail focus is Philippine Peso PHP and QR Ph orchestration).
- Complex consumer subscription / billing portals (PayRail is payment infrastructure, not a SaaS billing CRM).

#### What PayRail Should Adopt
- Dedicated `#1 Amount` visual hierarchy with tabular numerals.
- Progressive disclosure tabs on the Transaction Detail screen (Overview, Timeline, Ledger, Webhooks, Attempts, Diagnostics).
- Clear inline error states that explain *why* an action failed without ambiguous generic messages.

#### What PayRail Must Not Copy
- Overly compact, muted metadata where critical audit references are hard to read.
- Relying on external redirect flows when a clean embedded modal or split checkout view is superior.

---

### 2.2 Wise Business

#### What Works
- **Radical Fee Transparency:** Exact calculation of fixed and variable fees broken down before payment commitment.
- **Definitive Transaction Timelines:** Step-by-step progress tracker indicating timestamped milestone completion ("Initiated" → "Verified" → "Sent" → "Cleared").
- **High-Contrast Human Copywriting:** Clean, non-technical explanations of banking delays and processing states.

#### What Does Not Apply
- Complex FX conversion charts and multi-country routing calculators.
- Dual-currency debit card management.

#### What PayRail Should Adopt
- Detailed, timestamped payment lifecycle timeline beneath the QR payment panel.
- Clear separation between payment processing time and provider webhook confirmation latency.

#### What PayRail Must Not Copy
- Large consumer-focused marketing banners inside authenticated operational workspaces.

---

### 2.3 Mercury Banking

#### What Works
- **Data-Dense, Elegant Typography:** Uses clean sans-serif UI fonts paired with tabular numbers and restrained 1px borders.
- **Right-Aligned Monetary Figures:** In all transaction tables, amounts and balances are strictly right-aligned for effortless visual scanning.
- **Filter Bar Architecture:** Clean dropdown pills for status, date, and accounts with an instant "Clear all" trigger and zero visual clutter.
- **Subtle, Calm Color Palette:** Warm off-whites (`#f8fafc` / `#ffffff`) paired with deep slate text and muted borders. Zero neon accents.

#### What Does Not Apply
- Checking/savings account creation wizards and venture debt financing workflows.

#### What PayRail Should Adopt
- Mercury-style transaction table structure with right-aligned tabular figures and status badges.
- Restrained card elevation with 1px neutral borders (`#e2e8f0`) rather than drop shadows.
- Grouped sidebar navigation separating operational money workflows from technical developer tools.

#### What PayRail Must Not Copy
- Overly minimal contrast on secondary metadata that can fail WCAG accessibility audits under glare.

---

### 2.4 Ramp (Corporate Finance & Operations)

#### What Works
- **Exception-First Workflow:** Dashboards prioritize transactions requiring operator review (out-of-policy, unverified, discrepancies) above normal routine traffic.
- **One-Click Evidence Inspection:** Operators can click directly from a discrepancy into the underlying receipt, provider event, or journal entry.
- **Fast Keyboard Navigation:** Comprehensive keyboard shortcuts and focus states for rapid triage.

#### What Does Not Apply
- Employee expense reimbursement and corporate physical card issuance.

#### What PayRail Should Adopt
- Exception-first reconciliation: Default the reconciliation view to `NEEDS REVIEW` rather than forcing operators to sift through thousands of matched transactions.
- Direct drill-down links connecting transactions, ledger journal entries, and raw provider webhooks.

#### What PayRail Must Not Copy
- Aggressive corporate expense policy warning banners that feel punitive.

---

### 2.5 PayMongo (Philippine Payment Gateway)

#### What Works
- **Native Philippine Rails:** First-class support for QR Ph, GCash, Maya, and GrabPay.
- **Official Test Mode Simulation:** Provision of dedicated `test_url` endpoints (e.g. `https://test.paymongo.com/qrph/...`) allowing developers to test success, expiration, and failure scenarios in sandbox.
- **Clean API Key Management:** Clear separation between `pk_test_...` and `sk_test_...` with explicit one-time secret revelation.

#### What Does Not Apply
- Simple redirect-only checkout pages that strip context from developer tools.

#### What PayRail Should Adopt
- Unaltered presentation of the official PayMongo QR Ph image payload.
- Direct linkage to the official `test_url` via a prominent "Simulate ₱1 Payment" button.
- Strict `TEST MODE` banner warning users not to scan sandbox QRs with real e-wallet apps.

#### What PayRail Must Not Copy
- Minimalist error payloads that omit provider-level diagnostic codes.

---

### 2.6 Bangko Sentral ng Pilipinas (BSP) QR Ph Standards

#### What Works
- **EMVCo Interoperable Specification:** QR Ph national standard enables scanning across any participating bank or EMI (BPI, BDO, GCash, Maya).
- **Merchant Display Standard:** A centered, square QR code with high-contrast quiet zone (at least 4 modules of white space) and official QR Ph branding.
- **Clear Customer Labeling:** Use "Pay with QR Ph" rather than technical clearing rail terminology like "InstaPay P2P / P2M".

#### What Does Not Apply
- Static merchant stickers printed on acrylic stands (PayRail generates dynamic single-use QR Ph codes bound to unique payment intents).

#### What PayRail Should Adopt
- Respecting the raw provider QR geometry: Desktop size ~280px, mobile size ~240px, centered on a crisp white container with zero clipping, distortion, or artificial corner rounding.
- Dynamic expiration countdown timer (e.g., "Expires in 29:45").

#### What PayRail Must Not Copy
- Placing decorative custom logos, watermarks, or illustrations inside or over the QR matrix, which risks unreadable scanning errors.

---

## 3. Synthesis: Key Design Principles for PayRail V2

| Dimension | Anti-Pattern (What to Avoid) | PayRail V2 Standard |
| :--- | :--- | :--- |
| **Hero Section** | Giant gradient text with floating 3D coins | Clear headline ("Payment infrastructure you can inspect"), technical proof strip, instant working demo. |
| **Payment Demo** | Generic form asking for complex merchant IDs | Clean ₱1.00 default, 1-click QR generation, explicit test simulator link, live polling. |
| **QR Presentation** | Rounded QR corners, decorative drop shadows | Clean white surface, pristine quiet zone, uncropped provider image, expiration countdown. |
| **Payment State** | "Something went wrong" or raw enum strings | Plain human status: "Awaiting payment", "Payment confirmed", "Verifying with provider". |
| **Success State** | Confetti bursts, celebration popups | Calm, professional receipt with tabular metadata, printable view, and transaction drill-down. |
| **Navigation** | Flat list of 15 competing sidebar links | Grouped information architecture: Overview, Transactions, Money, Developers, Reliability, Settings. |
| **Data Tables** | Left-aligned numbers, horizontal overflow | Right-aligned tabular numerals, column priority, responsive card fallbacks on mobile. |
| **Reconciliation** | Massive table showing 10,000 matched rows | Exception-first view highlighting discrepancies, auto-repair status, and investigation tools. |
