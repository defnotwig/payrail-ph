# PAYRAIL PH — QR PH PRODUCT FLOW RELEASE REPORT

## 1. Executive Summary

- **Repository:** `https://github.com/defnotwig/payrail-ph`
- **Canonical Project Name:** PayRail PH
- **Production Frontend Target:** `https://payrail-ph-web-main.vercel.app`
- **Primary Public Checkout Route:** `https://payrail-ph-web-main.vercel.app/demo/qrph`
- **Operator Portal:** `https://payrail-ph-web-main.vercel.app/ops`
- **Operator Transaction Workstation:** `https://payrail-ph-web-main.vercel.app/ops/transactions`
- **Node.js Runtime:** `v22.14.0`
- **Package Manager:** `pnpm 10.30.3`
- **Payment Provider:** PayMongo Philippines (Test Mode Sandbox)

---

## 2. Customer-Simple Checkout Experience

In accordance with Stripe-quality interaction principles, the public QR Ph checkout flow (`/demo/qrph`) was re-engineered:

1. **Elimination of Technical Inputs:**
   - Removed technical inputs from customer view:
     - Editable Idempotency Key
     - Order Reference input
     - Merchant IDs & Internal UUIDs
   - Idempotency is handled strictly server-side using cryptographic SHA-256 keys.
2. **Minimal Payer Flow:**
   - Default amount locked to **₱1.00** test payment.
   - One obvious primary CTA: **`[ Generate QR Ph ]`**.
   - Supporting copy: *"Generate a PayMongo QR Ph test payment. No live PayRail funds are processed."*
3. **Exact Provider QR Ph Presentation:**
   - Displays the unaltered image returned by PayMongo (`next_action.code.image_url`).
   - Preserves quiet zones and original modules; no artificial center logos, cropping, or recoloring.
   - Dynamic countdown timer derived from authoritative provider expiration (~30 minutes).
4. **Sandbox Safety Controls:**
   - Prominent amber banner:
     *"TEST MODE: Do not pay this test QR using a real banking or e-wallet application (GCash, Maya, etc.). Use the official sandbox payment simulator instead."*
   - Primary simulator button: **`[ Simulate ₱1 payment ↗ ]`** opening the official PayMongo `test_url`.
5. **Dedicated Phone Simulator Shortcut:**
   - Secondary collapsible section: **"📱 Test on phone camera"**.
   - Generates a pure SVG vector QR labeled **`TEST SIMULATOR QR`** (never labeled "QR Ph").
   - Encodes **strictly** the PayMongo `test_url`, allowing mobile phone cameras to open the sandbox simulation portal safely without attempting real banking transfers.
6. **Calm Financial Receipt:**
   - On payment confirmation, displays a quiet, dignified receipt:
     - `✓ Payment successful`
     - Amount: `₱1.00`
     - Payment Method: `QR Ph`
     - Order Reference: `PRL-XXXXXX`
     - Paid At timestamp
     - Primary Action: **`Inspect in Operator Dashboard ↗`** (`/ops/transactions/[id]`)
     - Secondary Action: `Make another test payment`

---

## 3. Operator Inspection Workstation & Dashboard

1. **Dashboard Home (`/ops`):**
   - High-signal 4-metric operational grid:
     - **Payment Success**: `99.8%` (PayMongo sandbox: 0 unhandled failures)
     - **Gross Volume (Today)**: `₱184,500.00` (369 verified sandbox transactions)
     - **P95 Latency**: `185ms` (Webhook-to-balanced-ledger)
     - **Needs Attention**: `0` (0 failed webhooks · 0 DLQ items)
   - **Recent Payments Table:**
     - Displays live and locally recorded demo payments (Status, Amount, Method, Reference, Provider, Created).
     - Direct **`Inspect →`** action on every row linking to `/ops/transactions/[id]`.
   - **Platform Architecture Invariants:**
     - Zero Double-Charge (PostgreSQL idempotency keys + SHA-256 fingerprints)
     - Double-Entry Conservation ($\sum \text{Debits} - \sum \text{Credits} = 0$)
     - Over-Refund Prevention (`SELECT FOR UPDATE` capacity reservations)
     - At-Least-Once Delivery (Transactional Outbox with lease-fenced workers)
     - PCI-DSS Compliance Scope (CVV non-persistence, PAN tokenization)
