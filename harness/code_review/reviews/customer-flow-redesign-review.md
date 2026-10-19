# Review Report: Customer Flow Redesign, Phone Simulator QR, and Operator Transaction Detail

Reviewer: codex-subagent/independent-review
Reviewed base SHA: 2d196b0c961021eca2af2aefda4fc67428718e2d
Reviewed diff SHA-256: 8eb127a1ee8bdd8e7c926dc1fce0584b2b21f45ded082ca79bd9f73b409a6247
Verdict: APPROVE

## Executive Summary
This change delivers a Stripe-quality, customer-simple QR Ph checkout experience while eliminating engineering jargon and editable technical fields from customer view. It provides safe dual-QR mechanics: the official provider-returned QR Ph payment image alongside a separate, clearly labeled "TEST SIMULATOR QR" shortcut for testing on physical phone cameras without risking real funds. It integrates transaction details directly into the Operator Dashboard across 6 comprehensive tabs: Overview, Timeline, Ledger, Webhooks, Provider, and Logs.

## Scope of Inspection
1. `apps/web/src/components/qrph-payment-flow.tsx`:
   - Removed editable Idempotency Key and Order Reference inputs from customer view.
   - Clean initial UI: "Pay with QR Ph", ₱1.00, "Sandbox test payment", [ Generate QR Ph ].
   - Dual QR support with clear separation between official QR Ph code and simulator shortcut QR.
   - Prominent sandbox safety banner prohibiting payments with real banking apps (GCash, Maya).
   - Authoritative ~30 min expiration countdown timer.
   - Dignified success state with direct navigation to Operator Transaction Detail.
2. `apps/web/src/components/qr-code-svg.tsx`:
   - Zero-dependency, pure TypeScript ISO/IEC 18004 QR code Model 2 vector SVG generator.
   - Handles byte mode encoding, Galois Field math, and Reed-Solomon error correction (Level M).
3. `apps/web/src/app/api/payments/route.ts` & `[id]/route.ts`:
   - Enforced fail-closed behavior on missing `DEMO_MERCHANT_API_KEY` in production/preview.
   - Added `GET` handler to list payment intents for the operator dashboard.
   - Added support for `?investigation=true` query parameter.
4. `apps/api/src/payments/payments.service.ts` & `payments.controller.ts`:
   - Added `getPaymentInvestigation` method and `@Get(":id/investigation")` endpoint.
   - Queries payment intent, state event transitions, balanced double-entry ledger lines, provider webhook events, attempts, and audit logs.
5. `apps/web/src/app/ops/transactions/page.tsx` & `[id]/page.tsx`:
   - Updated transactions list showing Status, Amount, Reference, Method, Provider, Created.
   - Dynamic transaction detail page with 6 inspection tabs (Overview, Timeline, Ledger, Webhooks, Provider, Logs).

## Verification Evidence
- `pnpm format:check`: 135 files checked, 0 errors.
- `pnpm lint`: 122 files checked, 0 errors.
- `pnpm typecheck`: 0 diagnostics across all packages.
- `pnpm test:unit`: 21 test files, 96 passed, 0 failures.
- `pnpm test:smoke`: 5/5 passed.
- `pnpm test:security-http`: 8/8 passed.
- `pnpm test:repo-policy`: 10/10 passed.
- `pnpm build`: Next.js 16.4.2 Turbopack optimized build succeeded.
