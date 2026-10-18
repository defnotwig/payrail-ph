import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import { LedgerService } from "../ledger/ledger.service";
import { PayMongoAdapter } from "../paymongo/paymongo.adapter";
import { inTransaction, transitionSource } from "../financial/transaction";
export type PaymentState =
  | "CREATED"
  | "SUBMISSION_PENDING"
  | "SUBMITTED"
  | "AWAITING_PAYMENT"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "UNKNOWN_REQUIRES_RECONCILIATION";
export const paymentTransitions: Record<PaymentState, PaymentState[]> = {
  CREATED: ["SUBMISSION_PENDING"],
  SUBMISSION_PENDING: [
    "SUBMITTED",
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION",
  ],
  SUBMITTED: [
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION",
  ],
  AWAITING_PAYMENT: [
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION",
  ],
  PROCESSING: ["SUCCEEDED", "FAILED", "EXPIRED", "UNKNOWN_REQUIRES_RECONCILIATION"],
  SUCCEEDED: [],
  FAILED: ["SUBMISSION_PENDING", "SUCCEEDED"],
  EXPIRED: ["SUBMISSION_PENDING", "SUCCEEDED"],
  UNKNOWN_REQUIRES_RECONCILIATION: [
    "SUBMITTED",
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
  ],
};
export interface CreatePaymentDto {
  amountMinor: string;
  currency?: string | undefined;
  orderNumber?: string | undefined;
  description?: string | undefined;
  merchantId?: string | undefined;
}
export interface PaymentIntentView {
  id: string;
  merchantId: string;
  orderId: string;
  orderNumber: string;
  amountMinor: string;
  currency: string;
  state: PaymentState;
  provider: string;
  paymentMethod: string;
  providerPaymentIntentId?: string | undefined;
  qrCodeUrl?: string | undefined;
  testUrl?: string | undefined;
  createdAt: string;
  updatedAt: string;
  evidenceMode: "fixture" | "sandbox";
}
export interface PaymentObservation {
  paymentIntentId: string;
  merchantId: string;
  provider: string;
  providerAccount: string;
  environment: "test";
  providerPaymentIntentId: string;
  amountMinor: string;
  currency: string;
  state: PaymentState;
  source: "VERIFIED_WEBHOOK" | "RECONCILIATION";
  eventId?: string;
}
export function minorAmount(value: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value))
    throw new BadRequestException("amountMinor must be a positive decimal integer string");
  const amount = BigInt(value);
  if (amount <= 0n || amount > 9007199254740991n)
    throw new BadRequestException("amountMinor is outside the supported exact provider range");
  return amount;
}
@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: DatabasePool,
    @Inject(PayMongoAdapter) private readonly adapter: PayMongoAdapter,
    @Inject(LedgerService) private readonly ledger: LedgerService,
  ) {}
  async createQrPhPayment(dto: CreatePaymentDto, key: string): Promise<PaymentIntentView> {
    if (!dto.merchantId || !key?.trim())
      throw new BadRequestException("Merchant and Idempotency-Key are required");
    const merchant = dto.merchantId;
    const amount = minorAmount(dto.amountMinor);
    const currency = dto.currency || "PHP";
    if (currency !== "PHP") throw new BadRequestException("Currency must be PHP");
    this.adapter.assertAvailable();
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          merchant,
          amount.toString(),
          currency,
          dto.orderNumber ?? null,
          dto.description ?? null,
          this.adapter.mode,
        ]),
      )
      .digest("hex");
    const operation = await inTransaction(this.pool, async (client) => {
      const claim = await client.query(
        "INSERT INTO payrail_private.idempotency_records(merchant_id,operation,idempotency_key,request_fingerprint,status) VALUES($1,'CREATE_QRPH_PAYMENT',$2,$3,'PENDING') ON CONFLICT DO NOTHING RETURNING merchant_id",
        [merchant, key, fingerprint],
      );
      const result = await client.query(
        "SELECT * FROM payrail_private.idempotency_records WHERE merchant_id=$1 AND operation='CREATE_QRPH_PAYMENT' AND idempotency_key=$2 FOR UPDATE",
        [merchant, key],
      );
      const record = result.rows[0];
      if (record.request_fingerprint !== fingerprint)
        throw new ConflictException("IDEMPOTENCY_KEY_REUSED");
      if (!claim.rowCount) {
        if (!record.result_reference) throw new ConflictException("Operation is processing");
        return {
          id: record.result_reference as string,
          replay: true,
          attemptId: "",
          operationKey: "",
        };
      }
      const id = `pi_${randomUUID()}`;
      const orderId = `ord_${randomUUID()}`;
      const attemptId = `att_${randomUUID()}`;
      const operationKey = `op_${randomUUID()}`;
      await client.query(
        "INSERT INTO payrail_private.orders(id,merchant_id,order_number,amount_minor,currency) VALUES($1,$2,$3,$4,$5)",
        [orderId, merchant, dto.orderNumber || `ORD-${randomUUID()}`, amount.toString(), currency],
      );
      await client.query(
        "INSERT INTO payrail_private.payment_intents(id,merchant_id,order_id,amount_minor,currency,evidence_mode) VALUES($1,$2,$3,$4,$5,$6)",
        [id, merchant, orderId, amount.toString(), currency, this.adapter.mode],
      );
      await client.query(
        "INSERT INTO payrail_private.payment_state_events(payment_intent_id,next_state,source) VALUES($1,'CREATED','API')",
        [id],
      );
      await transitionSource(client, "API");
      await client.query(
        "UPDATE payrail_private.payment_intents SET state='SUBMISSION_PENDING' WHERE id=$1",
        [id],
      );
      await client.query(
        "INSERT INTO payrail_private.payment_state_events(payment_intent_id,previous_state,next_state,source) VALUES($1,'CREATED','SUBMISSION_PENDING','API')",
        [id],
      );
      await client.query(
        "INSERT INTO payrail_private.payment_attempts(id,payment_intent_id,provider,provider_operation_key,submission_state,provider_account) VALUES($1,$2,'paymongo',$3,'SUBMITTED',$4)",
        [attemptId, id, operationKey, this.adapter.account],
      );
      await client.query(
        "UPDATE payrail_private.idempotency_records SET result_reference=$3 WHERE merchant_id=$1 AND operation='CREATE_QRPH_PAYMENT' AND idempotency_key=$2",
        [merchant, key, id],
      );
      return { id, replay: false, attemptId, operationKey };
    });
    if (operation.replay) return this.getPaymentIntent(operation.id, merchant);
    try {
      const result = await this.adapter.createQrPhPayment(amount, currency, dto.description, {
        key: operation.operationKey,
        onProgress: async (progress) => {
          await this.pool.query(
            "UPDATE payrail_private.payment_attempts SET provider_payment_id=coalesce($1,provider_payment_id),provider_payment_method_id=coalesce($2,provider_payment_method_id),updated_at=clock_timestamp() WHERE id=$3",
            [
              progress.providerPaymentIntentId ?? null,
              progress.providerPaymentMethodId ?? null,
              operation.attemptId,
            ],
          );
        },
      });
      await inTransaction(this.pool, async (client) => {
        const locked = await client.query(
          "SELECT state FROM payrail_private.payment_intents WHERE id=$1 FOR UPDATE",
          [operation.id],
        );
        const current = locked.rows[0].state as PaymentState;
        await client.query(
          "UPDATE payrail_private.payment_attempts SET provider_payment_id=$1,provider_payment_method_id=$2,submission_state=CASE WHEN submission_state IN ('SUCCEEDED','FAILED','EXPIRED') THEN submission_state ELSE 'AWAITING_PAYMENT' END,updated_at=clock_timestamp() WHERE id=$3",
          [result.providerPaymentIntentId, result.providerPaymentMethodId, operation.attemptId],
        );
        if (current === "SUBMISSION_PENDING")
          await this.transition(
            client,
            operation.id,
            current,
            "AWAITING_PAYMENT",
            "PROVIDER_ADAPTER",
          );
        await client.query(
          "UPDATE payrail_private.idempotency_records SET status='RESOLVED',response_body=$3,updated_at=clock_timestamp() WHERE merchant_id=$1 AND operation='CREATE_QRPH_PAYMENT' AND idempotency_key=$2",
          [merchant, key, JSON.stringify({ qrCodeUrl: result.qrCodeUrl, testUrl: result.testUrl })],
        );
      });
    } catch (error) {
      await inTransaction(this.pool, async (client) => {
        const locked = await client.query(
          "SELECT state FROM payrail_private.payment_intents WHERE id=$1 FOR UPDATE",
          [operation.id],
        );
        const state = locked.rows[0].state as PaymentState;
        if (!["SUCCEEDED", "FAILED", "EXPIRED"].includes(state)) {
          await this.transition(
            client,
            operation.id,
            state,
            "UNKNOWN_REQUIRES_RECONCILIATION",
            "PROVIDER_ADAPTER",
          );
          await client.query(
            "UPDATE payrail_private.payment_attempts SET submission_state='UNKNOWN_REQUIRES_RECONCILIATION' WHERE id=$1",
            [operation.attemptId],
          );
          await client.query(
            "INSERT INTO payrail_private.durable_jobs(job_type,payload,state,deduplication_key) VALUES('RESOLVE_PAYMENT',$1,'PENDING',$2) ON CONFLICT DO NOTHING",
            [
              JSON.stringify({ paymentIntentId: operation.id, merchantId: merchant }),
              `resolve:${operation.id}`,
            ],
          );
        }
      });
      throw error;
    }
    return this.getPaymentIntent(operation.id, merchant);
  }
  async getPaymentIntent(id: string, merchantId?: string): Promise<PaymentIntentView> {
    if (!merchantId) throw new BadRequestException("Merchant scope is required");
    const result = await this.pool.query(
      "SELECT p.*,o.order_number,a.provider_payment_id,i.response_body FROM payrail_private.payment_intents p JOIN payrail_private.orders o ON o.id=p.order_id LEFT JOIN LATERAL(SELECT provider_payment_id FROM payrail_private.payment_attempts WHERE payment_intent_id=p.id ORDER BY created_at DESC LIMIT 1)a ON true LEFT JOIN payrail_private.idempotency_records i ON i.result_reference=p.id AND i.operation='CREATE_QRPH_PAYMENT' AND i.merchant_id=p.merchant_id WHERE p.id=$1 AND p.merchant_id=$2",
      [id, merchantId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException("Payment not found");
    return {
      id: row.id,
      merchantId: row.merchant_id,
      orderId: row.order_id,
      orderNumber: row.order_number,
      amountMinor: row.amount_minor,
      currency: row.currency,
      state: row.state,
      provider: row.provider,
      paymentMethod: row.payment_method,
      providerPaymentIntentId: row.provider_payment_id ?? undefined,
      qrCodeUrl: row.response_body?.qrCodeUrl,
      testUrl: row.response_body?.testUrl,
      evidenceMode: row.evidence_mode,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
  async listPaymentIntents(merchantId: string, limit = 50) {
    const result = await this.pool.query(
      "SELECT id FROM payrail_private.payment_intents WHERE merchant_id=$1 ORDER BY created_at DESC LIMIT $2",
      [merchantId, Math.min(limit, 100)],
    );
    return Promise.all(result.rows.map((row) => this.getPaymentIntent(row.id, merchantId)));
  }
  private async transition(
    client: PoolClient,
    id: string,
    current: PaymentState,
    target: PaymentState,
    source: string,
    eventId?: string,
  ) {
    await transitionSource(client, source);
    await client.query(
      "UPDATE payrail_private.payment_intents SET state=$2,updated_at=clock_timestamp() WHERE id=$1",
      [id, target],
    );
    await client.query(
      "INSERT INTO payrail_private.payment_state_events(payment_intent_id,previous_state,next_state,source,provider_event_id) VALUES($1,$2,$3,$4,$5)",
      [id, current, target, source, eventId ?? null],
    );
  }
  async applyObservationInTransaction(client: PoolClient, observation: PaymentObservation) {
    const result = await client.query(
      "SELECT p.*,a.id AS attempt_id FROM payrail_private.payment_intents p JOIN payrail_private.payment_attempts a ON a.payment_intent_id=p.id WHERE p.id=$1 AND p.merchant_id=$2 AND a.provider=$3 AND a.provider_account=$4 AND a.environment=$5 AND a.provider_payment_id=$6 FOR UPDATE OF p",
      [
        observation.paymentIntentId,
        observation.merchantId,
        observation.provider,
        observation.providerAccount,
        observation.environment,
        observation.providerPaymentIntentId,
      ],
    );
    const payment = result.rows[0];
    if (!payment)
      throw new ConflictException("Observation identity does not match payment attempt");
    if (
      BigInt(payment.amount_minor) !== BigInt(observation.amountMinor) ||
      payment.currency !== observation.currency
    )
      throw new ConflictException("Observation amount/currency mismatch");
    const current = payment.state as PaymentState;
    const target = observation.state;
    if (current === target || current === "SUCCEEDED")
      return { transitioned: false, currentState: current };
    if (
      !paymentTransitions[current].includes(target) ||
      (["FAILED", "EXPIRED"].includes(current) && observation.source !== "RECONCILIATION")
    )
      return { transitioned: false, currentState: current };
    await this.transition(
      client,
      payment.id,
      current,
      target,
      observation.source,
      observation.eventId,
    );
    await client.query(
      "UPDATE payrail_private.payment_attempts SET submission_state=$2,updated_at=clock_timestamp() WHERE id=$1",
      [payment.attempt_id, target],
    );
    if (target === "SUCCEEDED") {
      await this.ledger.postPaymentSuccess(
        payment.merchant_id,
        payment.id,
        payment.amount_minor,
        payment.currency,
        client,
      );
      await client.query(
        "UPDATE payrail_private.orders SET status='PAID',updated_at=clock_timestamp() WHERE id=$1 AND merchant_id=$2",
        [payment.order_id, payment.merchant_id],
      );
      await client.query(
        "INSERT INTO payrail_private.outbox_events(event_type,aggregate_type,aggregate_id,payload,business_effect_key) VALUES('payment.succeeded','payment',$1,$2,$3) ON CONFLICT DO NOTHING",
        [
          payment.id,
          JSON.stringify({
            paymentIntentId: payment.id,
            merchantId: payment.merchant_id,
            amountMinor: payment.amount_minor,
            currency: payment.currency,
            evidenceMode: payment.evidence_mode,
          }),
          `payment.succeeded:${payment.id}`,
        ],
      );
    }
    return { transitioned: true, currentState: target };
  }
  async applyGuardedTransition(
    id: string,
    target: PaymentState,
    source: "API" | "PROVIDER_ADAPTER" | "VERIFIED_WEBHOOK" | "RECONCILIATION",
    _providerEventId?: string,
  ) {
    if (target === "SUCCEEDED")
      throw new BadRequestException("Success requires complete authoritative observation");
    return inTransaction(this.pool, async (client) => {
      const res = await client.query(
        "SELECT state FROM payrail_private.payment_intents WHERE id=$1 FOR UPDATE",
        [id],
      );
      const current = res.rows[0]?.state as PaymentState;
      if (!current) throw new NotFoundException("Payment not found");
      if (!paymentTransitions[current].includes(target) || ["FAILED", "EXPIRED"].includes(current))
        return { transitioned: false, currentState: current };
      await this.transition(client, id, current, target, source);
      await client.query(
        "UPDATE payrail_private.payment_attempts SET submission_state=$2 WHERE payment_intent_id=$1",
        [id, target],
      );
      return { transitioned: true, currentState: target };
    });
  }
}
