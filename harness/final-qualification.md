# PayRail PH Final PayMo Qualification Tracker

Baseline: `ea6926ba165c5205d9979b047c23ee8e869247fc` (`main`, 2026-10-18 audit). This is the pre-fix assessment. Refresh each row only when new evidence is run and retained. `BLOCKED_EXTERNAL` describes missing external evidence/access; it is not a passed check.

Allowed status values in every status column: `NOT_IMPLEMENTED`, `PARTIAL`, `IMPLEMENTED`, `TESTED`, `PROVIDER_VERIFIED`, `HOSTED_VERIFIED`, `BLOCKED_EXTERNAL`, `NOT_APPLICABLE`.

| ID | PayMo requirement | Subsystem | Implementation status | Test status | Provider status | Hosted status | Evidence | Blocking issue | Assigned owner |
|---|---|---|---|---|---|---|---|---|---|
| Q01 | React responsive UI | Public and operations UI | PARTIAL | PARTIAL | NOT_APPLICABLE | PARTIAL | Main build; hosted web GET only | Operations are fixtures; no viewport/accessibility suite | Product |
| Q02 | React Hooks and state management | Checkout and ops | PARTIAL | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | Source review | No API-backed operator state or browser test | Product |
| Q03 | NestJS REST APIs | API | PARTIAL | PARTIAL | NOT_APPLICABLE | BLOCKED_EXTERNAL | 55 unit tests; no real HTTP boot | Constructor DI and route security unverified | Security |
| Q04 | High-concurrency APIs | Payments, refunds, jobs | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | Unit suite has no real database concurrency | Isolated PostgreSQL barriers/tests | Financial |
| Q05 | Low latency | API and database | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | SLO documentation only | No measured API/DB latency | Financial |
| Q06 | Webhooks | Provider ingress | PARTIAL | PARTIAL | BLOCKED_EXTERNAL | BLOCKED_EXTERNAL | Synthetic HMAC tests; placeholder bypass found | Genuine secret/event and durable processing | Financial |
| Q07 | Application monitoring | Logging and SLO | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | BLOCKED_EXTERNAL | SLO/runbooks; no observed metrics | Instrumented runtime evidence | Security |
| Q08 | SQL query optimization | PostgreSQL | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | No captured query plans | Explain real target queries and justify indexes | Financial |
| Q09 | PostgreSQL schema | Financial state | PARTIAL | PARTIAL | NOT_APPLICABLE | BLOCKED_EXTERNAL | Migrations 0001–0003; several service/schema mismatches | Add constraints and apply to isolated hosted schema | Financial |
| Q10 | Cloud deployment | Web/API/database | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | BLOCKED_EXTERNAL | Public Vercel web GET; CLI has no credentials | Discover API/database deployment and revision linkage | Main |
| Q11 | Third-party PSP integration | PayMongo | PARTIAL | PARTIAL | BLOCKED_EXTERNAL | BLOCKED_EXTERNAL | Placeholder selects synthetic adapter | Real test account, event, and hosted path | Product |
| Q12 | Environment and secrets security | All services | PARTIAL | PARTIAL | NOT_APPLICABLE | BLOCKED_EXTERNAL | Placeholder/default credentials in source config | Fail-closed config and hosted secret provisioning | Security |
| Q13 | Database access controls | PostgreSQL | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | BLOCKED_EXTERNAL | Private schema revoke only | Restricted runtime roles, tenant boundary, deployed grants | Security |
| Q14 | Strict idempotency | Payments and refunds | PARTIAL | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | Existing unit tests; absent-row ownership race | Atomic unique-key claims with real concurrency proof | Financial |
| Q15 | Incident troubleshooting | Runbooks | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | Runbook documents | Validate against observable operations and fault evidence | Security |
| Q16 | Retries and backoff | Durable jobs | PARTIAL | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | Mock-oriented tests | Retry classification, real worker, lease recovery | Financial |
| Q17 | Dead-letter queue | Jobs and operations UI | PARTIAL | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | Service code and fixture UI | Fenced, authorized, durable replay | Financial |
| Q18 | Provider downtime behavior | Provider adapter and recovery | PARTIAL | PARTIAL | BLOCKED_EXTERNAL | NOT_IMPLEMENTED | In-memory circuit-breaker unit tests | Durable observation/recovery; hosted proof | Financial |
| Q19 | Unit tests | API | TESTED | TESTED | NOT_APPLICABLE | NOT_APPLICABLE | Baseline 55 tests/13 files | Expand assertions for corrected behaviors | Financial |
| Q20 | Integration tests | API/PostgreSQL | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | Existing optional E2E silently skips without PostgreSQL | Required disposable database suite | Financial |
| Q21 | Concurrency tests | Database | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | No actual concurrent test evidence | Parallel connection tests with barriers | Financial |
| Q22 | Browser E2E tests | Web/API | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | No Playwright suite | Authenticated, persistent end-to-end flows | Product |
| Q23 | Fee calculation | Test-only fee policy | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_APPLICABLE | No fee module | Bigint policy; distinguish provider fees | Financial |
| Q24 | Immutable audit | Audit and ledger | PARTIAL | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | Audit service/table; no DB mutation guard | Append-only permissions and direct SQL tests | Financial |
| Q25 | OpenAPI/Swagger | API contracts | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | No generated schema | Document and validate actual secured routes | Security |
| Q26 | Merchant integration docs | Machine API/webhooks | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | README fragments only | Accurate auth, keys, idempotency, webhooks and errors | Security |
| Q27 | Authentication | Operator identity | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | Self-issued HMAC session; header bypass | Supabase Auth and fail-closed HTTP tests | Security |
| Q28 | Authorization and merchant isolation | All operations | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | Caller-selected tenant/role | Membership-based route and database checks | Security |
| Q29 | JWT | API identity | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | Custom token not OAuth/OIDC JWT | Verify Supabase signature, issuer, audience and expiry | Security |
| Q30 | OAuth2/OIDC | Login | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_APPLICABLE | BLOCKED_EXTERNAL | No OIDC integration | Supabase provider setup/consent if selected | Security |
| Q31 | SHA-256 and HMAC | Keys and webhooks | PARTIAL | PARTIAL | BLOCKED_EXTERNAL | NOT_IMPLEMENTED | Synthetic-only tests; signature bypass | Genuine signature contract and test event | Security |
| Q32 | PCI scope practices | Card entry | PARTIAL | NOT_IMPLEMENTED | BLOCKED_EXTERNAL | NOT_IMPLEMENTED | UI/API accept PAN/CVV | Remove card data handling; verify provider-hosted flow | Product |
| Q33 | Decimal/currency precision | PHP amounts | IMPLEMENTED | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | bigint/decimal-string foundation | Add cross-layer boundary tests and fee model | Financial |
| Q34 | State synchronization | Webhook, API, browser | PARTIAL | PARTIAL | BLOCKED_EXTERNAL | NOT_IMPLEMENTED | Local synthetic flow | Authoritative observations, restart and hosted proof | Financial |
| Q35 | Cross-layer tracing | Browser/API/database/provider | NOT_IMPLEMENTED | NOT_IMPLEMENTED | BLOCKED_EXTERNAL | NOT_IMPLEMENTED | No correlation propagation | Add redacted trace IDs and observed release evidence | Security |
| Q36 | Capture, void, refund | Provider capability and lifecycle | PARTIAL | PARTIAL | BLOCKED_EXTERNAL | NOT_IMPLEMENTED | Hard-coded capability flags; refund fabricates success | Probe account and require authoritative evidence | Financial |
| Q37 | Settlement | Reconciliation/reporting | PARTIAL | PARTIAL | BLOCKED_EXTERNAL | NOT_IMPLEMENTED | Local run code only | No verified settlement feed or hosted data | Financial |
| Q38 | Chargebacks/disputes | Provider lifecycle | PARTIAL | NOT_IMPLEMENTED | BLOCKED_EXTERNAL | NOT_IMPLEMENTED | Capability flags only | No verified provider event or workflow | Financial |
| Q39 | ISO 8583 | Educational lab | TESTED | TESTED | NOT_APPLICABLE | PARTIAL | Local 0200/0210 unit tests | Validate subset and label no bank network | Product |
| Q40 | JSON payment protocol | API contracts | PARTIAL | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | JSON routes and source only | OpenAPI contract, validation, integration tests | Security |
| Q41 | Async/event-driven Node | Outbox and worker | PARTIAL | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | Job/outbox helper code | Production dispatcher and worker absent | Financial |
| Q42 | SQL transactions and rollback | Financial services | IMPLEMENTED | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | Transaction calls; mocks only | Real rollback/restart tests | Financial |
| Q43 | Isolation and row locking | Payments/refunds/jobs | PARTIAL | PARTIAL | NOT_APPLICABLE | NOT_IMPLEMENTED | Locking code; race not proven | PostgreSQL lock and stale-worker concurrency tests | Financial |
| Q44 | SQL query tuning | Lists, detail, claims, reconciliation | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | No EXPLAIN evidence | Capture plans, tune only evidence-backed queries | Financial |
