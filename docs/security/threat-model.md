# Initial threat model

## Scope and trust boundaries
Assets include operator sessions, merchant memberships, payment intents/attempts, provider credentials, webhook authenticity, idempotency records, customer-safe checkout data, job claims, audit evidence, and ledger history.

Trust boundaries:
1. Public browser ↔ Next.js web.
2. Web ↔ NestJS API.
3. API ↔ Supabase Auth and PostgreSQL.
4. API ↔ PayMongo test API and webhook ingress.
5. Webhook ingress/fast path ↔ asynchronous worker and Cloudflare recovery trigger.
6. Operator actions ↔ private financial records.

## Threats and required controls

| Threat | Impact | Required control/evidence |
|---|---|---|
| Cross-merchant IDOR or role escalation | Unauthorized financial data or mutation | Membership-derived authorization on every operation; two-merchant role tests. |
| Forged, replayed, stale, or reordered webhook | False payment state or duplicate effects | Raw-body signature/timestamp verification, delivery history, dedupe, guarded transitions, replay tests. |
| Provider accepts charge but response is lost | Duplicate charge | Persist operation before call; stable provider key; UNKNOWN_REQUIRES_RECONCILIATION; no new attempt until resolved. |
| Idempotency key reused with changed data | Wrong amount or duplicate business action | Merchant/operation/key uniqueness plus request fingerprint and deterministic conflict. |
| Concurrent refund requests | Refunds exceed captured funds | Transactional reservations and database-enforced ceiling; concurrent race test. |
| Stale worker finishes after lease loss | Duplicate or stale financial mutation | Claim-token fencing and atomic effect uniqueness; stale-worker test. |
| Database outage or function termination after webhook persistence | Lost or delayed financial processing | Inbox/work persisted before acknowledgment; immediate best-effort path plus PostgreSQL recovery and outage tests. |
| Database role or SQL injection compromise | Broad data access or mutation | Least-privilege runtime roles, parameterized SQL, private schema, migration-role isolation, scanning. |
| Secret or provider payload leakage | Account compromise or personal-data exposure | Secret manager/env validation, log redaction, sanitized fixtures, no raw payload in public/demo data. |
| Server-Side Request Forgery (SSRF) via webhook URLs | Internal cloud metadata/intranet exploitation | Strict destination URL validation: blocks 127.0.0.1, RFC 1918 subnets, and AWS 169.254.169.254. |
| Unbalanced or forged ledger journal postings | Financial leakage / double counting | SQL transactional constraint requiring sum(debits) - sum(credits) === 0; immutable ledger lines. |
| Unauthorized or corrupted DLQ job replay | Re-execution of malicious or stale operations | RBAC enforcement requiring ADMIN role and recording immutable audit event before re-enqueuing. |
| Raw PAN or CVV persistence | PCI DSS non-compliance and cardholder data compromise | CVV is never persisted; PAN is immediately tokenized and stored only in masked format (4111 **** 1111). |
| Sandbox QR confusion or unexpected real-world use | Unintended test payment | Never expose a scannable sandbox QR or direct a person to pay it; show provider test action only. |
| Dependency, deployment, or free-tier interruption | Service degradation, stale operations | Pinned lockfile, CI/scans, local worker/restore procedures, explicit degraded status, no financial loss claims. |
| Reliability demo can mutate hosted finance | Abuse or false confidence | Fault injection local/development-only and authenticated; hosted page shows sanitized recorded evidence only. |

## Security boundaries
- Public surfaces are read-only and backed by explicit sanitized projections.
- Supabase Auth identifies operators; private membership and permission rows authorize merchant actions.
- Browser sessions never receive provider secrets or direct privileges on financial tables.
- Webhook signatures are verified before durable acceptance. Do not add a weaker fallback for undocumented provider behavior.
- Logs and traces use correlation IDs and redaction; avoid credentials, authorization headers, raw customer data, and unfiltered provider payloads.
- Recovery endpoints are authenticated, bounded, and fenced; scheduler credential can only trigger recovery.
- Local fault injection cannot be enabled in hosted production.

## Open validation
This is an initial threat outline, not a security certification. Validate concrete controls during Phases 03, 06, 08, 13, and 14; record findings and remediation evidence in the build log.
