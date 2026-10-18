import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import { PayMongoAdapter } from "../paymongo/paymongo.adapter";
import { LedgerService } from "../ledger/ledger.service";
import * as crypto from "node:crypto";

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
  UNKNOWN_REQUIRES_RECONCILIATION: [
    "SUBMITTED",
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
  ],
  SUCCEEDED: [],
  FAILED: ["SUBMISSION_PENDING", "SUCCEEDED"],
  EXPIRED: ["SUBMISSION_PENDING", "SUCCEEDED"],
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
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: DatabasePool,
    @Inject(PayMongoAdapter) private readonly payMongoAdapter: PayMongoAdapter,
    @Optional() @Inject(LedgerService) private readonly ledgerService?: LedgerService,
  ) {}

  private calculateFingerprint(body: Record<string, unknown>): string {
    const canonical = JSON.stringify(body, Object.keys(body).sort());
    return crypto.createHash("sha256").update(canonical).digest("hex");
  }

  async createQrPhPayment(
    dto: CreatePaymentDto,
    idempotencyKey: string,
  ): Promise<PaymentIntentView> {
    const merchantId = dto.merchantId || "merchant_default";
    const operation = "CREATE_QRPH_PAYMENT";
    const amountMinor = BigInt(dto.amountMinor);
    const currency = dto.currency || "PHP";
    const orderNumber = dto.orderNumber || `ORD-${Date.now()}`;
    const description = dto.description || `PayRail Order ${orderNumber}`;

    if (amountMinor <= 0n) {
      throw new ConflictException("Amount must be greater than zero.");
    }
    if (currency !== "PHP") {
      throw new ConflictException("Currency must be PHP.");
    }

    const fingerprint = this.calculateFingerprint({
      merchantId,
      amountMinor: dto.amountMinor,
      currency,
      orderNumber,
    });

    const client = await this.pool.connect();
    let paymentIntentId: string;
    let orderId: string;
    let attemptId: string;
    const providerOperationKey = `op_${crypto.randomUUID()}`;

    try {
      await client.query("BEGIN");

      // 1. Check idempotency record with row lock
      const existingIdempotency = await client.query<{
        request_fingerprint: string;
        result_reference: string | null;
        response_body: string | null;
        status: string;
      }>(
        `SELECT request_fingerprint, result_reference, response_body, status
         FROM payrail_private.idempotency_records
         WHERE merchant_id = $1 AND operation = $2 AND idempotency_key = $3
         FOR UPDATE`,
        [merchantId, operation, idempotencyKey],
      );

      const record = existingIdempotency.rows[0];
      if (record) {
        if (record.request_fingerprint !== fingerprint) {
          await client.query("ROLLBACK");
          throw new ConflictException(
            "IDEMPOTENCY_KEY_REUSED: Request parameters differ for this idempotency key.",
          );
        }

        if (record.status === "RESOLVED" && record.result_reference) {
          await client.query("ROLLBACK");
          return this.getPaymentIntent(record.result_reference, merchantId);
        }

        if (record.status === "PENDING") {
          await client.query("ROLLBACK");
          throw new ConflictException(
            "Operation with this idempotency key is currently processing.",
          );
        }
      }

      // 2. Insert PENDING idempotency record
      await client.query(
        `INSERT INTO payrail_private.idempotency_records
           (merchant_id, operation, idempotency_key, request_fingerprint, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         ON CONFLICT (merchant_id, operation, idempotency_key)
         DO UPDATE SET updated_at = clock_timestamp()`,
        [merchantId, operation, idempotencyKey, fingerprint],
      );

      // 3. Create Order
      orderId = `ord_${crypto.randomUUID()}`;
      await client.query(
        `INSERT INTO payrail_private.orders
           (id, merchant_id, order_number, amount_minor, currency, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [orderId, merchantId, orderNumber, amountMinor.toString(), currency],
      );

      // 4. Create PaymentIntent in CREATED state
      paymentIntentId = `pi_${crypto.randomUUID()}`;
      await client.query(
        `INSERT INTO payrail_private.payment_intents
           (id, merchant_id, order_id, amount_minor, currency, provider, payment_method, state)
         VALUES ($1, $2, $3, $4, $5, 'paymongo', 'qrph', 'CREATED')`,
        [paymentIntentId, merchantId, orderId, amountMinor.toString(), currency],
      );

      await client.query(
        `INSERT INTO payrail_private.payment_state_events
           (payment_intent_id, previous_state, next_state, source)
         VALUES ($1, NULL, 'CREATED', 'API')`,
        [paymentIntentId],
      );

      // 5. Transition to SUBMISSION_PENDING and create PaymentAttempt
      attemptId = `att_${crypto.randomUUID()}`;
      await client.query(
        `UPDATE payrail_private.payment_intents
         SET state = 'SUBMISSION_PENDING', updated_at = clock_timestamp()
         WHERE id = $1`,
        [paymentIntentId],
      );

      await client.query(
        `INSERT INTO payrail_private.payment_state_events
           (payment_intent_id, previous_state, next_state, source)
         VALUES ($1, 'CREATED', 'SUBMISSION_PENDING', 'API')`,
        [paymentIntentId],
      );

      await client.query(
        `INSERT INTO payrail_private.payment_attempts
           (id, payment_intent_id, provider, provider_operation_key, submission_state)
         VALUES ($1, $2, 'paymongo', $3, 'SUBMITTED')`,
        [attemptId, paymentIntentId, providerOperationKey],
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // 6. External Call to PayMongo adapter OUTSIDE the database transaction
    let providerResult: Awaited<ReturnType<typeof this.payMongoAdapter.createQrPhPayment>>;
    try {
      providerResult = await this.payMongoAdapter.createQrPhPayment(
        amountMinor,
        currency,
        description,
      );
    } catch (networkError) {
      this.logger.error(`PayMongo network failure for intent ${paymentIntentId}: ${networkError}`);
      await this.pool.query(
        `UPDATE payrail_private.payment_intents
         SET state = 'UNKNOWN_REQUIRES_RECONCILIATION', updated_at = clock_timestamp()
         WHERE id = $1`,
        [paymentIntentId],
      );
      await this.pool.query(
        `INSERT INTO payrail_private.payment_state_events
           (payment_intent_id, previous_state, next_state, source)
         VALUES ($1, 'SUBMISSION_PENDING', 'UNKNOWN_REQUIRES_RECONCILIATION', 'PROVIDER_ADAPTER')`,
        [paymentIntentId],
      );
      throw networkError;
    }

    // 7. Persist Provider Reference and transition to AWAITING_PAYMENT
    const postClient = await this.pool.connect();
    try {
      await postClient.query("BEGIN");

      await postClient.query(
        `UPDATE payrail_private.payment_attempts
         SET provider_payment_id = $1, submission_state = 'AWAITING_PAYMENT', updated_at = clock_timestamp()
         WHERE id = $2`,
        [providerResult.providerPaymentIntentId, attemptId],
      );

      await postClient.query(
        `UPDATE payrail_private.payment_intents
         SET state = 'AWAITING_PAYMENT', updated_at = clock_timestamp()
         WHERE id = $1`,
        [paymentIntentId],
      );

      await postClient.query(
        `INSERT INTO payrail_private.payment_state_events
           (payment_intent_id, previous_state, next_state, source)
         VALUES ($1, 'SUBMISSION_PENDING', 'AWAITING_PAYMENT', 'PROVIDER_ADAPTER')`,
        [paymentIntentId],
      );

      // Resolve idempotency record
      await postClient.query(
        `UPDATE payrail_private.idempotency_records
         SET status = 'RESOLVED', result_reference = $1, updated_at = clock_timestamp()
         WHERE merchant_id = $2 AND operation = $3 AND idempotency_key = $4`,
        [paymentIntentId, merchantId, operation, idempotencyKey],
      );

      await postClient.query("COMMIT");
    } catch (postError) {
      await postClient.query("ROLLBACK");
      throw postError;
    } finally {
      postClient.release();
    }

    return {
      id: paymentIntentId,
      merchantId,
      orderId,
      orderNumber,
      amountMinor: amountMinor.toString(),
      currency,
      state: "AWAITING_PAYMENT",
      provider: "paymongo",
      paymentMethod: "qrph",
      providerPaymentIntentId: providerResult.providerPaymentIntentId,
      qrCodeUrl: providerResult.qrCodeUrl ?? undefined,
      testUrl: providerResult.testUrl ?? undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getPaymentIntent(id: string, merchantId?: string): Promise<PaymentIntentView> {
    const params: unknown[] = [id];
    let query = `
      SELECT pi.id, pi.merchant_id, pi.order_id, pi.amount_minor, pi.currency,
             pi.state, pi.provider, pi.payment_method, pi.created_at, pi.updated_at,
             o.order_number, pa.provider_payment_id
      FROM payrail_private.payment_intents pi
      JOIN payrail_private.orders o ON o.id = pi.order_id
      LEFT JOIN payrail_private.payment_attempts pa ON pa.payment_intent_id = pi.id
      WHERE pi.id = $1
    `;

    if (merchantId) {
      query += " AND pi.merchant_id = $2";
      params.push(merchantId);
    }

    query += " ORDER BY pa.created_at DESC LIMIT 1";

    const result = await this.pool.query<{
      id: string;
      merchant_id: string;
      order_id: string;
      amount_minor: string;
      currency: string;
      state: PaymentState;
      provider: string;
      payment_method: string;
      order_number: string;
      provider_payment_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(query, params);

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Payment intent ${id} not found.`);
    }

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
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async listPaymentIntents(merchantId: string, limit = 50): Promise<PaymentIntentView[]> {
    const result = await this.pool.query<{
      id: string;
      merchant_id: string;
      order_id: string;
      amount_minor: string;
      currency: string;
      state: PaymentState;
      provider: string;
      payment_method: string;
      order_number: string;
      provider_payment_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT DISTINCT ON (pi.id) pi.id, pi.merchant_id, pi.order_id, pi.amount_minor, pi.currency,
              pi.state, pi.provider, pi.payment_method, pi.created_at, pi.updated_at,
              o.order_number, pa.provider_payment_id
       FROM payrail_private.payment_intents pi
       JOIN payrail_private.orders o ON o.id = pi.order_id
       LEFT JOIN payrail_private.payment_attempts pa ON pa.payment_intent_id = pi.id
       WHERE pi.merchant_id = $1
       ORDER BY pi.id, pi.created_at DESC
       LIMIT $2`,
      [merchantId, limit],
    );

    return result.rows.map((row) => ({
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
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  async applyGuardedTransition(
    paymentIntentId: string,
    targetState: PaymentState,
    source: "API" | "PROVIDER_ADAPTER" | "VERIFIED_WEBHOOK" | "RECONCILIATION",
    providerEventId?: string,
  ): Promise<{ transitioned: boolean; currentState: PaymentState }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const res = await client.query<{ state: PaymentState }>(
        `SELECT state FROM payrail_private.payment_intents WHERE id = $1 FOR UPDATE`,
        [paymentIntentId],
      );

      const target = res.rows[0];
      if (!target) {
        await client.query("ROLLBACK");
        throw new NotFoundException(`Payment intent ${paymentIntentId} not found.`);
      }

      const currentState = target.state;

      // Terminal state guard: SUCCEEDED cannot transition to anything
      if (currentState === "SUCCEEDED") {
        await client.query("ROLLBACK");
        return { transitioned: false, currentState: "SUCCEEDED" };
      }

      // Check allowed transition
      const allowed = paymentTransitions[currentState] || [];
      if (!allowed.includes(targetState)) {
        this.logger.warn(
          `Invalid transition attempted: ${currentState} -> ${targetState} for ${paymentIntentId}`,
        );
        await client.query("ROLLBACK");
        return { transitioned: false, currentState };
      }

      // Apply transition
      await client.query(
        `UPDATE payrail_private.payment_intents
         SET state = $1, updated_at = clock_timestamp()
         WHERE id = $2`,
        [targetState, paymentIntentId],
      );

      await client.query(
        `INSERT INTO payrail_private.payment_state_events
           (payment_intent_id, previous_state, next_state, source, provider_event_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [paymentIntentId, currentState, targetState, source, providerEventId || null],
      );

      if (targetState === "SUCCEEDED") {
        await client.query(
          `UPDATE payrail_private.orders
           SET status = 'PAID', updated_at = clock_timestamp()
           WHERE id = (SELECT order_id FROM payrail_private.payment_intents WHERE id = $1)`,
          [paymentIntentId],
        );

        if (this.ledgerService) {
          const piRes = await client.query<{
            merchant_id: string;
            amount_minor: string;
            currency: string;
          }>(
            `SELECT merchant_id, amount_minor, currency FROM payrail_private.payment_intents WHERE id = $1`,
            [paymentIntentId],
          );
          const pi = piRes.rows[0];
          if (pi) {
            await this.ledgerService.postPaymentSuccess(
              pi.merchant_id,
              paymentIntentId,
              pi.amount_minor,
              pi.currency,
              client,
            );
          }
        }
      }

      await client.query("COMMIT");
      return { transitioned: true, currentState: targetState };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
