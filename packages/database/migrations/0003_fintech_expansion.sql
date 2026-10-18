-- PayRail PH: Full Fintech Expansion Migration
-- Schema: Double-Entry Ledger, Refunds Aggregate, Outbox, Durable Jobs, DLQ, Merchant API Keys, Outbound Webhooks, Reconciliation, and Immutable Audit Trail

-- 1. Double-Entry Ledger System
CREATE TABLE IF NOT EXISTS payrail_private.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL,
  account_number TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_account_merchant_number UNIQUE (merchant_id, account_number)
);

CREATE INDEX IF NOT EXISTS idx_accounts_merchant_type ON payrail_private.accounts (merchant_id, type);

CREATE TABLE IF NOT EXISTS payrail_private.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL,
  entry_number TEXT NOT NULL UNIQUE,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  description TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON payrail_private.journal_entries (merchant_id, reference_type, reference_id);

CREATE TABLE IF NOT EXISTS payrail_private.ledger_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES payrail_private.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES payrail_private.accounts(id),
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_lines_entry ON payrail_private.ledger_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_ledger_lines_account ON payrail_private.ledger_lines (account_id);

-- 2. Refunds Aggregate
CREATE TABLE IF NOT EXISTS payrail_private.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL REFERENCES payrail_private.payment_intents(id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  reason TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING', 'SUCCEEDED', 'FAILED', 'UNKNOWN')),
  idempotency_key TEXT NOT NULL,
  provider_refund_id TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_refund_merchant_idem UNIQUE (merchant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_intent ON payrail_private.refunds (payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_refunds_merchant_state ON payrail_private.refunds (merchant_id, state);

-- 3. Outbox Events, Durable Jobs & Dead-Letter Queue
CREATE TABLE IF NOT EXISTS payrail_private.outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_unpublished ON payrail_private.outbox_events (created_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS payrail_private.durable_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING', 'CLAIMED', 'PROCESSING', 'RETRY_SCHEDULED', 'COMPLETED', 'DEAD_LETTER')),
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  locked_until TIMESTAMPTZ,
  last_error TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_durable_jobs_claimable ON payrail_private.durable_jobs (state, next_attempt_at)
  WHERE state IN ('PENDING', 'RETRY_SCHEDULED');

CREATE TABLE IF NOT EXISTS payrail_private.dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES payrail_private.durable_jobs(id) ON DELETE CASCADE,
  merchant_id TEXT,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  failure_reason TEXT NOT NULL,
  replayed_at TIMESTAMPTZ,
  replayed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dlq_job ON payrail_private.dead_letter_queue (job_id);

-- 4. Merchant API Keys & Outbound Webhook Delivery
CREATE TABLE IF NOT EXISTS payrail_private.merchant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{"payments:read","payments:write"}',
  environment VARCHAR(16) NOT NULL DEFAULT 'test',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_merchant_api_keys_lookup ON payrail_private.merchant_api_keys (key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_merchant_api_keys_merchant ON payrail_private.merchant_api_keys (merchant_id);

CREATE TABLE IF NOT EXISTS payrail_private.merchant_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_key VARCHAR(64) NOT NULL,
  subscribed_events TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_webhooks_merchant ON payrail_private.merchant_webhook_endpoints (merchant_id);

CREATE TABLE IF NOT EXISTS payrail_private.merchant_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES payrail_private.merchant_webhook_endpoints(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'DELIVERED', 'RETRYING', 'FAILED', 'DEAD_LETTER')),
  status_code INT,
  response_body TEXT,
  attempt_count INT NOT NULL DEFAULT 1,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON payrail_private.merchant_webhook_deliveries (status, next_attempt_at);

-- 5. Automated Reconciliation & Audit Trail
CREATE TABLE IF NOT EXISTS payrail_private.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  total_records INT NOT NULL DEFAULT 0,
  matched_records INT NOT NULL DEFAULT 0,
  discrepancy_records INT NOT NULL DEFAULT 0,
  summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_merchant ON payrail_private.reconciliation_runs (merchant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS payrail_private.reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payrail_private.reconciliation_runs(id) ON DELETE CASCADE,
  payment_intent_id TEXT,
  provider_payment_id TEXT,
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN ('MATCHED', 'LOCAL_ONLY', 'PROVIDER_ONLY', 'STATUS_MISMATCH', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'DUPLICATE', 'UNKNOWN')),
  resolution TEXT CHECK (resolution IN ('UNRESOLVED', 'AUTO_REPAIRED', 'MANUAL_INVESTIGATION', 'DISMISSED')),
  local_state TEXT,
  provider_state TEXT,
  amount_minor BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_items_run ON payrail_private.reconciliation_items (run_id, discrepancy_type);

CREATE TABLE IF NOT EXISTS payrail_private.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_merchant ON payrail_private.audit_events (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON payrail_private.audit_events (resource_type, resource_id);

-- 6. Seed Default Chart of Accounts for Standard Merchant (merchant_default)
INSERT INTO payrail_private.accounts (merchant_id, account_number, name, type, currency)
VALUES
  ('merchant_default', '1000-CASH-SETTLEMENT', 'Settlement Cash Account', 'ASSET', 'PHP'),
  ('merchant_default', '1100-PSP-RECEIVABLE', 'PSP Gateway Receivable', 'ASSET', 'PHP'),
  ('merchant_default', '2000-MERCHANT-PAYABLE', 'Merchant Funds Payable', 'LIABILITY', 'PHP'),
  ('merchant_default', '2100-REFUND-RESERVE', 'Refund Reserve Liability', 'LIABILITY', 'PHP'),
  ('merchant_default', '4000-PROCESSING-FEE-REVENUE', 'Payment Processing Revenue', 'REVENUE', 'PHP'),
  ('merchant_default', '5000-PSP-PROCESSING-EXPENSE', 'Gateway & Interchange Expense', 'EXPENSE', 'PHP')
ON CONFLICT (merchant_id, account_number) DO NOTHING;
