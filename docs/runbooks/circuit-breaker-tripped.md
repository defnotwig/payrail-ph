# Runbook: Provider Circuit Breaker Tripped (OPEN State)

## Severity: P1 / P2
## Trigger
`CircuitBreakerService` reports state `OPEN` for a payment provider (e.g., PayMongo).

## Symptoms
- Outbound API calls fail fast with `503 Service Unavailable` ("Circuit breaker is OPEN for provider... Upstream API is degraded. Failing fast.").
- Zero requests hitting downstream provider; database connection pool is protected.

## Diagnostic Steps
1. **Check Circuit Breaker Metrics:**
   ```bash
   curl https://api.payrail.ph/v1/health
   ```
2. **Inspect Consecutive Failures & Probe Time:**
   - Review metrics from `CircuitBreakerService.getMetrics()`.
   - Confirm `consecutiveFailures >= 5` and `openUntil` timestamp.

## Operational Actions
1. **Allow Automated Probe (HALF_OPEN):**
   - The circuit breaker automatically probes downstream every 15 seconds. If the upstream provider recovers, the probe request succeeds and the circuit returns to `CLOSED` without human intervention.
2. **Manual Override (If Provider Was Under Maintenance):**
   - If downstream confirmed maintenance has completed and immediate testing is required:
   ```bash
   curl -X POST https://api.payrail.ph/v1/circuit-breaker/reset \
     -H "Authorization: Bearer $OPERATOR_TOKEN" \
     -d '{"provider": "paymongo"}'
   ```
