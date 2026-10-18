# Runbook: Dead Letter Queue (DLQ) Overflow & Poison Pill Resolution

## Severity: P2 (Medium)
## Trigger
CloudWatch alert `DeadLetterQueueDepth > 10` or quarantined records in `payrail_private.dead_letter_queue`.

## Symptoms
- Durable asynchronous workers have exhausted maximum retries (e.g. 5 attempts) on specific jobs.
- Quarantined records accumulate in `payrail_private.dead_letter_queue`.
- Worker throughput is normal, but specific downstream notifications or ledger syncs have halted.

## Diagnostic Steps
1. **Query Active Quarantined Items in DLQ:**
   ```sql
   SELECT id, job_id, merchant_id, job_type, failure_reason, created_at
   FROM payrail_private.dead_letter_queue
   WHERE replayed_at IS NULL
   ORDER BY created_at DESC;
   ```
2. **Inspect Error Patterns:**
   - Group by `failure_reason` to determine if a single partner merchant server is down (HTTP 500/503), or if malformed payloads are being sent (HTTP 422).
   ```sql
   SELECT failure_reason, count(*) 
   FROM payrail_private.dead_letter_queue 
   WHERE replayed_at IS NULL 
   GROUP BY failure_reason;
   ```

## Remediation Protocol
1. **Address Upstream / Downstream Cause:**
   - If a merchant endpoint was misconfigured or down, contact the merchant or wait until their service restores.
   - If a bug in payload serialization caused the failure, deploy hotfix to ECS tasks.
2. **Replay Quarantined DLQ Jobs via API or Operations Portal:**
   - Use the Operations Portal (`/ops/jobs`) or execute authenticated API replay:
   ```bash
   curl -X POST https://api.payrail.ph/v1/jobs/dlq/<DLQ_ID>/replay \
     -H "Authorization: Bearer $OPERATOR_TOKEN"
   ```
3. **Verify Replay Completion:**
   Confirm the new job is picked up by durable workers and `replayed_at` is stamped in the DLQ table.
