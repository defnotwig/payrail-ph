# Runbook: Webhook Processing Backlog & Delay

## Severity: P2 (Medium/High)
## Trigger
CloudWatch alarm `WebhookProcessingDelay > 60s` or unprocessed records in `payrail_private.outbox_events` > 1,000.

## Symptoms
- Merchants report delayed receipt of `payment.succeeded` webhooks.
- Consumer browser polling waits longer than 15s for transition to `SUCCEEDED`.
- PostgreSQL queue depth in `payrail_private.outbox_events` is growing steadily.

## Diagnostic Steps
1. **Check Queue Depth & Age of Oldest Unprocessed Record:**
   ```sql
   SELECT count(*) AS total_backlog,
          min(created_at) AS oldest_pending,
          NOW() - min(created_at) AS max_latency
   FROM payrail_private.outbox_events
   WHERE published_at IS NULL;
   ```
2. **Check Worker Pool Status & Active Leases:**
   ```sql
   SELECT locked_by, count(*) 
   FROM payrail_private.durable_jobs 
   WHERE state = 'PROCESSING' 
   GROUP BY locked_by;
   ```
3. **Identify Blocking Errors or Deadlocks:**
   Check PostgreSQL `pg_stat_activity` for transactions blocked waiting on row locks:
   ```sql
   SELECT pid, wait_event_type, wait_event, query 
   FROM pg_stat_activity 
   WHERE state = 'active' AND wait_event_type = 'Lock';
   ```

## Immediate Mitigation
1. **Scale Out Worker Tasks:**
   Increase ECS Fargate worker task count from 2 to 6 tasks to absorb consumer delivery spikes:
   ```bash
   aws ecs update-service --cluster payrail-prod --service outbox-workers --desired-count 6
   ```
2. **Reclaim Stale Leases:**
   If a worker crashed without releasing its lease, reset expired leases (> 60s):
   ```sql
   UPDATE payrail_private.durable_jobs
   SET state = 'PENDING', locked_by = NULL, locked_until = NULL
   WHERE state = 'PROCESSING' AND locked_until < clock_timestamp();
   ```

## Prevention & Resolution
- Verify rate limiting settings on merchant webhook destinations to prevent outbound worker throttling.
