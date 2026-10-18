import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabasePool } from "../database/database.pool";
import { PayMongoAdapter } from "../paymongo/paymongo.adapter";
import { PaymentsService } from "./payments.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import * as crypto from "node:crypto";

describe("PayRail PH QR Ph Local End-to-End Payment Flow", () => {
  let pool: DatabasePool;
  let adapter: PayMongoAdapter;
  let paymentsService: PaymentsService;
  let webhooksService: WebhooksService;
  let isDbAvailable = false;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || "postgresql://payrail@127.0.0.1:55432/payrail_local";
    process.env.WEB_ORIGIN = "http://localhost:3000";
    process.env.PAYMONGO_SECRET_KEY = "sk_test_placeholder";
    process.env.PAYMONGO_WEBHOOK_SECRET = "whsk_test_placeholder";
    process.env.PAYMENTS_MODE = "test";

    pool = new DatabasePool();
    try {
      const client = await pool.connect();
      client.release();
      isDbAvailable = true;
    } catch {
      isDbAvailable = false;
      return;
    }

    adapter = new PayMongoAdapter();
    paymentsService = new PaymentsService(pool, adapter);
    webhooksService = new WebhooksService(pool, paymentsService);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it("completes full QR Ph lifecycle: creation -> test url -> signed webhook -> succeeded", async () => {
    if (!isDbAvailable) {
      console.warn(
        "PostgreSQL cluster is not available in current environment; skipping database-backed e2e test.",
      );
      return;
    }

    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    const orderNumber = `ORD-E2E-${Date.now()}`;

    // 1. Create Payment
    const payment = await paymentsService.createQrPhPayment(
      {
        amountMinor: "15000",
        currency: "PHP",
        orderNumber,
        description: "Integration test order",
      },
      idempotencyKey,
    );

    expect(payment.id).toBeDefined();
    expect(payment.state).toBe("AWAITING_PAYMENT");
    expect(payment.amountMinor).toBe("15000");
    expect(payment.providerPaymentIntentId).toBeDefined();
    expect(payment.testUrl).toBeDefined();

    // 2. Test Idempotency with exact same request -> returns same payment
    const replay = await paymentsService.createQrPhPayment(
      {
        amountMinor: "15000",
        currency: "PHP",
        orderNumber,
        description: "Integration test order",
      },
      idempotencyKey,
    );

    expect(replay.id).toBe(payment.id);
    expect(replay.state).toBe("AWAITING_PAYMENT");

    // 3. Test Idempotency conflict with altered amount -> throws 409
    await expect(
      paymentsService.createQrPhPayment(
        {
          amountMinor: "25000",
          currency: "PHP",
          orderNumber,
          description: "Integration test order",
        },
        idempotencyKey,
      ),
    ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");

    // 4. Simulate genuine PayMongo Webhook (payment.paid)
    const providerEventId = `evt_${crypto.randomUUID()}`;
    const webhookPayload = {
      data: {
        id: providerEventId,
        type: "event",
        attributes: {
          type: "payment.paid",
          livemode: false,
          data: {
            id: `pay_${crypto.randomUUID()}`,
            type: "payment",
            attributes: {
              amount: 15000,
              currency: "PHP",
              status: "paid",
              payment_intent_id: payment.providerPaymentIntentId,
            },
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhookPayload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac("sha256", "whsk_test_placeholder")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    const signatureHeader = `t=${timestamp},te=${signature}`;

    const webhookResult = await webhooksService.processPayMongoWebhook(
      Buffer.from(rawBody),
      signatureHeader,
    );

    expect(webhookResult.received).toBe(true);
    expect(webhookResult.processed).toBe(true);

    // 5. Query payment from DB -> state must authoritatively be SUCCEEDED
    const updatedPayment = await paymentsService.getPaymentIntent(payment.id);
    expect(updatedPayment.state).toBe("SUCCEEDED");

    // 6. Webhook Deduplication Test: Deliver exact same webhook delivery again
    const duplicateDelivery = await webhooksService.processPayMongoWebhook(
      Buffer.from(rawBody),
      signatureHeader,
    );

    expect(duplicateDelivery.received).toBe(true);
    expect(duplicateDelivery.deduplicated).toBe(true);

    // State remains SUCCEEDED without regression or duplicate mutation
    const finalPayment = await paymentsService.getPaymentIntent(payment.id);
    expect(finalPayment.state).toBe("SUCCEEDED");
  });
});
