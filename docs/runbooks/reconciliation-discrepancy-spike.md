# Runbook: Daily Reconciliation Discrepancy Spike

## Severity: P2 (Medium/High)
## Trigger
Automated midnight reconciliation run flags > 10 discrepancy items in `payrail_private.reconciliation_items`.

## Symptoms
- Operations Portal (`/ops/reconciliation`) reports discrepancy rate > 1%.
- Alert `DailyReconciliationDiscrepancySpike` received.

## Diagnostic Steps
1. **Query Discrepancies by Type for Latest Run:**
   ```sql
   SELECT discrepancy_type, count(*), COALESCE(SUM(amount_minor::bigint), 0) AS total_variance
   FROM payrail_private.reconciliation_items
   WHERE run_id = (SELECT id FROM payrail_private.reconciliation_runs ORDER BY started_at DESC LIMIT 1)
   GROUP BY discrepancy_type;
   ```
2. **Examine Top Discrepancies:**
   - **STATUS_MISMATCH:** Downstream provider shows `PAID` but internal state is `AWAITING_PAYMENT`. Indicates dropped webhooks during a network partition.
   - **LOCAL_ONLY:** Internal intent created but provider has no attempt. Indicates user abandoned payment checkout.
   - **AMOUNT_MISMATCH:** Rare critical issue; requires immediate manual ledger investigation.

## Remediation Protocol
1. **Execute Automated Safe Repair:**
   For all clean `STATUS_MISMATCH` records:
   - Advance intent state to `SUCCEEDED`.
   - Post compensating ledger journal entry.
   - Mark item `resolution = 'AUTO_REPAIRED'`.
2. **Manual Investigation for Unknowns:**
   If amount mismatches exist, contact downstream provider technical support with provider reference numbers.
