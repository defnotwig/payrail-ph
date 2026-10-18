-- Existing deployed migrations are immutable. Refuse unsafe historical data rather than rewriting it.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM payrail_private.journal_entries e LEFT JOIN payrail_private.ledger_lines l ON l.journal_entry_id=e.id GROUP BY e.id HAVING count(l.id)<2)
    OR EXISTS (SELECT 1 FROM payrail_private.ledger_lines GROUP BY journal_entry_id,currency HAVING sum(CASE direction WHEN 'DEBIT' THEN amount_minor ELSE -amount_minor END)<>0)
    OR EXISTS (SELECT 1 FROM payrail_private.ledger_lines l JOIN payrail_private.accounts a ON a.id=l.account_id JOIN payrail_private.journal_entries e ON e.id=l.journal_entry_id WHERE a.merchant_id<>e.merchant_id OR a.currency<>l.currency)
  THEN RAISE EXCEPTION 'Existing journal integrity violations require investigation'; END IF;
END $$;

CREATE UNIQUE INDEX uq_journal_business_effect ON payrail_private.journal_entries(merchant_id,reference_type,reference_id);
ALTER TABLE payrail_private.journal_entries ADD COLUMN posting_state TEXT NOT NULL DEFAULT 'POSTED' CHECK(posting_state IN ('DRAFT','POSTED'));
ALTER TABLE payrail_private.journal_entries ALTER COLUMN posting_state SET DEFAULT 'DRAFT';

CREATE FUNCTION payrail_private.guard_journal_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.posting_state='POSTED' OR TG_OP='DELETE' OR NEW.posting_state<>'POSTED'
     OR (to_jsonb(NEW)-'posting_state')<>(to_jsonb(OLD)-'posting_state') THEN
    RAISE EXCEPTION 'Journal entries are immutable after posting' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_journal BEFORE UPDATE OR DELETE ON payrail_private.journal_entries FOR EACH ROW EXECUTE FUNCTION payrail_private.guard_journal_mutation();

CREATE FUNCTION payrail_private.guard_ledger_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_merchant TEXT; entry_state TEXT; account_merchant TEXT; account_currency TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Ledger lines are append-only' USING ERRCODE='23514'; END IF;
  SELECT merchant_id,posting_state INTO entry_merchant,entry_state FROM payrail_private.journal_entries WHERE id=NEW.journal_entry_id FOR UPDATE;
  SELECT merchant_id,currency INTO account_merchant,account_currency FROM payrail_private.accounts WHERE id=NEW.account_id FOR SHARE;
  IF entry_state<>'DRAFT' OR entry_merchant IS DISTINCT FROM account_merchant OR NEW.currency IS DISTINCT FROM account_currency THEN
    RAISE EXCEPTION 'Ledger entry/account merchant or currency mismatch, or already posted' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_ledger BEFORE INSERT OR UPDATE OR DELETE ON payrail_private.ledger_lines FOR EACH ROW EXECUTE FUNCTION payrail_private.guard_ledger_line();

CREATE FUNCTION payrail_private.validate_posted_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_id UUID; posting TEXT;
BEGIN
  IF TG_TABLE_NAME='journal_entries' THEN entry_id:=NEW.id; ELSE entry_id:=NEW.journal_entry_id; END IF;
  SELECT posting_state INTO posting FROM payrail_private.journal_entries WHERE id=entry_id;
  IF posting<>'POSTED' OR (SELECT count(*) FROM payrail_private.ledger_lines WHERE journal_entry_id=entry_id)<2
    OR EXISTS(SELECT 1 FROM payrail_private.ledger_lines WHERE journal_entry_id=entry_id GROUP BY currency HAVING sum(CASE direction WHEN 'DEBIT' THEN amount_minor ELSE -amount_minor END)<>0)
  THEN RAISE EXCEPTION 'Journal must be posted with at least two balanced lines per currency' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_balance AFTER INSERT OR UPDATE ON payrail_private.journal_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payrail_private.validate_posted_journal();
CREATE CONSTRAINT TRIGGER line_balance AFTER INSERT ON payrail_private.ledger_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payrail_private.validate_posted_journal();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON payrail_private.audit_events FOR EACH ROW EXECUTE FUNCTION payrail_private.reject_audit_mutation();

-- Ownership is part of each aggregate relationship, enforced even for direct SQL.
ALTER TABLE payrail_private.orders ADD CONSTRAINT uq_order_merchant UNIQUE(id,merchant_id);
ALTER TABLE payrail_private.payment_intents ADD CONSTRAINT fk_payment_order_merchant FOREIGN KEY(order_id,merchant_id) REFERENCES payrail_private.orders(id,merchant_id);
ALTER TABLE payrail_private.payment_intents ADD CONSTRAINT uq_payment_merchant UNIQUE(id,merchant_id);
ALTER TABLE payrail_private.refunds ADD CONSTRAINT fk_refund_payment_merchant FOREIGN KEY(payment_intent_id,merchant_id) REFERENCES payrail_private.payment_intents(id,merchant_id);

ALTER TABLE payrail_private.payment_intents ADD COLUMN active_refund_minor BIGINT NOT NULL DEFAULT 0 CHECK(active_refund_minor>=0 AND active_refund_minor<=amount_minor);
UPDATE payrail_private.payment_intents p SET active_refund_minor=(SELECT coalesce(sum(amount_minor),0) FROM payrail_private.refunds r WHERE r.payment_intent_id=p.id AND r.state IN ('PENDING','SUCCEEDED','UNKNOWN'));
CREATE FUNCTION payrail_private.guard_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE delta BIGINT; prior BIGINT:=0;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Refunds are append-only' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['state','provider_refund_id','failure_reason','updated_at'])<>(to_jsonb(OLD)-ARRAY['state','provider_refund_id','failure_reason','updated_at'])
      OR NOT ((OLD.state='PENDING' AND NEW.state IN ('SUCCEEDED','FAILED','UNKNOWN')) OR (OLD.state='UNKNOWN' AND NEW.state IN ('SUCCEEDED','FAILED')))
    THEN RAISE EXCEPTION 'Invalid refund transition or immutable fields changed' USING ERRCODE='23514'; END IF;
    IF OLD.state IN ('PENDING','SUCCEEDED','UNKNOWN') THEN prior:=OLD.amount_minor; END IF;
  ELSIF NEW.state<>'PENDING' THEN RAISE EXCEPTION 'Refund must start PENDING' USING ERRCODE='23514'; END IF;
  delta := CASE WHEN NEW.state IN ('PENDING','SUCCEEDED','UNKNOWN') THEN NEW.amount_minor ELSE 0 END-prior;
  UPDATE payrail_private.payment_intents SET active_refund_minor=active_refund_minor+delta
    WHERE id=NEW.payment_intent_id AND merchant_id=NEW.merchant_id AND state='SUCCEEDED' AND currency=NEW.currency
      AND active_refund_minor+delta BETWEEN 0 AND amount_minor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund capacity, payment state, ownership or currency invalid' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER refund_reservation BEFORE INSERT OR UPDATE OR DELETE ON payrail_private.refunds FOR EACH ROW EXECUTE FUNCTION payrail_private.guard_refund();
