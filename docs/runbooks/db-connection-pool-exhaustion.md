# Runbook: Database Connection Pool Exhaustion

## Severity: P1 (High)
## Trigger
CloudWatch alarm `RDSActiveConnections > 85%` or error `TimeoutError: ResourceRequest timed out` from `pg-pool`.

## Symptoms
- API responses returning 500 or timing out after 10,000ms.
- Health check endpoint `/health/readiness` failing.

## Diagnostic Steps
1. **Inspect Active Database Connections by Application Client:**
   ```sql
   SELECT client_addr, application_name, state, count(*)
   FROM pg_stat_activity
   GROUP BY client_addr, application_name, state;
   ```
2. **Find Long-Running Uncommitted Transactions or Idle in Transaction:**
   ```sql
   SELECT pid, now() - xact_start AS duration, state, query
   FROM pg_stat_activity
   WHERE state = 'idle in transaction' AND (now() - xact_start) > INTERVAL '10 seconds';
   ```

## Immediate Mitigation
1. **Terminate Idle In Transaction Connections:**
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle in transaction' AND (now() - xact_start) > INTERVAL '30 seconds';
   ```
2. **Enable RDS Proxy Connection Multiplexing:**
   Direct all ECS task DB connection strings through AWS RDS Proxy to cap connection limits and pool effectively across serverless tasks.
3. **Verify Pool Client Release in Code:**
   Ensure all `client = await pool.connect()` blocks strictly use `finally { client.release(); }`.
