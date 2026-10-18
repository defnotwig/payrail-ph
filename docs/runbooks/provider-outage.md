# Runbook: Downstream Payment Provider Outage (PayMongo / Acquirer)

## Severity: P1 (High/Critical)
## Trigger
CloudWatch alert `DownstreamProvider5xxElevated` or Circuit Breaker tripped to `OPEN` state for > 5 consecutive failures.

## Symptoms
- Outbound requests to `https://api.paymongo.com/v1/*` returning HTTP 502, 503, 504 or timing out (> 5000ms).
- Payment Intents remaining in `SUBMISSION_PENDING` or `UNKNOWN_REQUIRES_RECONCILIATION`.
- Circuit Breaker metrics endpoint (`GET /v1/circuit-breaker`) reporting `state: OPEN`.

## Diagnostic Steps
1. **Check Provider Status Page:** Inspect [https://status.paymongo.com](https://status.paymongo.com) for official incident declarations.
2. **Verify Network Egress:** Run diagnostic ping and TLS handshake from within the ECS task:
   ```bash
   curl -I -m 5 https://api.paymongo.com/v1/health
   ```
3. **Inspect Application Error Traces:**
   ```sql
   SELECT id, provider, error_code, response_summary, created_at
   FROM payrail_private.payment_attempts
   WHERE submission_state = 'FAILED'
   ORDER BY created_at DESC LIMIT 20;
   ```

## Immediate Mitigation
1. **Confirm Circuit Breaker Trip:** Ensure the Circuit Breaker is `OPEN` so incoming client checkouts fail fast (0ms) rather than exhausting DB connection pools.
2. **Enable Maintenance / Graceful Notice on Checkout UI:** If the provider outage persists > 15 minutes, update merchant checkout banner to inform consumers that QR Ph processing is temporarily offline.
3. **Queue In-Flight Reconciliations:** Do NOT cancel `SUBMISSION_PENDING` intents. Allow them to transition to `UNKNOWN_REQUIRES_RECONCILIATION` until provider recovery.

## Post-Outage Recovery
1. When provider status clears, Circuit Breaker will enter `HALF_OPEN` and send single canary probe.
2. Run automated catch-up reconciliation:
   ```bash
   pnpm --filter @payrail/api exec ts-node src/reconciliation/run-daily-sync.ts
   ```
