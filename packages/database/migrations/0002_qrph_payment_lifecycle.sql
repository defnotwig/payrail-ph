CREATE TYPE payrail_private.payment_state_enum AS ENUM (
  'CREATED',
  'SUBMISSION_PENDING',
  'SUBMITTED',
  'AWAITING_PAYMENT',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED',
  'UNKNOWN_REQUIRES_RECONCILIATION'
);

CREATE TABLE payrail_private.orders (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'PHP' CHECK (currency = 'PHP'),
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_merchant_order_number UNIQUE (merchant_id, order_number)
);

CREATE TABLE payrail_private.payment_intents (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES payrail_private.orders(id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'PHP' CHECK (currency = 'PHP'),
  provider TEXT NOT NULL DEFAULT 'paymongo',
  payment_method TEXT NOT NULL DEFAULT 'qrph',
  state payrail_private.payment_state_enum NOT NULL DEFAULT 'CREATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE payrail_private.payment_attempts (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL REFERENCES payrail_private.payment_intents(id),
  provider TEXT NOT NULL DEFAULT 'paymongo',
  provider_operation_key TEXT NOT NULL,
  provider_payment_id TEXT,
  submission_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_provider_operation_key UNIQUE (provider, provider_operation_key)
);

CREATE UNIQUE INDEX uq_payment_attempts_active_unresolved
  ON payrail_private.payment_attempts (payment_intent_id)
  WHERE submission_state NOT IN ('SUCCEEDED', 'FAILED', 'EXPIRED');

CREATE INDEX idx_payment_attempts_provider_lookup
  ON payrail_private.payment_attempts (provider, provider_payment_id);

CREATE TABLE payrail_private.idempotency_records (
  merchant_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  result_reference TEXT,
  response_body JSONB,
  response_status_code INT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'RESOLVED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (merchant_id, operation, idempotency_key)
);

CREATE TABLE payrail_private.provider_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'test',
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  processing_state TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (processing_state IN ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED_STALE', 'DISCREPANCY')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT uq_provider_event UNIQUE (provider, environment, provider_event_id)
);

CREATE INDEX idx_provider_events_unprocessed
  ON payrail_private.provider_events (environment, received_at ASC)
  WHERE processed_at IS NULL;

CREATE TABLE payrail_private.payment_state_events (
  id BIGSERIAL PRIMARY KEY,
  payment_intent_id TEXT NOT NULL REFERENCES payrail_private.payment_intents(id),
  previous_state payrail_private.payment_state_enum,
  next_state payrail_private.payment_state_enum NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('API', 'PROVIDER_ADAPTER', 'VERIFIED_WEBHOOK', 'RECONCILIATION')),
  provider_event_id TEXT REFERENCES payrail_private.provider_events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_payment_state_events_timeline
  ON payrail_private.payment_state_events (payment_intent_id, created_at ASC);

CREATE OR REPLACE FUNCTION payrail_private.reject_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit records in payment_state_events are append-only.' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER payment_state_events_immutable
BEFORE UPDATE OR DELETE ON payrail_private.payment_state_events
FOR EACH ROW EXECUTE FUNCTION payrail_private.reject_audit_mutation();
