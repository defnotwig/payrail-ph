import { describe, expect, it } from "vitest";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import type { DatabasePool } from "../database/database.pool";
import type { PaymentsService } from "../payments/payments.service";

describe("PayMongo webhook verification", () => {
  it("rejects an invalid signature even when the configured secret is the local placeholder", async () => {
    process.env.DATABASE_URL = "postgresql://payrail@127.0.0.1:55432/payrail_local";
    process.env.WEB_ORIGIN = "http://localhost:3000";
    process.env.SUPABASE_URL = "https://identity.example.test";
    process.env.WEBHOOK_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.PAYMONGO_SECRET_KEY = "sk_test_placeholder";
    process.env.PAYMONGO_WEBHOOK_SECRET = "whsk_test_placeholder";
    const service = new WebhooksService({} as DatabasePool, {} as PaymentsService);

    await expect(
      service.processPayMongoWebhook(
        Buffer.from("{}"),
        "t=1700000000,te=00000000000000000000000000000000",
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("requires a signature header and rejects an absent raw body", async () => {
    process.env.DATABASE_URL = "postgresql://payrail@127.0.0.1:55432/payrail_local";
    process.env.WEB_ORIGIN = "http://localhost:3000";
    process.env.SUPABASE_URL = "https://identity.example.test";
    process.env.WEBHOOK_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.PAYMONGO_SECRET_KEY = "sk_test_placeholder";
    process.env.PAYMONGO_WEBHOOK_SECRET = "whsk_test_placeholder";
    const service = new WebhooksService({} as DatabasePool, {} as PaymentsService);

    await expect(service.processPayMongoWebhook(Buffer.from("{}"), "")).rejects.toThrow(
      BadRequestException,
    );
  });
});
