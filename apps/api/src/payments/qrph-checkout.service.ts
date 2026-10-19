import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { PaymentsService, type PaymentState } from "./payments.service";

export interface QrPhCheckoutDto {
  amountMinor: string;
  currency?: "PHP";
  orderNumber?: string;
  description?: string;
  merchantId: string;
}

export interface QrPhCheckoutResult {
  paymentId: string;
  reference: string;
  amountMinor: string;
  currency: string;
  status: PaymentState;
  qrCodeUrl?: string | undefined;
  testUrl?: string | undefined;
  expiresAt: string;
  provider: string;
  createdAt: string;
}

/**
 * QrPhCheckoutService
 *
 * Dedicated domain service managing the end-to-end QR Ph checkout lifecycle:
 * - Creates internal payment identity & authoritative order
 * - Enforces idempotency tracking
 * - Calls PayMongo provider adapter for dynamic QR Ph PaymentIntent + PaymentMethod
 * - Returns a safe, minimal checkout DTO without exposing sensitive credentials.
 */
@Injectable()
export class QrPhCheckoutService {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  async createCheckout(dto: QrPhCheckoutDto, idempotencyKey: string): Promise<QrPhCheckoutResult> {
    if (!dto.merchantId) {
      throw new BadRequestException("Merchant ID is required for checkout.");
    }

    const payment = await this.paymentsService.createQrPhPayment(
      {
        amountMinor: dto.amountMinor,
        currency: dto.currency || "PHP",
        orderNumber: dto.orderNumber,
        description: dto.description || `PayRail QR Ph Checkout ${dto.orderNumber || ""}`.trim(),
        merchantId: dto.merchantId,
      },
      idempotencyKey,
    );

    // Dynamic QR Ph standard expiry: 30 minutes from creation
    const createdDate = new Date(payment.createdAt);
    const expiresAt = new Date(createdDate.getTime() + 30 * 60 * 1000).toISOString();

    return {
      paymentId: payment.id,
      reference: payment.orderNumber,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      status: payment.state,
      qrCodeUrl: payment.qrCodeUrl,
      testUrl: payment.testUrl,
      expiresAt,
      provider: payment.provider,
      createdAt: payment.createdAt,
    };
  }

  async getCheckout(paymentId: string, merchantId: string): Promise<QrPhCheckoutResult> {
    const payment = await this.paymentsService.getPaymentIntent(paymentId, merchantId);
    const createdDate = new Date(payment.createdAt);
    const expiresAt = new Date(createdDate.getTime() + 30 * 60 * 1000).toISOString();

    return {
      paymentId: payment.id,
      reference: payment.orderNumber,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      status: payment.state,
      qrCodeUrl: payment.qrCodeUrl,
      testUrl: payment.testUrl,
      expiresAt,
      provider: payment.provider,
      createdAt: payment.createdAt,
    };
  }
}
