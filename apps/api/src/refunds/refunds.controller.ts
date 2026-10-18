import { Controller, Get, Post, Body, Param, Query, Headers } from "@nestjs/common";
import type { RefundsService } from "./refunds.service";

@Controller("refunds")
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get()
  async getRefunds(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Query("paymentIntentId") paymentIntentId?: string,
  ) {
    const refunds = await this.refundsService.getRefunds(merchantId, paymentIntentId);
    return { data: refunds };
  }

  @Get(":id")
  async getRefundById(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Param("id") id: string,
  ) {
    const refund = await this.refundsService.getRefundById(merchantId, id);
    return { data: refund };
  }

  @Post()
  async createRefund(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Headers("idempotency-key") idempotencyKey: string,
    @Body()
    body: {
      paymentIntentId: string;
      amountMinor: string;
      reason: string;
      currency?: string;
    },
  ) {
    const refund = await this.refundsService.createRefund({
      merchantId,
      idempotencyKey: idempotencyKey || `idem_ref_${Date.now()}`,
      paymentIntentId: body.paymentIntentId,
      amountMinor: body.amountMinor,
      reason: body.reason,
      currency: body.currency,
    });
    return { data: refund };
  }
}
