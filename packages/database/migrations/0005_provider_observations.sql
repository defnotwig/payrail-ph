ALTER TABLE payrail_private.payment_intents ADD COLUMN evidence_mode TEXT NOT NULL DEFAULT 'sandbox' CHECK(evidence_mode IN ('sandbox','fixture'));
ALTER TABLE payrail_private.payment_attempts ADD COLUMN provider_account TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE payrail_private.payment_attempts ADD COLUMN environment TEXT NOT NULL DEFAULT 'test' CHECK(environment='test');
ALTER TABLE payrail_private.payment_attempts ADD COLUMN provider_payment_method_id TEXT;
CREATE UNIQUE INDEX uq_provider_reference ON payrail_private.payment_attempts(provider,provider_account,environment,provider_payment_id) WHERE provider_payment_id IS NOT NULL;
ALTER TABLE payrail_private.refunds ADD COLUMN provider_operation_key TEXT NOT NULL DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX uq_refund_provider_operation ON payrail_private.refunds(provider_operation_key);
ALTER TABLE payrail_private.provider_events ADD COLUMN provider_account TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE payrail_private.provider_events ADD COLUMN payment_intent_id TEXT REFERENCES payrail_private.payment_intents(id);
ALTER TABLE payrail_private.provider_events ADD COLUMN normalized_observation JSONB;
ALTER TABLE payrail_private.provider_events DROP CONSTRAINT uq_provider_event;
ALTER TABLE payrail_private.provider_events ADD CONSTRAINT uq_provider_event UNIQUE(provider,provider_account,environment,provider_event_id);
CREATE FUNCTION payrail_private.guard_payment_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source TEXT;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'CREATED' THEN RAISE EXCEPTION 'Payment must start CREATED' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['state','updated_at','active_refund_minor'])<>(to_jsonb(OLD)-ARRAY['state','updated_at','active_refund_minor']) THEN
    RAISE EXCEPTION 'Payment identity and value are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.state=OLD.state THEN RETURN NEW; END IF;
  source:=current_setting('payrail.transition_source',true);
  IF source IS NULL OR source NOT IN ('API','PROVIDER_ADAPTER','VERIFIED_WEBHOOK','RECONCILIATION')
    OR OLD.state='SUCCEEDED'
    OR (OLD.state='CREATED' AND NOT(NEW.state='SUBMISSION_PENDING' AND source='API'))
    OR (OLD.state IN ('FAILED','EXPIRED') AND NOT(NEW.state='SUCCEEDED' AND source='RECONCILIATION'))
    OR (OLD.state IN ('SUBMISSION_PENDING','SUBMITTED','AWAITING_PAYMENT','PROCESSING','UNKNOWN_REQUIRES_RECONCILIATION') AND NEW.state NOT IN ('SUBMITTED','AWAITING_PAYMENT','PROCESSING','SUCCEEDED','FAILED','EXPIRED','UNKNOWN_REQUIRES_RECONCILIATION'))
    OR (NEW.state='SUCCEEDED' AND source NOT IN ('VERIFIED_WEBHOOK','RECONCILIATION'))
  THEN RAISE EXCEPTION 'Invalid payment transition/source' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_transition_guard BEFORE INSERT OR UPDATE ON payrail_private.payment_intents FOR EACH ROW EXECUTE FUNCTION payrail_private.guard_payment_transition();
ALTER TABLE payrail_private.durable_jobs ADD COLUMN deduplication_key TEXT;
CREATE UNIQUE INDEX uq_job_deduplication ON payrail_private.durable_jobs(deduplication_key) WHERE deduplication_key IS NOT NULL;
ALTER TABLE payrail_private.outbox_events ADD COLUMN business_effect_key TEXT;
CREATE UNIQUE INDEX uq_outbox_effect ON payrail_private.outbox_events(business_effect_key) WHERE business_effect_key IS NOT NULL;
