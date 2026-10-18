# Runbook: Ledger Imbalance Invariant Violation

## Severity: P0 (CRITICAL - SYSTEM HALT)
## Trigger
Integrity checker alarm `LedgerConservationDelta != 0` or journal entry transaction rolled back due to `SUM(debits) != SUM(credits)`.

## Impact
Immediate financial risk of unallocated funds, duplicate credit, or accounting corruption.

## Immediate Automated Safeguard
1. **Automated Payout Halt:** System automatically suspends all merchant settlement batches and automated bank transfers.
2. **Alert Escalation:** PagerDuty P0 alert dispatched to VP of Engineering and Head of Finance.

## Diagnostic Steps
1. **Identify Unbalanced Journal Entries:**
   ```sql
   SELECT j.id, j.entry_number, j.reference_id,
          SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount_minor ELSE 0 END) AS total_debit,
          SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount_minor ELSE 0 END) AS total_credit
   FROM payrail_private.journal_entries j
   JOIN payrail_private.ledger_lines l ON j.id = l.journal_entry_id
   GROUP BY j.id, j.entry_number, j.reference_id
   HAVING SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount_minor ELSE 0 END) != 
          SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount_minor ELSE 0 END);
   ```
2. **Inspect Global Balance Invariant Across Chart of Accounts:**
   ```sql
   SELECT 
       SUM(CASE WHEN a.type IN ('ASSET', 'EXPENSE') THEN 
               (SELECT COALESCE(SUM(l.amount_minor), 0) FROM payrail_private.ledger_lines l WHERE l.account_id = a.id AND l.direction = 'DEBIT') -
               (SELECT COALESCE(SUM(l.amount_minor), 0) FROM payrail_private.ledger_lines l WHERE l.account_id = a.id AND l.direction = 'CREDIT')
           ELSE 0 END) AS total_debit_balance,
       SUM(CASE WHEN a.type IN ('LIABILITY', 'EQUITY', 'REVENUE') THEN 
               (SELECT COALESCE(SUM(l.amount_minor), 0) FROM payrail_private.ledger_lines l WHERE l.account_id = a.id AND l.direction = 'CREDIT') -
               (SELECT COALESCE(SUM(l.amount_minor), 0) FROM payrail_private.ledger_lines l WHERE l.account_id = a.id AND l.direction = 'DEBIT')
           ELSE 0 END) AS total_credit_balance
   FROM payrail_private.accounts a;
   ```

## Remediation Protocol
1. Never edit existing ledger lines or delete records (preserves immutability).
2. If an erroneous journal entry was posted, generate an explicit **Compensating Journal Entry** with reference type `ADJUSTMENT`.
3. Require dual-authorization (2-person rule: 1 Staff Engineer + 1 Finance Lead) before posting an adjustment entry.
4. Re-run global balance invariant verification to confirm Delta returns to exactly 0.00 PHP.
5. Resume merchant settlement payouts.
