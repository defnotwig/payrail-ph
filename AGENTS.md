# PayRail PH — Agent and contributor rules

## Product boundary
Build a sandbox-only Philippine payment orchestration portfolio. Release 1 uses PHP and QR payments through PayMongo test mode. Never handle live payments, raw PAN/CVV, or real customer funds. Do not add paid services, required trials, PAYG, billing methods, or automatic upgrades.

## Architecture
- Next.js web, one modular NestJS API, PostgreSQL as the system of record, and a shared worker.
- Keep provider-specific payloads and behavior inside adapters.
- PostgreSQL owns durable jobs and financial state. Cloudflare is a recovery trigger only.
- Keep public demo data sanitized and read-only. Financial operations require authenticated, authorized operator access.
- Do not add production dependencies or change public APIs without recording the reason in the relevant plan and review.

## Financial correctness
- Store PHP amounts as TypeScript bigint and PostgreSQL BIGINT; serialize them as decimal strings.
- Persist a charge operation before calling a provider. Never hold a database transaction open over a network call.
- Treat uncertain provider outcomes as UNKNOWN_REQUIRES_RECONCILIATION; never retry an uncertain charge as a new submission.
- Enforce idempotency, merchant isolation, balanced immutable ledger postings, refund reservations, and claim-token fencing in PostgreSQL.
- Apply only explicitly allowed payment/refund state transitions, with source-specific guards. Webhooks and browser redirects are observations, not permission to bypass those rules.
- Financial mutation code has one primary owner. Review critical financial changes independently.

## Development
- Use strict TypeScript, parameterized SQL, schema validation, and existing workspace tooling.
- For financial behavior, write a failing focused test first, implement the smallest safe change, run relevant checks, then commit a reviewable unit.
- Never claim a test, provider check, scan, or deployment passed unless it ran and produced evidence.
- Keep local simulations, genuine provider sandbox evidence, and deployed evidence clearly labeled.
- Update PLANS.md, the phase build record, and harness/build-log.md when phase scope or acceptance evidence changes.
- Record significant architecture, configuration, and schema decisions as append-only JSON lines in .mex/events/decisions.jsonl.
- Keep documentation lightweight. Add an ADR when its decision is exercised by implementation.

## Git collaboration
- `personal/defnotwig` is the implementation branch; promote it to `dev`, `dev` to `staging`, and `staging` to `main` through pull requests. `fix/*` branches may target any protected branch and must be synchronized downstream after release.
- Do not push directly to `dev`, `staging`, or `main`. Preserve the existing history and authorship. Use merge commits; do not squash, rebase-merge, force-push, or delete protected branches.
- Use Conventional Commit subjects and matching pull request titles with the allowed types `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, and `revert`.
- Keep the primary checkout on `main` for release inspection and implement in the linked `personal/defnotwig` worktree. Do not check out the same branch in more than one worktree.
- Each pull request needs passing CI and an independent Codex review record whose base revision and diff digest match the current change. Any changed source diff needs a fresh review record.
- Keep worktree-local ports, environment files, and test databases isolated. Never commit credentials, provider payloads containing customer data, or sandbox QR codes.
