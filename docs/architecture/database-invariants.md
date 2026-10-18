# Database and financial invariants

This is the normative Phase 00 contract. Payment transition values below are exact enum values; no narrative grouping or wildcard appears in the transition graph. Before Phase 04, define each edge's exact event, source, and guard, then test the graph exhaustively and prove TypeScript/PostgreSQL enum parity.

## Money and identity
- Release 1 currency is PHP.
- Store amounts as integer minor units in TypeScript bigint and PostgreSQL BIGINT; serialize API amounts as decimal strings.
- The order amount is server-established and immutable for an attempted payment.
- Provider conversions perform explicit range checks and reject unsupported precision or overflow.
- Every private financial row is scoped to a merchant. Authorization derives merchant access from membership, never caller-supplied merchant IDs alone.
- Runtime database access is restricted; browser roles cannot read or mutate private financial schemas.

## Exact payment state values and graph

~~~ts
export const paymentTransitions = {
  CREATED: ["SUBMISSION_PENDING"],
  SUBMISSION_PENDING: [
    "SUBMITTED",
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION",
  ],
  SUBMITTED: [
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION",
  ],
  AWAITING_PAYMENT: [
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION",
  ],
  PROCESSING: [
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION",
  ],
  UNKNOWN_REQUIRES_RECONCILIATION: [
    "SUBMITTED",
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
  ],
  SUCCEEDED: [],
  FAILED: ["SUBMISSION_PENDING", "SUCCEEDED"],
  EXPIRED: ["SUBMISSION_PENDING", "SUCCEEDED"],
} as const;
~~~

The matching PostgreSQL enum is exactly:
CREATED, SUBMISSION_PENDING, SUBMITTED, AWAITING_PAYMENT, PROCESSING, SUCCEEDED, FAILED, EXPIRED, UNKNOWN_REQUIRES_RECONCILIATION.

Every edge also requires a specific event, source, and guard. Allowed source enum values are API, PROVIDER_ADAPTER, VERIFIED_WEBHOOK, and RECONCILIATION. Finalize the edge table before Phase 04; do not infer permission from graph membership alone.

Mandatory guards:
- CREATED → SUBMISSION_PENDING: authorized submission and durable operation record committed first.
- FAILED/EXPIRED → SUBMISSION_PENDING: authorized new attempt, definitive prior outcome, and no successful or unresolved charge-producing attempt.
- FAILED/EXPIRED → SUCCEEDED: authoritative reconciliation only.
- Provider observations match merchant, provider account/environment, amount, currency, and attempt.
- Direct transitions to SUCCEEDED may accommodate skipped intermediate observations if the observation is authoritative and all identity/value guards pass.
- An event stale relative to current state is recorded but makes no transition.
- A conflicting success after a previously definitive failure/expiry remains an investigation discrepancy until authoritative reconciliation.
- UNKNOWN_REQUIRES_RECONCILIATION is unresolved, not terminal. It blocks another charge attempt.
- Browser redirects, polling stops, and countdown expiry cannot establish a financial outcome.

## Refund state values and graph

Refunds use a separate enum, never the payment enum:

~~~ts
export type RefundState =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN";
~~~

The matching PostgreSQL refund enum is exactly PENDING, SUCCEEDED, FAILED, UNKNOWN. Permitted edges are PENDING → SUCCEEDED, PENDING → FAILED, PENDING → UNKNOWN, UNKNOWN → SUCCEEDED, and UNKNOWN → FAILED. Payment success remains independent from refund processing. Event/log names identify the entity, such as refund.state_changed.

An unknown refund keeps its reservation until an authoritative outcome resolves it. Confirmed successful refunds plus PENDING and UNKNOWN reservations must never exceed captured value. A definitive failure releases its reservation.

## Idempotency and attempts
- Mutation keys are unique by merchant + operation + key.
- Persist a normalized request fingerprint; reuse with different input returns a deterministic conflict.
- A provider operation key and durable submission record exist before the network call.
- At most one unresolved charge-producing attempt exists per intent.
- Provider idempotency retention does not shorten local operation history.
- An ambiguous provider result cannot be retried as a fresh charge or sent to an alternate provider.
- Financial business-effect uniqueness is independent of webhook delivery/event IDs.

## Webhooks, outbox, and jobs
- Verify the exact raw body, signed timestamp, and supported signature contract before accepting a delivery.
- Persist delivery history, deduplicated event identity, inbox work, and required outbox records before acknowledging.
- State changes and required outbox work commit atomically.
- Immediate processing starts only after commit; recovery invokes the same idempotent handler.
- Job claims use leases and unique fencing/claim tokens. A stale owner cannot commit completion or financial effects.
- Retry only eligible work with bounded attempts/backoff. Ambiguous provider mutations enter resolution work, not ordinary submission retry.
- Duplicate and stale observations remain auditable and have no duplicate financial effect.

## Ledger and audit
- Each posted transaction has at least two entries and balances per currency.
- Confirmed payment: debit PSP clearing, credit merchant payable.
- Confirmed refund: debit merchant payable, credit PSP clearing.
- Do not invent fees, net, or settlement facts unsupported by provider evidence.
- Posted ledger transactions, entries, and audit records are append-only. Corrections use compensating entries.
- A unique business-effect key prevents duplicate posting across webhook IDs, API retries, and reconciliation.
- Reconciliation records discrepancies before repair; repairs use the same guarded, idempotent financial handlers.
