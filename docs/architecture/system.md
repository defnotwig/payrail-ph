# System architecture

## Runtime shape

~~~mermaid
flowchart LR
  Browser --> Web[Next.js web]
  Web --> API[NestJS modular API]
  API --> Auth[Supabase Auth]
  API --> DB[(PostgreSQL)]
  API --> PM[PayMongo test API]
  PM --> Hook[Verified webhook ingress]
  Hook --> DB
  Hook -. after durable commit .-> Fast[Bounded immediate processor]
  Fast --> Handler[Shared idempotent job handler]
  Worker[Local worker] --> Handler
  CF[Cloudflare Free recovery trigger\n5-minute schedule] --> API
  API --> Handler
  Handler --> DB
  DB --> Ledger[Immutable ledger]
~~~

The API and web are deployable as separate Vercel Hobby projects when free account limits permit. The worker is also runnable locally. PostgreSQL owns payment state, webhook inbox, outbox/jobs, idempotency records, audit evidence, and ledger postings. Cloudflare holds only the recovery-trigger credential and never owns financial work.

## Request and payment flow
1. An authenticated merchant operator creates an order using server-authorized amount and currency.
2. The API creates or returns an idempotent payment intent. Before any provider call, it commits a durable attempt and provider operation key.
3. The API calls the PayMongo adapter outside the transaction. A definitive response updates the attempt under guarded transitions. A timeout or ambiguous response becomes UNKNOWN_REQUIRES_RECONCILIATION; it cannot cause another charge submission.
4. PayMongo sends a webhook to the API. The ingress verifies the exact raw request body and timestamp/signature, writes delivery evidence plus deduplicated inbox and durable work, then commits.
5. After commit, Vercel's supported waitUntil() integration may attempt bounded immediate processing. The HTTP acknowledgment does not wait for financial processing. If immediate processing is cancelled or fails, the five-minute Cloudflare trigger finds the same PostgreSQL work and invokes the same handler.
6. The handler validates provider identity, merchant/account/environment, attempt, amount, and currency; it applies the guarded transition and required ledger/outbox effect atomically.
7. The browser polls normalized intent status with bounded backoff. Redirects and countdown expiry do not establish payment outcomes.

The under-one-second fast-path target measures durable webhook acceptance to financial commit under normal conditions. Report it separately from provider latency and browser polling; it is a target, not an assumed guarantee.

## Domain boundaries
- apps/web: checkout, operator UI, server-side session transport, status polling.
- apps/api: versioned HTTP API, authorization, webhook ingress, and modular orchestration.
- apps/worker: local process entrypoint for shared handlers.
- packages/contracts: validated provider-neutral API contracts and normalized errors.
- packages/payments: money, payment states/attempts, PayMongo adapter boundary.
- packages/database: migrations, parameterized SQL, transactions, invariant queries.
- packages/ledger: balanced posting validation and accounting operations.
- packages/jobs: durable work, claims, retries, and recovery.
- packages/observability: redacted logs, correlation, protected metrics.
- packages/testing: provider fixtures and local-only fault injection.
- infrastructure/scheduler: Cloudflare recovery trigger.
- tests: end-to-end and performance evidence.

Raw PayMongo objects remain inside the adapter and sanitized evidence fixtures. Provider observations do not bypass state transition guards.

## Identity and access
Supabase Auth establishes operator identity. Private database membership and permission records determine merchant access. Public signup is disabled. Runtime roles are least-privilege and distinct from migration ownership. Financial tables are not directly accessible to browser roles. Public demo projections are sanitized, read-only, and carry evidence origin and timestamps.

## Reliability
Webhook persistence and durable work are one committed unit. Immediate processing is best-effort and bounded. Recovery uses leased PostgreSQL claims with fencing tokens, idempotent effects, retries, and a dead-letter state. Local worker and authenticated recovery operations remain available when the scheduler is unavailable. A provider circuit breaker may delay calls but cannot discard or resolve uncertain financial operations.
