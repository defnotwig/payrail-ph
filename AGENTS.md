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
