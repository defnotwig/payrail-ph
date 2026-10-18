import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import { parseEnvironment } from "../config/environment";
import { PayMongoAdapter } from "../paymongo/paymongo.adapter";
import { PaymentsService } from "../payments/payments.service";
import * as crypto from "node:crypto";

export interface WebhookResult {
  received: boolean;
  deduplicated?: boolean;
  processed?: boolean;
  eventId?: string;
}

interface PayMongoEventData {
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      type?: string;
      data?: {
        id?: string;
        type?: string;
        attributes?: {
          payment_intent_id?: string;
          status?: string;
          amount?: number;
          currency?: string;
        };
      };
    };
  };
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly webhookSecret: string;
  private readonly environment: string;

  constructor(
    @Inject(PG_POOL) private readonly pool: DatabasePool,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
  ) {
    const env = parseEnvironment(process.env);
    this.webhookSecret = env.PAYMONGO_WEBHOOK_SECRET;
    this.environment = env.PAYMENTS_MODE;
  }

  async processPayMongoWebhook(
    rawBody: Buffer | string,
    signatureHeader: string,
  ): Promise<WebhookResult> {
    if (!signatureHeader) {
      throw new BadRequestException("Missing paymongo-signature header.");
    }

    const bodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");

    const isValid = PayMongoAdapter.verifySignature(rawBody, signatureHeader, this.webhookSecret);

    if (!isValid) {
      this.logger.warn("PayMongo webhook signature verification failed.");
      throw new UnauthorizedException("Invalid paymongo-signature.");
    }

    let parsedPayload: PayMongoEventData;
    try {
      parsedPayload = JSON.parse(bodyString) as PayMongoEventData;
    } catch {
      throw new BadRequestException("Invalid JSON payload.");
    }

    const providerEventId = parsedPayload?.data?.id;
    const eventType = parsedPayload?.data?.attributes?.type;

    if (!providerEventId || !eventType) {
      throw new BadRequestException("Malformed PayMongo event payload.");
    }

    const payloadHash = crypto.createHash("sha256").update(bodyString).digest("hex");
    const client = await this.pool.connect();
    let internalEventId: string;

    try {
      await client.query("BEGIN");

      // Check deduplication
      const existing = await client.query<{ id: string; processing_state: string }>(
        `SELECT id, processing_state FROM payrail_private.provider_events
         WHERE provider = 'paymongo' AND environment = $1 AND provider_event_id = $2
         FOR UPDATE`,
        [this.environment, providerEventId],
      );

      if (existing.rows.length > 0) {
        this.logger.warn(`Duplicate webhook delivery detected: ${providerEventId}`);
        await client.query("COMMIT");
        return {
          received: true,
          deduplicated: true,
          eventId: providerEventId,
        };
      }

      internalEventId = `evt_${crypto.randomUUID()}`;
      await client.query(
        `INSERT INTO payrail_private.provider_events
           (id, provider, environment, provider_event_id, event_type, payload_hash, raw_payload, signature_verified, processing_state)
         VALUES ($1, 'paymongo', $2, $3, $4, $5, $6, true, 'PENDING')`,
        [internalEventId, this.environment, providerEventId, eventType, payloadHash, bodyString],
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // Process event effect
    if (eventType === "payment.paid") {
      const paymentData = parsedPayload?.data?.attributes?.data;
      const providerPaymentIntentId = paymentData?.attributes?.payment_intent_id || paymentData?.id;

      if (providerPaymentIntentId) {
        // Locate internal PaymentIntent by provider_payment_id in payment_attempts or direct ID
        const intentLookup = await this.pool.query<{ id: string }>(
          `SELECT pi.id
           FROM payrail_private.payment_intents pi
           LEFT JOIN payrail_private.payment_attempts pa ON pa.payment_intent_id = pi.id
           WHERE pa.provider_payment_id = $1 OR pi.id = $1
           LIMIT 1`,
          [providerPaymentIntentId],
        );

        const intentRow = intentLookup.rows[0];
        if (intentRow) {
          const paymentIntentId = intentRow.id;
          await this.paymentsService.applyGuardedTransition(
            paymentIntentId,
            "SUCCEEDED",
            "VERIFIED_WEBHOOK",
            internalEventId,
          );

          await this.pool.query(
            `UPDATE payrail_private.provider_events
             SET processing_state = 'PROCESSED', processed_at = clock_timestamp()
             WHERE id = $1`,
            [internalEventId],
          );
        } else {
          this.logger.warn(
            `Received payment.paid for unrecognized provider intent: ${providerPaymentIntentId}`,
          );
          await this.pool.query(
            `UPDATE payrail_private.provider_events
             SET processing_state = 'DISCREPANCY', error_message = 'Unmatched payment_intent_id', processed_at = clock_timestamp()
             WHERE id = $1`,
            [internalEventId],
          );
        }
      }
    }

    return {
      received: true,
      processed: true,
      eventId: providerEventId,
    };
  }
}
