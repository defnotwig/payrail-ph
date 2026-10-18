# PayRail PH — Execution plan

## Goal
Build a genuine PayMongo sandbox payment orchestration portfolio that demonstrates financial correctness, recovery, security, and operational investigation with zero required infrastructure spend.

## Architecture and scope
- Next.js frontend; one modular NestJS API; Supabase PostgreSQL/Auth; shared local worker; PostgreSQL outbox/jobs; Cloudflare Free recovery trigger.
- GitHub Free CI and PayMongo test mode. Verify actual account quotas and restrictions before hosting.
- PostgreSQL is the source of truth. A verified webhook is persisted with durable work and committed before a bounded immediate processing attempt. The same idempotent handler is invoked by the five-minute recovery trigger.
- Public visitors see sanitized, read-only projections. Financial operations require authenticated operator identity, membership, and permission.
- Sandbox only; no live payments, card data, live failover, microservices, Kafka, required Redis, SSE, or paid infrastructure.
- One primary implementer owns financial mutation logic. Use focused commits, test-first financial development, and independent review at critical subsystem boundaries.

## Milestones

| Milestone | Completion evidence |
|---|---|
| M0 — Engineering Core | Runnable application, PostgreSQL, integer money, authentication, and merchant isolation. |
| M1 — Working Fintech MVP | Genuine sandbox QR lifecycle; verified durable webhooks; concurrent idempotency; durable PostgreSQL jobs; immutable balanced ledger; browser status. |
| M2 — PayMo Portfolio Release | Reconciliation, supported refunds, operations UI, Reliability Lab, observability, security/performance/chaos evidence, hosted verification, and documentation. |

Phase 07 provides an early integration demo; it does not complete M1 before durable jobs and ledger verification pass.

## Dependency-ordered phases

| Phase | Deliverable | Gate |
|---|---|---|
| 00 | Lightweight operating documents and evidence format | Financial constraints and next step are clear. |
| 01 | Runnable pnpm monorepo, web/API health routes, environment validation, checksum-verified SQL migrations, isolated PostgreSQL, CI skeleton | Clean install, typecheck, build, migration setup, health/readiness. |
| 02 | PHP money/currency, allocation, SQL transaction helper, merchant/order foundation | Property, round-trip, invalid-input, rollback, and constraint tests. |
| 03 | Supabase operator sessions, membership authorization, permission matrix, restricted DB roles | Cross-merchant, role, forged/expired session, and browser-access tests. M0. |
| 04 | Payment intents/attempts, exact transitions, request fingerprints, idempotency, durable submission records | Concurrent same-key requests create one operation; conflict and unknown-attempt protections pass. |
| 05 | Controlled PayMongo sandbox contract probe | Genuine sandbox identifiers/signature evidence and documented account capabilities; sanitized fixtures. |
| 06 | Raw-body signature verification, webhook delivery history/inbox, deduplication, durable work, bounded immediate processing | Persist before acknowledge; invalid events rejected; DB failures retryable; duplicates/out-of-order/unmatched events safe. |
| 07 | Thin real checkout: order → intent → PayMongo → webhook → database → browser | Provider test action and webhook observed; safe normalized state and polling; duplicate-submit protection. Ledger remains pending. |
| 08 | Shared PostgreSQL job dispatcher, leases/fencing, retries/DLQ, local worker, Cloudflare recovery trigger | Claims, crash recovery, stale-owner rejection, duplicate dispatch, scheduler outage recovery pass. |
| 09 | Balanced immutable double-entry ledger and inspection | Imbalance/history mutation rejected; duplicate/concurrent posting safe. M1. |
| 10 | Permissioned operations dashboard and investigation views | Roles, failures, accessibility, keyboard use, responsive widths and themes verified. |
| 11 | Reconciliation observations, runs/items, discovery, deterministic repair/investigation | Missing webhook recovery, provider/local-only discovery, mismatches, repeated safe repair. No bank settlement claim. |
| 12 | Authorized refunds with reservations and compensating entries | Supported full/partial sandbox refunds, concurrent ceiling, duplicate request, unknown reservation and failure behavior pass. |
| 13 | Redacted observability, correlation, metrics, persistent breaker, safe replay, Reliability Lab | Stored facts back scenario outcomes; replay idempotent; breaker preserves resolution. |
| 14 | Threat-driven security, performance, chaos, runbooks, independent review | Required failures exercised; no unresolved Critical/High findings; honest performance evidence. |
| 15 | Hosted portfolio release | Exact revision/CI/deployment linkage, sandbox/recovery, responsive QA, cost audit, runbooks and recruiter walkthrough. M2. |

## Core contracts
- PHP only; bigint minor units internally and PostgreSQL BIGINT; JSON uses decimal minor-unit strings.
- Server-created orders determine payable amounts. Provider amount conversions have explicit range checks.
- Mutation idempotency scope is merchant + operation + key; a different request fingerprint conflicts.
- At most one unresolved charge-producing attempt per intent. Persist operation identity before provider I/O. Never transact across provider I/O.
- Ambiguous outcomes stay UNKNOWN_REQUIRES_RECONCILIATION. Do not submit another charge or fail over after uncertainty.
- State changes and required outbox work commit atomically. Business-effect uniqueness does not depend on webhook event IDs.
- Ledger history and audit evidence are immutable. Refund success plus pending/unknown reservations never exceed confirmed captured value.
- Job completion is fenced by claim token. PostgreSQL owns work; immediate processing and scheduled recovery share one idempotent handler.
- Payment and refund states use separate enums. The exact transition graph is in docs/architecture/database-invariants.md; event/source/guard rules must be finalized before Phase 04 implementation.

## Verification expectations
Use the repository's pinned tooling and scripts. Required checks will include formatting, lint, typecheck, unit, integration, concurrency, provider-contract, end-to-end, build, security, phase verification, sandbox, and deployment checks. Do not mark a check complete before it exists and runs. Financial development follows failing test → minimum implementation → passing checks → focused commit.

Mandatory scenarios include concurrent intent creation/webhooks/postings/refunds/job claims; provider acceptance with lost response; idempotency expiry; webhook before mapping; stale events and workers; database failure before acknowledgment; immediate/recovery race; scheduler outage; cross-merchant access; replay abuse; and reconciliation recovery.

## Zero-cost and external gates
Do not enable PAYG, trials that are required to run, payment-method attachment, paid add-ons, or automatic upgrades. Before provisioning, verify account plans, quotas, free-project capacity, and restore procedures. If free hosting is unavailable, preserve local verification and record the hosting blocker.

PayMongo Phase 05 must verify QR creation/retrieval/test behavior, lookup, signature contract, endpoint idempotency, refund capability, and provider retention. Never expose a scannable sandbox QR or tell a tester to pay it; use provider test_url. Do not weaken webhook signature verification to accommodate undocumented differences. Document discovery/pagination gaps; do not claim complete reconciliation without evidence.

## Phase evidence
Every phase records revision, implementation, commands/results, external evidence, limitations, and next phase in harness/build-log.md. Label local simulation, genuine sandbox activity, and deployed evidence distinctly. Create a focused phase build file before implementation. Create ADRs alongside exercised decisions, not as upfront placeholders.
