# Runbook: Suspected Double Charge / Duplicate Payment Investigation

## Severity: P1 (High)
## Trigger
Customer support ticket or merchant alert stating a consumer was debited twice for an identical order.

## Symptoms
- Customer bank SMS / mobile banking shows two debits for the same transaction.
- Merchant system received multiple notifications for a single order number.

## Diagnostic Steps (Forensic Query Sequence)
1. **Locate All Payment Intents Associated with the Order:**
   ```sql
   SELECT id, merchant_id, order_id, amount_minor, state, idempotency_key, created_at
   FROM payrail_private.payment_intents
   WHERE order_id = 'ORD_TARGET_123';
   ```
2. **Inspect Associated Provider Attempts & Operation Keys:**
   ```sql
   SELECT id, payment_intent_id, provider, provider_operation_key, provider_payment_id, submission_state, created_at
   FROM payrail_private.payment_attempts
   WHERE payment_intent_id IN (
       SELECT id FROM payrail_private.payment_intents WHERE order_id = 'ORD_TARGET_123'
   );
   ```
3. **Verify Ledger Postings for Double-Credit:**
   ```sql
   SELECT j.id, j.reference_id, l.account_id, l.direction, l.amount_minor, j.posted_at
   FROM payrail_private.journal_entries j
   JOIN payrail_private.ledger_lines l ON j.id = l.journal_entry_id
   WHERE j.reference_id IN (
       SELECT id FROM payrail_private.payment_intents WHERE order_id = 'ORD_TARGET_123'
   );
   ```

## Findings Analysis
- **Scenario A (Single Succeeded Intent, Zero Duplicate):** If only one `payment_intent` is `SUCCEEDED` and only one ledger journal entry exists, PayRail PH executed correctly. The secondary debit is likely a transient bank pre-authorization hold that will auto-release within 24-48 hours.
- **Scenario B (Two Distinct Intents Created with Different Idempotency Keys):** The merchant sent two different requests with distinct idempotency keys. Trigger an automated partial/full refund via `RefundsService.createRefund` for the duplicate intent.

## Remediation
If an actual duplicate occurred:
1. Issue refund with reason `DUPLICATE_CHARGE_REMEDIATION`.
2. Confirm compensating ledger journal entry is posted.
3. Provide forensic transaction report to the merchant.
