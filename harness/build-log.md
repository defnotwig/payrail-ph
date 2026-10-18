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

## Phase 01A — Public repository and delivery bootstrap
- Status: IN PROGRESS
- Date: 2026-10-18
- Scope: public GitHub repository, original history publication, requested branches, contributor/security guidance, MIT licensing, Conventional Commit and promotion validation, exact-diff review evidence, and protected merge-commit CI.
- Public repository: `https://github.com/defnotwig/payrail-ph`; `main` is the default branch. Initial publication preserved the existing three commits and recorded this empty-remote bootstrap exception.
- Branches `personal/defnotwig`, `dev`, `staging`, and `main` were all created from `75386a231e060f81b0ea4e8959fa92ca5c36ef96` and published.
- Prepublication secret scan: Gitleaks 8.30.1 scanned all three reachable commits and the committed source tree; no leaks were found. Eight generic-key matches in ignored `.next` build metadata were not tracked and were excluded from the committed-source scan.
- Initial GitHub CI runs passed on all four branches at the verified foundation: [main](https://github.com/defnotwig/payrail-ph/actions/runs/39106239947), [personal](https://github.com/defnotwig/payrail-ph/actions/runs/39106240096), [dev](https://github.com/defnotwig/payrail-ph/actions/runs/39106240448), and [staging](https://github.com/defnotwig/payrail-ph/actions/runs/39106240779).
- Current PR, branch-protection, merge-policy, and deployed-environment evidence is pending completion of this phase.
- Evidence type: repository-hosting/CI evidence and local source scan. No genuine provider sandbox activity or Vercel/Supabase deployment has occurred.
- Next: complete the public operating files and CI policy, review and merge to `dev`, then promote to `staging` and `main` using merge-commit PRs.
