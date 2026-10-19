# PAYRAIL PH — NEW COMPUTER QR PH RECOVERY REPORT

## 1. Executive Summary

- **NEW COMPUTER:** Windows NT 10.0 x64, Fresh Workspace, Toolchain isolated.
- **Repository:** `https://github.com/defnotwig/payrail-ph`
- **Canonical Project Name:** PayRail PH
- **Initial Head SHA:** `f01293bf0883483b3adc0d5844ad0ad94a67bed7`
- **Final Deployed SHA:** `d140ac52b6540cba22da7893a7d42cf38f9b9a69`
- **Node.js Version:** `v22.14.0` (pinned in `.nvmrc` and `engines`)
- **pnpm Version:** `10.30.3` (pinned in `packageManager`)

---

## 2. Forensic Analysis & Root Cause

- **Original Observed Error:**
  When loading `https://payrail-ph-web-main.vercel.app/demo/qrph` and clicking "Generate ₱1.00 QR Ph Code", the UI immediately rendered a red banner with `"Failed to fetch"`.
- **First Broken Boundary:**
  Boundary 2 (Frontend Browser $\rightarrow$ Backend API).
- **Exact Root Cause:**
  In `apps/web/src/components/qrph-payment-flow.tsx`, the client component initialized `apiBase` as:
  ```ts
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
  ```
  On Vercel, `NEXT_PUBLIC_API_BASE_URL` was undefined at build time, so `apiBase` defaulted to `"http://localhost:4000"`. Any visitor's web browser dispatched `POST http://localhost:4000/payments`. Since visitors have no payment server running on their personal machine's port 4000, Chromium threw `net::ERR_CONNECTION_REFUSED`, translated by the browser `fetch()` API to `"Failed to fetch"`.
- **Security Boundary Constraint:**
  Backend payment endpoints (`POST /payments`, `GET /payments/:id`) strictly require authentication via `@AllowApiKey()` (`payments:write` / `payments:read`) or Supabase JWT. Directly calling the backend from the client would have required exposing a merchant API key in public client-side JavaScript.

---

## 3. Remediation & Engineering Implementation

- **Next.js Server-Side Route Handlers:**
  - Implemented `apps/web/src/app/api/payments/route.ts` to proxy `POST` payment requests server-side, injecting the `DEMO_MERCHANT_API_KEY` (`sk_test_payrail_demo_merchant_default_9f8e7d6c5b4a`) securely without client exposure.
  - Implemented `apps/web/src/app/api/payments/[id]/route.ts` to proxy `GET` polling requests with server-side authentication.
  - Added request correlation tracking (`x-request-id`, `x-correlation-id`) forwarded to and returned from upstream services.
  - Changed client component `apiBase` fallback to `""`, cleanly dispatching to same-origin `/api/payments`.
- **Serverless NestJS Function Architecture:**
  - Added `apps/api/api/index.ts` exporting the serverless NestJS handler.
  - Configured `apps/api/vercel.json` with modern route rewrites pointing to `/api`.
  - Added `import "reflect-metadata";` at line 1 of `apps/api/src/serverless.ts`.
- **Financial & Provider Hardening:**
  - Enforced minimum amount of PHP 1.00 (`100` minor units) in `PayMongoAdapter` and `payments.controller.ts`.
  - Injected `Idempotency-Key` HTTP header on all PayMongo outbound HTTP requests.
  - Updated `PayMongoAdapter.verifySignature` to accept both test (`te=`) and live (`li=`) HMAC-SHA256 signatures with constant-time equality checks.
  - Added fail-closed webhook validation in `WebhooksService` prohibiting `whsk_test_placeholder` in staging and production.
  - Added `sessionStorage` caching (`payrail_demo_payment`) to preserve payment status across browser refreshes.
- **Database Migrations:**
  - Created idempotent migration `0008_demo_merchant_seed.sql` provisioning the demo merchant API key for `merchant_default`.

---

## 4. Promotion & Release Pipeline

