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

  it("requires explicit fixture mode and labels its references", async () => {
    const adapter = new PayMongoAdapter("sk_test_placeholder", "fixture");
    const payment = await adapter.createQrPhPayment(10000n, "PHP", "Test Order");

    expect(payment.providerPaymentIntentId).toBeDefined();
    expect(payment.providerPaymentIntentId.startsWith("pi_")).toBe(true);
    expect(payment.providerPaymentMethodId.startsWith("pm_")).toBe(true);
    expect(payment.status).toBe("awaiting_next_action");
    expect(payment.testUrl).toBeDefined();
    expect(payment.testUrl?.startsWith("http://localhost/")).toBe(true);
    expect(payment.providerPaymentIntentId.startsWith("pi_fixture_")).toBe(true);
  });
  it("refuses placeholder and live credentials in sandbox mode", async () => {
    await expect(
      new PayMongoAdapter("sk_test_placeholder", "sandbox").createQrPhPayment(100n),
    ).rejects.toThrow();
    await expect(
      new PayMongoAdapter("sk_live_forbidden", "sandbox").createQrPhPayment(100n),
    ).rejects.toThrow();
  });
  it("rejects a correctly signed stale delivery", () => {
    const t = 1;
    const body = "{}";
    const sig = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    expect(PayMongoAdapter.verifySignature(body, `t=${t},te=${sig}`, secret)).toBe(false);
  });
});
