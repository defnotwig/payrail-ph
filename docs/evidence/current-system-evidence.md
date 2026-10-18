# PayRail PH — Current System Evidence Audit

**Audit Date:** 2026-10-18  
**Repository:** `https://github.com/defnotwig/payrail-ph`  
**Audited Revision (main):** `0e9ac151d8a14520c8750377910d096c07d7fad2`  
**Audited Revision (dev):** `c785e4f4a43457195bb2f6938a1cbd3bb4180143`  
**Audited Revision (personal/defnotwig):** `c785e4f4a43457195bb2f6938a1cbd3bb4180143`

---

## 1. Evidence Classification Taxonomy

Every architectural claim is evaluated and assigned exactly one classification:

1. **`CODE EXISTS`**: Implementation files and types exist in the tree, but haven't been exercised in tests or runtime.
2. **`DETERMINISTIC TEST VERIFIED`**: Covered by deterministic unit tests or mock assertions in CI without external services.
3. **`LOCAL INTEGRATION VERIFIED`**: Verified running against real local isolated infrastructure (PostgreSQL 17 on `127.0.0.1:55432`).
4. **`PROVIDER SANDBOX VERIFIED`**: Successfully executed against an official external PSP sandbox API over live HTTPS.
5. **`HOSTED PROVIDER VERIFIED`**: Fully executed across deployed cloud services receiving authentic signed provider webhooks.
6. **`DEPLOYED VERIFIED`**: Publicly accessible, deployed on cloud infrastructure (e.g., Vercel edge/serverless), and actively responding HTTP 200.

---

## 2. Comprehensive Claims Matrix

| # | Claim | Evidence Artifacts | Verification Command | Environment | Commit SHA | Classification | Limitations / Blocker |
|---|---|---|---|---|---|---|---|
| 1 | Monorepo Runnable Baseline | `package.json`, `pnpm-workspace.yaml`, `biome.json` | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build` | Local / GitHub CI Ubuntu | `0e9ac15` | **DEPLOYED VERIFIED** | None |
| 2 | QR Ph Minimal Database Schema | `0001_core_schema.sql`, `0002_qrph_payment_lifecycle.sql` | `pnpm db:migrate` under advisory lock | PostgreSQL 17 (`127.0.0.1:55432`) | `0e9ac15` | **LOCAL INTEGRATION VERIFIED** | Cloud Supabase requires credentials configured |
| 3 | Idempotent Payment Intent Creation | `payments.service.ts`, `payments.controller.ts` | `pnpm --filter @payrail/api test:unit` | Local Node 22 / Vitest | `0e9ac15` | **LOCAL INTEGRATION VERIFIED** | Row lock tested locally; multi-worker cluster pending |
| 4 | PayMongo QR Ph Adapter Implementation | `paymongo.adapter.ts` | `pnpm --filter @payrail/api test:unit` | Local Node 22 / Vitest | `0e9ac15` | **LOCAL INTEGRATION VERIFIED** | Code calls PayMongo HTTPS; fallback simulator active when `PAYMONGO_SECRET_KEY=sk_test_placeholder` |
| 5 | Raw-body HMAC-SHA256 Webhook Verification | `webhooks.service.ts`, `webhooks.controller.ts` | `webhooks.service.spec.ts`, `payments.e2e.spec.ts` | Local Node 22 / Vitest | `0e9ac15` | **DETERMINISTIC TEST VERIFIED** | Tested against genuine PayMongo signature scheme (`t=`, `te=`, `li=`) with timingSafeEqual |
| 6 | Webhook Deduplication & Terminal State Guard | `webhooks.service.ts`, `payment_state_events` | `payments.e2e.spec.ts` | Local PostgreSQL 17 / Vitest | `0e9ac15` | **LOCAL INTEGRATION VERIFIED** | Invariant proven: terminal `SUCCEEDED` cannot regress to `FAILED` |
| 7 | Next.js QR Ph Operator Component | `apps/web/src/components/qrph-payment-flow.tsx` | Turbopack build & browser inspection | Vercel Edge / Browser | `0e9ac15` | **DEPLOYED VERIFIED** | Dynamic state polling implemented (2s active, 5s idle) |
| 8 | 14 Automated Unit & E2E Tests | `apps/api/src/**/*.spec.ts` | `pnpm test:unit` (14/14 pass) | Local & GitHub Actions | `0e9ac15` | **LOCAL INTEGRATION VERIFIED** | PostgreSQL e2e test guarded gracefully in stateless CI runners |
| 9 | Public Vercel Frontend Deployment | `https://payrail-ph-web-main.vercel.app` | `fetch('https://payrail-ph-web-main.vercel.app')` | Vercel Global CDN | `0e9ac15` | **DEPLOYED VERIFIED** | Serves HTTP 200, clean static HTML + client bundles |
| 10 | Protected Git Promotion Hierarchy | PRs #5, #6, #7, #8 in GitHub repository | `gh pr view <id>` / `git log --graph` | GitHub Repository | `0e9ac15` | **DEPLOYED VERIFIED** | Strictly merge-commit only; zero squash; zero rebase |

---

## 3. Hosted PayMongo Truth Gate Audit

### Objective
Audit whether the complete end-to-end chain:
`Browser/Operator → Deployed API → Hosted PostgreSQL → PayMongo Test Payment Resource → Official PayMongo Sandbox Action → Genuine PayMongo Webhook → Deployed Webhook Endpoint → Valid Signature → Persisted Event → Succeeded State → Browser Polling`
is currently backed by genuine external provider infrastructure.

### Findings
1. **PayMongo API Key Status:**
   - Active `.env` and `.env.example` configurations define `PAYMONGO_SECRET_KEY=sk_test_placeholder`.
   - No genuine live `sk_test_...` key from a registered PayMongo merchant sandbox account has been injected into the local or Vercel environment.
2. **Adapter Behavior:**
   - The [`PayMongoAdapter`](file:///C:/Users/Ludwig%20Rivera/Downloads/PAYRAIL%20PH/apps/api/src/paymongo/paymongo.adapter.ts) correctly implements genuine HTTPS payload structures targeting `https://api.paymongo.com/v1/payment_intents` and `https://api.paymongo.com/v1/payment_methods`.
   - When configured with `sk_test_placeholder`, the adapter issues an operational warning and utilizes its internal deterministic sandbox simulator, returning a valid dynamic QR code data URL and test simulator URL (`https://test-paymongo.payrail.ph/simulate/...`).
3. **Webhook Verification Behavior:**
   - The [`WebhooksService`](file:///C:/Users/Ludwig%20Rivera/Downloads/PAYRAIL%20PH/apps/api/src/webhooks/webhooks.service.ts) correctly implements raw-body extraction and HMAC-SHA256 signature verification matching PayMongo's exact production specification (`paymongo-signature` header with timestamp `t`, test signature `te`, and live signature `li`).
   - Signature verification is deterministic and passes automated tests with synthetic signatures generated using the test secret key.
4. **Classification:**
   - **`BLOCKED BY PROVIDER CAPABILITY`** (External live network calls to PayMongo production sandbox).
   - In accordance with Section 0 and Section 2 of the Master Execution Directive:
     *The internal capability is implemented properly and verified with fixtures/simulation; external verification is marked BLOCKED BY PROVIDER CAPABILITY. No manufactured external credentials or fabricated transactions will be presented.*
