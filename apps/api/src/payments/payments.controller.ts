import { Body, Controller, Get, Headers, Inject, Param, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiSecurity, ApiBody } from "@nestjs/swagger";
import { z } from "zod";
import { PaymentsService } from "./payments.service";
import { AllowApiKey, Permissions, type OperatorRequest } from "../auth/authorization";
import { identifier, money, pageLimit, parseInput, requiredIdempotency } from "../auth/validation";
const bodySchema = z.strictObject({
  amountMinor: money,
  currency: z.literal("PHP").optional(),
  orderNumber: identifier.optional(),
  description: z.string().max(240).optional(),
});
@Controller("payments")
@ApiBearerAuth()
@ApiSecurity("merchantKey")
@AllowApiKey()
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}
  @Get()
  @Permissions("payments:read")
  async list(@Req() request: OperatorRequest, @Query("limit") limit?: string) {
    return {
      data: await this.payments.listPaymentIntents(request.user.merchantId, pageLimit(limit)),
    };
  }
  @Post()
  @Permissions("payments:write")
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["amountMinor"],
      properties: {
        amountMinor: { type: "string", pattern: "^[1-9][0-9]{0,18}$" },
        currency: { type: "string", enum: ["PHP"] },
        orderNumber: { type: "string" },
        description: { type: "string", maxLength: 240 },
      },
    },
  })
  async createPayment(
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
    @Req() request: OperatorRequest,
  ) {
    const parsed = parseInput(bodySchema, body);
    return this.payments.createQrPhPayment(
      { ...parsed, merchantId: request.user.merchantId },
      requiredIdempotency(key),
    );
  }
  @Get(":id")
  @Permissions("payments:read")
  getPayment(@Param("id") id: string, @Req() request: OperatorRequest) {
    return this.payments.getPaymentIntent(parseInput(identifier, id), request.user.merchantId);
  }
}
