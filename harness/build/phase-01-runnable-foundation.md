# Phase 01 — Runnable monorepo foundation

## Objective
Create the runnable strict-TypeScript pnpm workspace with a Next.js public page, NestJS health API, environment validation, isolated local PostgreSQL, and CI checks.

## Prerequisites and evidence
- Phase 00 commit: 1bacd73ef70b0f84c43c9a6d13c55fd0337aa805.
- Node.js 22.14.0, pnpm 10.30.3, PostgreSQL 17 client/server are installed. A PostgreSQL 17 Windows service is running but its credentials are unavailable; Docker CLI is installed but its engine is not running.
- Current official docs: Next.js 16 requires Node 20.9+; NestJS 12 runtime on Node 22 requires 22.12+. Avoid Nest generators because installed Node is below the CLI generator floor; create the module directly.
- Selected design source: docs/design/assets/payrail-home-reference.png. See docs/design/brief.md and DESIGN.md.
- No Stitch connector is available. The design-critique connector could not accept the full-resolution image (>1 MB); record that limit and use captured browser QA.

## Scope
- Root pnpm workspace, pinned dependencies, strict TypeScript, formatting/lint/build/typecheck scripts, .gitignore, .gitattributes, and CI workflow.
- `packages/database`: checksum-verified SQL migrations under a PostgreSQL advisory lock, with private migration metadata and transactional application.
- apps/web: Next.js 16 app-router landing page faithful to the selected editorial design, responsive layout, accessible same-page navigation, and honest pending evidence state.
- apps/api: NestJS 12 app with /health/live and /health/ready; validate environment with Zod and verify PostgreSQL readiness via SELECT 1.
- Local PostgreSQL bootstrap/stop scripts using a loopback-only isolated cluster when available; no Docker engine required.
- harness/build-log.md phase evidence and this implementation record.

## Files and interfaces
- Root: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc`, `.gitignore`, `.gitattributes`, `tsconfig.base.json`, `biome.json`, `.env.example`, `.github/workflows/ci.yml`.
- Web: `apps/web/package.json`, `apps/web/next.config.ts`, and `apps/web/src/app/{layout.tsx,page.tsx,globals.css,icon.png}` plus two local visual assets under `apps/web/public/images/`.
- API: `apps/api/package.json`, `apps/api/src/main.ts`, `app.module.ts`, `config/environment.ts`, `database/database.pool.ts`, and `health/{health.controller.ts,health.service.ts,health.module.ts}` with unit tests.
- Database: `packages/database/package.json`, `packages/database/src/migrate.ts`, and `packages/database/migrations/0001_private_schema.sql`.
- Local operations: `scripts/start-local-postgres.ps1`, `scripts/stop-local-postgres.ps1`, `docs/development/local-setup.md`.
- Design and evidence: `docs/design/brief.md`, `docs/design/assets/payrail-home-reference.png`, `DESIGN.md`, `harness/design-qa/README.md`, and desktop/mobile browser captures.

## Result
- Status: COMPLETE. See `harness/build-log.md` for executed commands, outcomes, external limitations, and the committed revision.
- Unit coverage: environment parsing and health behavior have explicit API tests; the final run passed 2 files and 5 tests.
- Security: local PostgreSQL is project-owned and loopback-only; no provider secret or real customer data is used; readiness output is generic; static public landing page exposes no payment operation.
- Commit boundary: one focused commit, `feat: add runnable PayRail PH foundation`.

## Interfaces
- GET /health/live returns process liveness without database details.
- GET /health/ready returns ready only after a successful PostgreSQL SELECT 1; database failures return a generic unavailable status without credentials or raw errors.
- `pnpm db:migrate` applies ordered SQL migrations transactionally and rejects edits to previously applied files.
- API environment: API_PORT, DATABASE_URL, WEB_ORIGIN.
- Web environment: NEXT_PUBLIC_API_BASE_URL, defaulting to http://localhost:4000.
- Local database URL: postgresql://payrail@127.0.0.1:55432/payrail_local.

## Implementation steps
1. Create the focused branch and scoped phase/design records before code.
2. Add workspace metadata, pinned tool versions, scripts, lint/format config, CI, and safe environment templates.
3. Add local-only isolated PostgreSQL lifecycle scripts and verify the database server is reachable.
4. Build the API environment schema, pooled database provider, health routes, and unit tests for validation/health contracts.
5. Build the responsive Next.js home page from the selected visual and generated assets; keep private operations and payment actions unavailable.
6. Install from the lockfile, run formatting, lint, typecheck, unit tests, app builds, API smoke checks, and browser-based design QA.
7. Record exact commands/results and commit one reviewable Phase 01 unit.

## Verification commands
- pnpm install --frozen-lockfile
- pnpm format:check
- pnpm lint
- pnpm typecheck
- pnpm test:unit
- pnpm build
- pnpm db:local:start
- pnpm db:migrate
- pnpm --filter @payrail/api start
- HTTP checks for /health/live and /health/ready
- Run Next dev and inspect at 1440 × 1024 plus responsive widths; test all page links and keyboard focus.

## Expected evidence
- Clean dependency install and lockfile.
- Typecheck, format, lint, tests, and production builds pass.
- Isolated PostgreSQL answers readiness; liveness remains independent.
- The migration runner applies the private-schema migration once and reports no pending changes on a second run.
- Public page has no payment controls or fabricated evidence and works responsively.
- Browser comparison against the selected source identifies and fixes P0/P1/P2 mismatches.

## Security and financial considerations
Do not use the existing PostgreSQL service or its credentials. The local dev cluster listens only on 127.0.0.1 and contains synthetic data. Do not add PayMongo credentials or financial mutations in Phase 01. Readiness errors must not expose DSNs or raw database details.

## Commit boundary
One focused commit after all Phase 01 acceptance checks pass: feat: add runnable PayRail PH foundation.
