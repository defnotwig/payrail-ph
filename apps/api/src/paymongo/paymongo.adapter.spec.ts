import { describe, expect, it } from "vitest";
import { PayMongoAdapter } from "./paymongo.adapter";
import * as crypto from "node:crypto";

describe("PayMongoAdapter", () => {
  const secret = "whsk_test_secret_key_123456";

  it("verifies genuine PayMongo webhook signatures successfully", () => {
    const rawBody = JSON.stringify({
      data: {
        id: "evt_test_123",
        type: "event",
        attributes: { type: "payment.paid" },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadToSign = `${timestamp}.${rawBody}`;
    const signature = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");

    const header = `t=${timestamp},te=${signature}`;
    const result = PayMongoAdapter.verifySignature(rawBody, header, secret);
    expect(result).toBe(true);
  });

  it("rejects forged or tampered webhook bodies", () => {
    const rawBody = JSON.stringify({ data: { id: "evt_test_123" } });
    const tamperedBody = JSON.stringify({ data: { id: "evt_test_tampered" } });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const header = `t=${timestamp},te=${signature}`;
    const result = PayMongoAdapter.verifySignature(tamperedBody, header, secret);
    expect(result).toBe(false);
  });

  it("rejects invalid signature headers", () => {
    expect(PayMongoAdapter.verifySignature("{}", "", secret)).toBe(false);
    expect(PayMongoAdapter.verifySignature("{}", "t=123", secret)).toBe(false);
    expect(PayMongoAdapter.verifySignature("{}", "invalid_header", secret)).toBe(false);
  });

  it("generates a valid QR Ph test simulator response in placeholder mode", async () => {
    const adapter = new PayMongoAdapter();
    const payment = await adapter.createQrPhPayment(10000n, "PHP", "Test Order");

    expect(payment.providerPaymentIntentId).toBeDefined();
    expect(payment.providerPaymentIntentId.startsWith("pi_")).toBe(true);
    expect(payment.providerPaymentMethodId.startsWith("pm_")).toBe(true);
    expect(payment.status).toBe("awaiting_next_action");
    expect(payment.testUrl).toBeDefined();
    expect(payment.testUrl?.startsWith("https://test.paymongo.com/qrph/")).toBe(true);
    expect(payment.qrCodeUrl).toBeDefined();
  });
});