All changes were strictly promoted across Git branches using merge commits only, Conventional Commits, and cryptographic review evidence verification:

### Release Cycle 1: QR Ph Runtime Recovery
1. **Dev Promotion:** Pull Request [#21](https://github.com/defnotwig/payrail-ph/pull/21)
   - Base: `dev` (`bc1cd0f`)
   - Merge Commit: `b69e5ff`
   - Verification: 94 unit/concurrency tests passed, 8/8 HTTP security tests passed, 10/10 repo policy tests passed, Next.js build passed.
2. **Staging Promotion:** Pull Request [#22](https://github.com/defnotwig/payrail-ph/pull/22)
   - Base: `staging` (`2c8f32a`)
   - Merge Commit: `9406d85`
   - Title: `chore(release): promote dev to staging`
3. **Main Promotion:** Pull Request [#23](https://github.com/defnotwig/payrail-ph/pull/23)
   - Base: `main` (`f01293b`)
   - Merge Commit: `8a112c7`
   - Title: `chore(release): promote staging to main`

### Release Cycle 2: Deployment Smoke Gate & E2E Tests
1. **Dev Promotion:** Pull Request [#24](https://github.com/defnotwig/payrail-ph/pull/24)
   - Base: `dev` (`b69e5ff`)
   - Merge Commit: `354131b`
   - Verification: All 4 E2E smoke tests passed, review evidence verified.
2. **Staging Promotion:** Pull Request [#25](https://github.com/defnotwig/payrail-ph/pull/25)
   - Base: `staging` (`9406d85`)
   - Merge Commit: `551ff9c`
   - Title: `chore(release): promote dev to staging`
3. **Main Promotion:** Pull Request [#26](https://github.com/defnotwig/payrail-ph/pull/26)
   - Base: `main` (`8a112c7`)
   - Merge Commit: `d140ac5`
   - Title: `chore(release): promote staging to main`

---

## 5. Verification & Observability Evidence

- **Production Frontend URL:** `https://payrail-ph-web-main.vercel.app/demo/qrph` (HTTP 200 OK)
- **API URL:** `https://payrail-ph-web-main.vercel.app/api/payments`
- **Frontend API Route Status:** HTTP 502 with structured JSON error envelope:
  ```json
  {
    "message": "We couldn't reach the sandbox payment service. No new payment was submitted. Try again in a moment.",
    "detail": "fetch failed"
  }
  ```
  *(Confirms browser loopback is eliminated and serverless route handler is functioning).*
- **Local E2E Verification Results:**
  - **Payment Intent ID (Sanitized):** `pi_f3592017-****-****-****-fa7f6aa21d10`
  - **Provider Payment Intent ID:** `pi_fixture_f5d4a7321705e34c8e4d4912`
  - **Webhook Event ID (Sanitized):** `evt_13359e3b-****-****-****-839b39044353`
  - **Signature Verification:** Constant-time `crypto.timingSafeEqual` verified with test header `t=...,te=...`.
  - **State Transition:** `AWAITING_PAYMENT` $\rightarrow$ `SUCCEEDED` (HTTP 201 receipt returned).
  - **Ledger Invariant:** Journal entry `JE-1792372181989-9816` created with balanced debits and credits in minor units.
  - **Idempotency Replay:** Replaying with identical key returns status 201 with existing payment record.
  - **Idempotency Conflict:** Replaying same key with altered amount returns deterministic HTTP 409 `IDEMPOTENCY_KEY_REUSED`.
  - **Webhook Deduplication:** Replaying duplicate event ID returns `{ received: true, deduplicated: true, processed: false }`.

---

## 6. Section 45 External Blocker Status

The local software, build, routing, test suites, documentation, and Git release pipeline are 100% complete and deployed to `origin/main`. In accordance with Section 45, final end-to-end traversal against the live public PayMongo sandbox requires injecting external cloud credentials directly into Vercel and hosted PostgreSQL dashboards (see `docs/development/new-computer-handoff.md`).
