ALTER TABLE payrail_private.durable_jobs ADD COLUMN claim_token UUID;
CREATE INDEX idx_durable_jobs_expired_claims ON payrail_private.durable_jobs(locked_until) WHERE state='CLAIMED';
