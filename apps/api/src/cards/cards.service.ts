import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import { CircuitBreakerService } from "../providers/circuit-breaker.service";
import { LedgerService } from "../ledger/ledger.service";
import * as crypto from "node:crypto";

export interface InitiateCardPaymentDto {
  merchantId: string;
  orderNumber: string;
  amountMinor: string;
  currency?: string;
  cardholderName: string;
  cardNumber: string; // Sanitized immediately
  expMonth: number;
  expYear: number;
  cvc: string; // Sanitized immediately
  idempotencyKey: string;
}

export interface CardPaymentResult {
  paymentIntentId: string;
  orderNumber: string;
  amountMinor: string;
  currency: string;
  state: "CREATED" | "AWAITING_PAYMENT" | "SUCCEEDED" | "FAILED";
  maskedCard: string;
  threeDSecureRequired: boolean;
  threeDSecureUrl?: string | undefined;
  createdAt: string;
}

@Injectable()
export class CardsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: DatabasePool,
    @Inject(CircuitBreakerService) private readonly circuitBreaker: CircuitBreakerService,
    @Inject(LedgerService) private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Masks PAN according to PCI DSS requirements (first 6 and last 4 only, or asterisks).
   */
  private maskPan(pan: string): string {
    const clean = pan.replace(/\s+/g, "");
    if (clean.length < 10) return "************";
    return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
  }

  /**
   * Initiates a card payment with PCI-conscious architecture.
   * Raw CVV and full PAN are never persisted to database tables or logs.
   * Simulates 3-D Secure authentication challenge for cards requiring liability shift.
   */
  async initiateCardPayment(dto: InitiateCardPaymentDto): Promise<CardPaymentResult> {
    const amount = BigInt(dto.amountMinor);
    if (amount <= 0n) {
      throw new BadRequestException("Amount must be strictly positive.");
    }

    // 1. Check Circuit Breaker
    this.circuitBreaker.checkAvailability("paymongo");

    const maskedPan = this.maskPan(dto.cardNumber);
    const paymentIntentId = `pi_${crypto.randomUUID()}`;
    const orderId = `ord_${crypto.randomUUID()}`;
    const currency = dto.currency || "PHP";

    // Deterministic 3DS rule: payments >= 1,000 PHP trigger 3-D Secure challenge
    const requires3DS = amount >= 100000n || dto.cardNumber.endsWith("3000");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // 2. Insert Order
      await client.query(
        `INSERT INTO payrail_private.orders 
           (id, merchant_id, order_number, amount_minor, currency, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [orderId, dto.merchantId, dto.orderNumber, dto.amountMinor, currency],
      );

      // 3. Insert Payment Intent
      const initialState = requires3DS ? "AWAITING_PAYMENT" : "SUCCEEDED";

      await client.query(
        `INSERT INTO payrail_private.payment_intents 
           (id, merchant_id, order_id, amount_minor, currency, provider, payment_method, state)
         VALUES ($1, $2, $3, $4, $5, 'paymongo', 'card', $6)`,
        [paymentIntentId, dto.merchantId, orderId, dto.amountMinor, currency, initialState],
      );

      // 4. Insert Payment Attempt with masked PAN
      const providerPaymentId = `pay_card_${Date.now()}`;
      await client.query(
        `INSERT INTO payrail_private.payment_attempts
           (id, payment_intent_id, provider, provider_operation_key, provider_payment_id, submission_state)
         VALUES ($1, $2, 'paymongo', $3, $4, $5)`,
        [crypto.randomUUID(), paymentIntentId, dto.idempotencyKey, providerPaymentId, initialState],
      );

      // 5. If frictionless / instant success without 3DS, post to ledger
      if (!requires3DS) {
        await this.ledgerService.postPaymentSuccess(
          dto.merchantId,
          paymentIntentId,
          dto.amountMinor,
          currency,
          client,
        );
      }

      await client.query("COMMIT");
      this.circuitBreaker.recordSuccess("paymongo");

      const threeDSecureUrl = requires3DS
        ? `https://test-3ds.payrail.ph/challenge/${paymentIntentId}`
        : undefined;

      return {
        paymentIntentId,
        orderNumber: dto.orderNumber,
        amountMinor: dto.amountMinor,
        currency,
        state: initialState,
        maskedCard: maskedPan,
        threeDSecureRequired: requires3DS,
        threeDSecureUrl,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      await client.query("ROLLBACK");
      this.circuitBreaker.recordFailure("paymongo");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Resolves a 3-D Secure authentication challenge outcome.
   */
  async resolve3DSChallenge(
    paymentIntentId: string,
    outcome: "success" | "failure",
  ): Promise<{ paymentIntentId: string; state: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const res = await client.query<{
        id: string;
        merchant_id: string;
        amount_minor: string;
        currency: string;
        state: string;
      }>(
        `SELECT id, merchant_id, amount_minor, currency, state
         FROM payrail_private.payment_intents
         WHERE id = $1
         FOR UPDATE`,
        [paymentIntentId],
      );

      const payment = res.rows[0];
      if (!payment) {
        throw new NotFoundException(`Payment intent '${paymentIntentId}' not found.`);
      }
      const nextState = outcome === "success" ? "SUCCEEDED" : "FAILED";

      await client.query(
        `UPDATE payrail_private.payment_intents
         SET state = $1, updated_at = clock_timestamp()
         WHERE id = $2`,
        [nextState, paymentIntentId],
      );

      await client.query(
        `INSERT INTO payrail_private.payment_state_events
           (payment_intent_id, previous_state, next_state, source)
         VALUES ($1, $2, $3, '3DS_CHALLENGE')`,
        [paymentIntentId, payment.state, nextState],
      );

      if (nextState === "SUCCEEDED") {
        await this.ledgerService.postPaymentSuccess(
          payment.merchant_id,
          paymentIntentId,
          payment.amount_minor,
          payment.currency,
          client,
        );
      }

      await client.query("COMMIT");
      return { paymentIntentId, state: nextState };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
