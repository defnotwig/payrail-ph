# Build log

Record factual evidence by phase. Label each item as local simulation, genuine provider sandbox activity, or deployed verification. Never infer a pass from code inspection alone.

## Phase 00 — Lightweight project operating system
- Status: COMPLETE
- Date: 2026-10-18
- Scope: create the approved six operating documents, this build log, the focused phase record, and the append-only decision log.
- Environment observed: Windows PowerShell; Node/pnpm, Git, Docker CLI, PostgreSQL, Vercel CLI available; Docker engine unavailable; Supabase CLI unavailable. Recheck during Phase 01.
- Evidence: required files non-empty; Markdown fences balanced; payment state graph keys/order and separate refund enum verified; staged diff passed git diff --check. Documentation-only verification; no application tests apply.
- Limitations: no application code, database instance, provider credentials, sandbox activity, or deployment has been verified. Commit: 1bacd73ef70b0f84c43c9a6d13c55fd0337aa805.
- Next: Phase 01 — runnable foundation.
## Phase 01 — Runnable foundation
- Status: COMPLETE
- Date: 2026-10-18
- Scope: pinned pnpm workspace, responsive Next.js public portfolio home, NestJS health API, Zod environment validation, checksum-verified SQL migrations, isolated local PostgreSQL scripts, and CI skeleton.
- Selected design: option 3, source copied to docs/design/assets/payrail-home-reference.png; design brief and semantic tokens created.
- Environment: Node 22.14.0, pnpm 10.30.3, PostgreSQL 17 client/server available; Docker engine unavailable. The project uses its own loopback-only local PostgreSQL cluster and does not use the unrelated Windows PostgreSQL service.
- Verification: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` (2 files, 5 tests), and `pnpm build` passed. Migration 0001 applied once and the second run found zero pending migrations. API `/health/live` and `/health/ready` returned 200 with the isolated database running; with it stopped, liveness remained 200 and readiness returned a generic 503.
- Design QA (local browser): desktop 1487×1058 and mobile 390×844; no horizontal overflow from 320px through 1487px across nine checked widths; all five same-page links resolved; first keyboard focus showed a visible 3px cobalt outline; both optimized local images loaded; no Next image optimizer requests; zero browser console errors. Captures: `harness/design-qa/payrail-desktop.png` and `harness/design-qa/payrail-mobile.png`.
- Evidence type: local simulation only. No PayMongo credentials, genuine provider sandbox activity, or deployment are configured. The reference-image critique connector rejected the 1.5 MB source at its 1 MB input limit; browser visual review was used.
- Limitations: Docker engine unavailable; the isolated local PostgreSQL cluster is the supported local path. M0 remains incomplete because money primitives, authentication, and merchant isolation belong to later phases.
- Implementation commit: 50b9a4d (`feat: add runnable PayRail PH foundation`).
- Next: Phase 02 — money and SQL primitives.
