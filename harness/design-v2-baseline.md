# PayRail PH — Product Experience V2 Baseline

**Baseline Date:** 2026-10-19 00:10:00+08:00  
**Repository Working Directory:** `C:\Users\Ludwig Rivera\Downloads\PAYRAIL PH`  
**Current Git Branch:** `main`  
**Head Commit SHA:** `5fdfcae8245c635e523d1ec9c3c13a26d95da416`  
**Live Production Deployment:** `https://payrail-ph-web-main.vercel.app`

---

## 1. Automated Verification Baseline

| Check | Scope | Exit Code | Result Summary |
| :--- | :--- | :---: | :--- |
| `pnpm install --frozen-lockfile` | Monorepo | 0 | Frozen lockfile verified, 0 resolution drift |
| `pnpm format:check` | 115 files | 0 | Biome format 100% compliant |
| `pnpm lint` | 102 files | 0 | 0 errors, 0 warnings |
| `pnpm typecheck` | `@payrail/web`, `@payrail/api`, `@payrail/database` | 0 | 0 TypeScript diagnostics |
| `pnpm test:unit` | 21 test files | 0 | 80 passed, 14 skipped (db-guarded), 0 failed (94 total) |
| `pnpm test:security-http` | NestJS HTTP runtime | 0 | 8/8 suites passed |
| `pnpm test:repo-policy` | Commit & PR rules | 0 | 10/10 suites passed |
| `pnpm build` | All packages | 0 | Next.js Turbopack 15/15 static routes compiled |

---

## 2. Current Frontend Route Inventory

- `GET /` — Public homepage with Build 3 visual design and interactive demo form
- `GET /_not-found` — Custom 404 page
- `GET /icon.png` — Dynamic icon route
- `GET /ops` — Operator console overview
- `GET /ops/transactions` — Operator transactions list
- `GET /ops/cards` — Card processing & 3DS simulator
- `GET /ops/refunds` — Refund operations & capacity manager
- `GET /ops/ledger` — Double-entry general ledger journal explorer
- `GET /ops/reconciliation` — 3-way automated settlement reconciliation
- `GET /ops/jobs` — Durable asynchronous jobs & DLQ triage
- `GET /ops/developer` — API keys & merchant outbound webhooks
- `GET /ops/reliability-lab` — Chaos testing & fault injection suite
- `GET /ops/iso8583` — ISO 8583 educational binary bitmap lab