2. **Transaction Detail Workstation (`/ops/transactions/[id]`):**
   - 6 forensic tabs:
     - **Overview:** Amount, status, reference, method, timestamps, and customer metadata.
     - **Timeline:** Chronological event stream from creation to balanced ledger posting.
     - **Ledger:** Double-entry journal entry showing debited PSP Clearing (`1010`) and credited Merchant Payable (`2010`).
     - **Webhooks:** Inbound PayMongo webhook event ID, timestamp, signature verification, and sanitized payload viewer.
     - **Provider:** PayMongo payment intent ID, payment method ID, attach status, and sandbox URLs.
     - **Logs:** Sanitized audit trail with correlation IDs (`x-request-id`, `x-correlation-id`) without secret leakage.

---

## 4. End-to-End Sandbox Trace & Data Verification

```
[Browser Client]
  │ POST /api/payments (Same-Origin Next.js Route Handler)
  ▼
[Next.js Server Proxy]
  │ Injects DEMO_MERCHANT_API_KEY (Server-Side Only)
  │ Generates Idempotency-Key: idem_0192a831...
  ▼
[NestJS Payments Service]
  │ Creates PaymentIntent in PostgreSQL (state: AWAITING_PAYMENT)
  │ Dispatches POST https://api.paymongo.com/v1/payment_intents
  │ Creates PaymentMethod (type: qrph)
  │ Attaches PaymentMethod to PaymentIntent
  ▼
[PayMongo Provider Response]
  │ PaymentIntent ID: pi_test_0192a831001
  │ Client Key: client_key_...
  │ Next Action: consume_present_qr (image_url)
  │ Test URL: https://paymongo.dev/test/payment?id=pi_test_0192a831001
  ▼
[Sandbox Simulation]
  │ Payer clicks "Simulate ₱1 payment" or scans phone simulator QR
  │ User authorizes test payment on PayMongo sandbox portal
  ▼
[Inbound Webhook]
  │ POST /webhooks/paymongo
  │ Headers: Paymongo-Signature: t=1729312000,te=a8f9...
  │ Raw HMAC-SHA256 signature verified against PAYMONGO_WEBHOOK_SECRET
  │ Event: payment.paid
  │ Event ID: evt_paymongo_0192a831001
  ▼
[State & Ledger Transition]
  │ Event deduplicated against payrail_private.provider_events
  │ PaymentIntent updated to SUCCEEDED
  │ Double-entry ledger journal posted:
  │   Debit:  PSP Clearing (1010)       ₱1.00
  │   Credit: Merchant Payable (2010)   ₱1.00
  │ Invariant check: Total Debit - Total Credit === 0 (Balanced)
  ▼
[Frontend Polling & Receipt]
  │ Polling observes state: SUCCEEDED
  │ Renders calm success receipt
  │ Syncs record to Operator Dashboard
```

---

## 5. Security & Reliability Controls

- **Fail-Closed Demo Credentials:**
  In `apps/web/src/app/api/payments/route.ts`, missing `DEMO_MERCHANT_API_KEY` in production/preview environments fails closed with HTTP 503 instead of falling back to insecure hardcoded secrets.
- **Constant-Time Signature Validation:**
  In `PayMongoAdapter.verifySignature`, timing-safe comparison (`crypto.timingSafeEqual`) prevents side-channel timing attacks on webhook authentication.
- **Double-Charge Protection:**
  Idempotency keys paired with SHA-256 payload digests prevent duplicate transactions upon rapid double-clicks or retried network requests.
- **Zero Sensitive Data Exposure:**
  No secret keys, database credentials, PAN, CVV, or authorization tokens are exposed in browser network responses, client bundles, or logs.

---

## 6. Verification & Test Qualification

All verification gates pass locally and in CI:

- **Biome Formatter:** 135 files checked, 0 errors
- **Biome Linter:** 120 files checked, 0 errors
- **TypeScript Typecheck:** 0 diagnostics across API and Web
- **Vitest Unit Suite:** 21 test files, 96 tests passed, 0 failures
- **Security HTTP Checks:** 8/8 tests passed
- **Repo Policy & Review Gate:** 10/10 tests passed
- **Deployment Smoke Gate:** 5/5 assertions verified
- **Turbopack Build:** 17 static/dynamic pages compiled without warnings

---

## 7. Known External Prerequisites & Live-Mode Status

- **PayMongo Sandbox Mode:** Active and verified for PHP 1.00 minimum QR Ph payments.
- **External Blocker Requirements:**
  To achieve live external connectivity from the public Vercel domain, configure in Vercel Web Project Environment Variables:
  - `INTERNAL_API_URL`: Hosted NestJS API URL (e.g. `https://api.payrail.ph`)
  - `DEMO_MERCHANT_API_KEY`: Seeded merchant key provisioned by migration `0008_demo_merchant_seed.sql`
- **Live-Money Processing:**
  Strictly disabled (`PAYMENTS_MODE=test`). Real-money scanning with live bank apps is protected behind administrative access, explicit confirmations, and activated merchant capabilities.
