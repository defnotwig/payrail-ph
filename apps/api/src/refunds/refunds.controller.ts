import { Controller, Get, Post, Body, Param, Query, Headers, Inject, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiSecurity } from "@nestjs/swagger";
import { z } from "zod";
import { RefundsService } from "./refunds.service";
import { AllowApiKey, Permissions, type OperatorRequest } from "../auth/authorization";
import { identifier, money, parseInput, requiredIdempotency } from "../auth/validation";
@Controller("refunds")
@ApiBearerAuth()
@ApiSecurity("merchantKey")
@AllowApiKey()
export class RefundsController {
  constructor(@Inject(RefundsService) private readonly refunds: RefundsService) {}
  @Get()
  @Permissions("refunds:read")
  async getRefunds(@Req() request: OperatorRequest, @Query("paymentIntentId") id?: string) {
    return {
      data: await this.refunds.getRefunds(
        request.user.merchantId,
        id === undefined ? undefined : parseInput(identifier, id),
      ),
    };
  }
  @Get(":id")
  @Permissions("refunds:read")
  async getRefundById(@Req() request: OperatorRequest, @Param("id") id: string) {
    return {
      data: await this.refunds.getRefundById(request.user.merchantId, parseInput(identifier, id)),
    };
  }
  @Post()
  @Permissions("refunds:write")
  async createRefund(
    @Req() request: OperatorRequest,
    @Headers("idempotency-key") key: string,
    @Body() body: unknown,
  ) {
    const parsed = parseInput(
      z.strictObject({
        paymentIntentId: identifier,
        amountMinor: money,
        reason: z.string().min(1).max(240),
        currency: z.literal("PHP").optional(),
      }),
      body,
    );
    return {
      data: await this.refunds.createRefund({
        ...parsed,
        merchantId: request.user.merchantId,
        idempotencyKey: requiredIdempotency(key),
      }),
    };
  }
}
