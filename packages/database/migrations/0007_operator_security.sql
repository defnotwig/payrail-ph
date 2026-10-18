-- Operator identity is anchored to Supabase Auth UUIDs; authorization remains in PostgreSQL.
CREATE TABLE IF NOT EXISTS payrail_private.operators (
  id UUID PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS payrail_private.operator_memberships (
  operator_id UUID NOT NULL REFERENCES payrail_private.operators(id) ON DELETE CASCADE,
  merchant_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('local', 'test', 'staging', 'production')),
  role TEXT NOT NULL CHECK (role IN ('VIEWER', 'SUPPORT', 'FINANCE', 'ENGINEER', 'ADMIN')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (operator_id, merchant_id, environment)
);

CREATE INDEX IF NOT EXISTS idx_operator_memberships_active
  ON payrail_private.operator_memberships (operator_id, environment, merchant_id)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS payrail_private.role_permissions (
  role TEXT NOT NULL CHECK (role IN ('VIEWER', 'SUPPORT', 'FINANCE', 'ENGINEER', 'ADMIN')),
  permission TEXT NOT NULL,
  PRIMARY KEY (role, permission)
);

INSERT INTO payrail_private.role_permissions (role, permission) VALUES
  ('VIEWER', 'payments:read'), ('VIEWER', 'refunds:read'), ('VIEWER', 'ledger:read'),
  ('VIEWER', 'reconciliation:read'), ('VIEWER', 'jobs:read'), ('VIEWER', 'audit:read'),
  ('VIEWER', 'webhooks:read'), ('VIEWER', 'keys:read'),
  ('SUPPORT', 'payments:read'), ('SUPPORT', 'refunds:read'), ('SUPPORT', 'jobs:read'),
  ('SUPPORT', 'webhooks:read'), ('SUPPORT', 'keys:read'), ('SUPPORT', 'audit:read'),
  ('FINANCE', 'payments:read'), ('FINANCE', 'refunds:read'), ('FINANCE', 'refunds:write'),
  ('FINANCE', 'ledger:read'), ('FINANCE', 'ledger:write'), ('FINANCE', 'reconciliation:read'),
  ('FINANCE', 'reconciliation:write'), ('FINANCE', 'jobs:read'), ('FINANCE', 'audit:read'),
  ('ENGINEER', 'payments:read'), ('ENGINEER', 'refunds:read'), ('ENGINEER', 'ledger:read'),
  ('ENGINEER', 'reconciliation:read'), ('ENGINEER', 'jobs:read'), ('ENGINEER', 'jobs:replay'),
  ('ENGINEER', 'audit:read'), ('ENGINEER', 'webhooks:read'), ('ENGINEER', 'webhooks:write'),
  ('ENGINEER', 'keys:read'), ('ENGINEER', 'keys:write'), ('ENGINEER', 'cards:write'),
  ('ADMIN', 'payments:read'), ('ADMIN', 'payments:write'), ('ADMIN', 'refunds:read'),
  ('ADMIN', 'refunds:write'), ('ADMIN', 'ledger:read'), ('ADMIN', 'ledger:write'),
  ('ADMIN', 'reconciliation:read'), ('ADMIN', 'reconciliation:write'), ('ADMIN', 'jobs:read'),
  ('ADMIN', 'jobs:replay'), ('ADMIN', 'audit:read'), ('ADMIN', 'webhooks:read'),
  ('ADMIN', 'webhooks:write'), ('ADMIN', 'keys:read'), ('ADMIN', 'keys:write'), ('ADMIN', 'cards:write')
ON CONFLICT DO NOTHING;

-- Existing webhook signing secrets were plaintext. Remove them; owners must re-register endpoints.
ALTER TABLE payrail_private.merchant_webhook_endpoints
  DROP COLUMN IF EXISTS secret_key,
  ADD COLUMN IF NOT EXISTS encrypted_secret TEXT,
  ADD COLUMN IF NOT EXISTS secret_version TEXT;

ALTER TABLE payrail_private.merchant_api_keys
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
