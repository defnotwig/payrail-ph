# Production Runtime Failure Forensics: QR Ph Checkout "Failed to fetch"

**Target Page:** `https://payrail-ph-web-main.vercel.app/demo/qrph`  
**Also Observed On:** `https://payrail-ph-web-main.vercel.app/` (embedded checkout)  
**Timestamp:** 2026-10-19T08:39:22+08:00  
**Inspection Method:** Headless Chromium/Edge via Chrome DevTools Protocol (CDP Network & Runtime inspection) + Static JS Bundle Forensics

---

## 1. Exact Failure Capture

### User Action
1. User navigates to `https://payrail-ph-web-main.vercel.app/demo/qrph`
2. Form fields default to:
   - Order Reference: `ORD-xxxx`
   - Test Amount (PHP): `1`
   - Idempotency Key: `idem_xxxxxxxxxx`
3. User clicks **"Generate ₱1.00 QR Ph Code →"**

### Network Request Observed
```http
OPTIONS http://localhost:4000/payments HTTP/1.1
Host: localhost:4000
Origin: https://payrail-ph-web-main.vercel.app
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type,idempotency-key
```
```http
POST http://localhost:4000/payments HTTP/1.1
Host: localhost:4000
Origin: https://payrail-ph-web-main.vercel.app
Content-Type: application/json
Idempotency-Key: idem_xxxxxxxxxx
Body: {"amountMinor":"100","currency":"PHP","orderNumber":"ORD-xxxx","description":"PayRail Sandbox Checkout ORD-xxxx"}
```

### Exact Observed Network Error
- **Preflight Error:** `net::ERR_CONNECTION_REFUSED` on `OPTIONS http://localhost:4000/payments`
- **Fetch Error:** `net::ERR_CONNECTION_REFUSED` on `POST http://localhost:4000/payments`
- **HTTP Status:** None (`(failed)`)
- **Console Exception:** `TypeError: Failed to fetch`
- **UI Rendered Message:** `"Failed to fetch"` in red error banner (`#fef2f2`)

---

## 2. Root Cause Analysis

### Code Location: `apps/web/src/components/qrph-payment-flow.tsx`
Lines 42 & 83:
```typescript
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
// ...
const res = await fetch(`${apiBase}/payments`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  },
  body: JSON.stringify({ amountMinor, currency: "PHP", orderNumber, description }),
});
```

### Static Bundle Evidence: `https://payrail-ph-web-main.vercel.app/_next/static/immutable/chunks/3pnrysl4q4oul.js`
In the production-deployed Next.js client bundle:
```javascript
S = t.default.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
// ...
let e = await fetch(`${S}/payments`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": p }, ... });
```
Because `NEXT_PUBLIC_API_BASE_URL` was not supplied as an environment variable in the Vercel project configuration for the web frontend, Next.js evaluated `process.env.NEXT_PUBLIC_API_BASE_URL` as `undefined` at build time, baking in the default fallback: `"http://localhost:4000"`.

When any public browser on any remote device accesses the production site, all API calls are directed to the client device's loopback interface (`localhost:4000`), immediately producing `net::ERR_CONNECTION_REFUSED`, which browser `fetch()` reports as `TypeError: Failed to fetch`.

---

## 3. Boundary-by-Boundary Trace

| Boundary | Description | Status | Evidence / Observation |
|---|---|---|---|
| **BOUNDARY 1** | Browser → Frontend | **PASS** | `https://payrail-ph-web-main.vercel.app/demo/qrph` returns HTTP 200, renders UI, loads scripts and CSS. |
| **BOUNDARY 2** | Frontend → API | **FAIL (BROKEN BOUNDARY)** | Browser attempts to connect to `http://localhost:4000/payments`. Request cannot leave the client machine. |
| **BOUNDARY 3** | API Runtime | **BLOCKED** | Request never arrives at any API instance. |
| **BOUNDARY 4** | API → Database | **BLOCKED** | Blocked by Boundary 2 & 3. |
| **BOUNDARY 5** | API → PayMongo | **BLOCKED** | Blocked by Boundary 2 & 3. |
| **BOUNDARY 6** | PayMongo → Webhook | **BLOCKED** | Blocked by Boundary 5. |
| **BOUNDARY 7** | Webhook → DB/State | **BLOCKED** | Blocked by Boundary 6. |
| **BOUNDARY 8** | Polling → Receipt | **BLOCKED** | Polling also directs to `${apiBase}/payments/${id}`, failing with identical loopback error. |

---

## 4. Remediation Plan

1. **Deploy API on Vercel:**
   - The NestJS API (`apps/api`) must be deployed as a live service on Vercel (`payrail-ph-api` or serverless route).
   - In `apps/api/src/serverless.ts`, fix missing `import "reflect-metadata";` and modern `rewrites` instead of deprecated `builds` in `apps/api/vercel.json`.
   - Configure Vercel project with pooled database connection string (`DATABASE_URL`), `SUPABASE_URL`, `WEBHOOK_ENCRYPTION_KEY`, `PAYMONGO_SECRET_KEY`, and `PAYMONGO_WEBHOOK_SECRET`.

2. **Frontend Routing & Configuration:**
   - In `apps/web/next.config.ts`, implement server-side rewrites from `/api-proxy/:path*` (or `/api/:path*`) to the backend API, or set `NEXT_PUBLIC_API_BASE_URL` to the public API endpoint.
   - When using Next.js rewrites, client requests stay on the same origin (`/api-proxy/payments`), eliminating CORS preflight, browser loopback leakage, and cross-project origin mismatches.

3. **User-Facing Error Copy Hardening:**
   - In `apps/web/src/components/qrph-payment-flow.tsx`, replace raw `err.message` / `"Failed to fetch"` with contextual, user-safe error copy:
     *"We couldn't reach the sandbox payment service. No new payment was submitted. Try again in a moment."*
