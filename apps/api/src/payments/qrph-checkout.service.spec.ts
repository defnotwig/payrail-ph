import { describe, expect, it, vi } from "vitest";
import { QrPhCheckoutService } from "./qrph-checkout.service";
import type { PaymentsService, PaymentIntentView } from "./payments.service";

describe("QrPhCheckoutService", () => {
  it("creates checkout and returns safe DTO with 30-minute expiry", async () => {
    const mockPayment: PaymentIntentView = {
      id: "pi_123456",
      merchantId: "merchant_default",
      orderId: "ord_123",
      orderNumber: "PRL-998877",
      amountMinor: "100",
      currency: "PHP",
      state: "AWAITING_PAYMENT",
      provider: "paymongo",
      paymentMethod: "qrph",
      qrCodeUrl: "https://api.paymongo.com/qr/sample.png",
      testUrl: "https://test-paymongo.payrail.ph/simulate/sample",
      evidenceMode: "sandbox",
      createdAt: "2026-10-19T10:00:00.000Z",
      updatedAt: "2026-10-19T10:00:00.000Z",
    };

    const mockPaymentsService = {
      createQrPhPayment: vi.fn().mockResolvedValue(mockPayment),
      getPaymentIntent: vi.fn().mockResolvedValue(mockPayment),
    } as unknown as PaymentsService;

    const service = new QrPhCheckoutService(mockPaymentsService);
    const result = await service.createCheckout(
      {
        amountMinor: "100",
        currency: "PHP",
        orderNumber: "PRL-998877",
        description: "Test checkout",
        merchantId: "merchant_default",
      },
      "idem_test_key_1",
    );

    expect(result.paymentId).toBe("pi_123456");
    expect(result.reference).toBe("PRL-998877");
    expect(result.amountMinor).toBe("100");
    expect(result.currency).toBe("PHP");
    expect(result.status).toBe("AWAITING_PAYMENT");
    expect(result.qrCodeUrl).toBe("https://api.paymongo.com/qr/sample.png");
    expect(result.testUrl).toBe("https://test-paymongo.payrail.ph/simulate/sample");
    expect(result.expiresAt).toBe("2026-10-19T10:30:00.000Z");
  });

  it("throws BadRequestException when merchantId is missing", async () => {
    const mockPaymentsService = {} as PaymentsService;
    const service = new QrPhCheckoutService(mockPaymentsService);

    await expect(
      service.createCheckout(
        {
          amountMinor: "100",
          merchantId: "",
        },
        "idem_1",
      ),
    ).rejects.toThrow("Merchant ID is required for checkout.");
  });
});
