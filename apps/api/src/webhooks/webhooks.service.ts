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
import { inTransaction } from "../financial/transaction";

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
    @Inject(PayMongoAdapter) private readonly adapter: PayMongoAdapter,
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
    const paymentData = parsedPayload?.data?.attributes?.data;
    const providerPaymentIntentId = paymentData?.attributes?.payment_intent_id;
    const observedAmount = paymentData?.attributes?.amount;
    const observedCurrency = paymentData?.attributes?.currency?.toUpperCase();
    const status = paymentData?.attributes?.status;
    const result = await inTransaction(this.pool, async (client) => {
      const existing = await client.query(
        `SELECT id FROM payrail_private.provider_events WHERE provider='paymongo' AND provider_account=$1 AND environment=$2 AND provider_event_id=$3 FOR UPDATE`,
        [this.adapter.account, this.environment, providerEventId],
      );
      if (existing.rows[0]) return { deduplicated: true };
      const internalEventId = `evt_${crypto.randomUUID()}`;
      const inserted = await client.query(
        `INSERT INTO payrail_private.provider_events(id,provider,provider_account,environment,provider_event_id,event_type,payload_hash,raw_payload,signature_verified,processing_state)
         VALUES($1,'paymongo',$2,$3,$4,$5,$6,$7,true,'PENDING') ON CONFLICT DO NOTHING RETURNING id`,
        [
          internalEventId,
          this.adapter.account,
          this.environment,
          providerEventId,
          eventType,
          payloadHash,
          bodyString,
        ],
      );
      if (!inserted.rowCount) return { deduplicated: true };
      if (eventType !== "payment.paid") {
        await client.query(
          "UPDATE payrail_private.provider_events SET processing_state='IGNORED',processed_at=clock_timestamp() WHERE id=$1",
          [internalEventId],
        );
        return { deduplicated: false };
      }
      if (
        !providerPaymentIntentId ||
        !Number.isSafeInteger(observedAmount) ||
        !observedCurrency ||
        status !== "paid"
      ) {
        await client.query(
          "UPDATE payrail_private.provider_events SET processing_state='DISCREPANCY',error_message='Incomplete paid observation',processed_at=clock_timestamp() WHERE id=$1",
          [internalEventId],
        );
        return { deduplicated: false };
      }
      const lookup = await client.query<{ id: string; merchant_id: string }>(
        `SELECT p.id,p.merchant_id FROM payrail_private.payment_intents p JOIN payrail_private.payment_attempts a ON a.payment_intent_id=p.id
         WHERE a.provider='paymongo' AND a.provider_account=$1 AND a.environment=$2 AND a.provider_payment_id=$3 FOR UPDATE OF p`,
        [this.adapter.account, this.environment, providerPaymentIntentId],
      );
      const payment = lookup.rows[0];
      if (!payment) {
        await client.query(
          "UPDATE payrail_private.provider_events SET processing_state='DISCREPANCY',error_message='Unmatched payment intent',processed_at=clock_timestamp() WHERE id=$1",
          [internalEventId],
        );
        return { deduplicated: false };
      }
      const stored = await client.query<{ amount_minor: string; currency: string }>(
        "SELECT amount_minor,currency FROM payrail_private.payment_intents WHERE id=$1",
        [payment.id],
      );
      if (
        stored.rows[0]?.amount_minor !== String(observedAmount) ||
        stored.rows[0]?.currency !== observedCurrency
      ) {
        await client.query(
          "UPDATE payrail_private.provider_events SET payment_intent_id=$1,normalized_observation=$2,processing_state='DISCREPANCY',error_message='Amount or currency mismatch',processed_at=clock_timestamp() WHERE id=$3",
          [
            payment.id,
            JSON.stringify({
              providerPaymentIntentId,
              amountMinor: String(observedAmount),
              currency: observedCurrency,
            }),
            internalEventId,
          ],
        );
        return { deduplicated: false };
      }
      await client.query(
        "UPDATE payrail_private.provider_events SET payment_intent_id=$1,normalized_observation=$2 WHERE id=$3",
        [
          payment.id,
          JSON.stringify({
            providerPaymentIntentId,
            amountMinor: String(observedAmount),
            currency: observedCurrency,
            state: "SUCCEEDED",
          }),
          internalEventId,
        ],
      );
      await this.paymentsService.applyObservationInTransaction(client, {
        paymentIntentId: payment.id,
        merchantId: payment.merchant_id,
        provider: "paymongo",
        providerAccount: this.adapter.account,
        environment: "test",
        providerPaymentIntentId,
        amountMinor: String(observedAmount),
        currency: observedCurrency,
        state: "SUCCEEDED",
        source: "VERIFIED_WEBHOOK",
        eventId: internalEventId,
      });
      await client.query(
        "UPDATE payrail_private.provider_events SET processing_state='PROCESSED',processed_at=clock_timestamp() WHERE id=$1",
        [internalEventId],
      );
      return { deduplicated: false };
    });
    if (result.deduplicated)
      this.logger.warn(`Duplicate webhook delivery detected: ${providerEventId}`);
    return {
      received: true,
      deduplicated: result.deduplicated,
      processed: !result.deduplicated,
      eventId: providerEventId,
    };
  }
}
