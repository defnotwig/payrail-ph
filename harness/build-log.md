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
- GitHub repository settings were verified: merge commits enabled; squash, rebase, and branch deletion disabled; `main` remains default. Branch protections on `dev`, `staging`, and `main` require PRs, strict `verify` and `review-evidence`, resolved conversations, and enforce administrator rules; force pushes and deletion are disabled. The selected solo process has no required second-human approval.
- PR #1 (`personal/defnotwig` → `dev`) merged as `3c62834af3160c5b1e212e02b2e04b8b316c98a8`. Final PR head `7035996e48a4c3c22d62adca967af98f492434af` passed both required checks in [CI run 39108908266](https://github.com/defnotwig/payrail-ph/actions/runs/39108908266); the merge commit passed `dev` push CI in [run 39108973132](https://github.com/defnotwig/payrail-ph/actions/runs/39108973132). Its merge subject has a duplicated PR number because the initial title policy did not account for GitHub's automatic suffix; a follow-up rule now rejects numbered PR titles and preserves that one historical merge by exact SHA.
- Independent Codex review evidence is recorded under `harness/code_review/reviews/`. The CI title-policy correction and the `dev` → `staging` → `main` promotion PRs remain pending.
- Hosted deployment and provider capability audits remain pending; no genuine PayMongo sandbox activity has occurred.
- Evidence type: repository-hosting/CI evidence and local source scan. No genuine provider sandbox activity or Vercel/Supabase deployment has occurred.
- Next: finish the CI title-policy correction PR and verify protected promotions through `staging` and `main` using merge commits.

## Financial integrity qualification (phases 04, 06, 08, 09, 11, 12)
- Status: LOCAL QUALIFICATION COMPLETE; genuine provider and hosted evidence pending.
- Scope: carried partial financial implementation was reviewed and completed for webhook observation matching, event dedupe plus state/ledger/outbox atomicity, no-resubmit behavior for uncertain charges, verified-observation-only reconciliation repair, SQL refund reservation/idempotency, append-only balanced journal invariants, and claim-token worker fencing. Added migration 0006 for per-claim fencing tokens.
- Test-first evidence: the existing PostgreSQL suite first failed on webhook success, amount mismatch, and dependent refund cases; the test-only fee policy initially failed because its helper module was absent. Repairs and bounded tests followed.
- PostgreSQL integration: `pnpm --filter @payrail/api test:unit -- src/financial/fee-policy.spec.ts src/financial/financial.integration.spec.ts src/jobs/durable-jobs.service.spec.ts src/reconciliation/reconciliation.service.spec.ts` passed 4 files / 23 tests. The integration suite used PostgreSQL at `127.0.0.1:55434`, admin URL `postgresql://payrail@127.0.0.1:55434/postgres`, created a unique `payrail_financial_test_<uuid>` database, applied all migrations 0001–0006, and dropped that database at teardown. It exercised ten-way idempotent creation, ten-delivery webhook concurrency, wrong amount discrepancy handling, unknown outcome no-resubmit, concurrent refund ceiling, direct SQL ledger/audit immutability and balance checks, verified-observation reconciliation repair, and stale worker completion/failure fencing.
- `pnpm --filter @payrail/api typecheck` passed.
- Fee arithmetic is a test-only BigInt fixture: fixed minor units plus basis points, half-up rounding, currency check, and min/max bounds. Values are synthetic and do not represent provider pricing.
- Limitations: fixture mode only; no genuine PayMongo sandbox request or refund capability evidence was collected. Provider refund submission remains disabled outside fixture mode. No secondary provider is configured, so no failover path was exercised; uncertain requests remain UNKNOWN and are not re-submitted. Existing reconciliation is local evidence processing, not provider API polling or bank settlement reconciliation.
