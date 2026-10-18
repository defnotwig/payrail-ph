import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { type CreatePaymentDto, PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  async createPayment(
    @Body() body: CreatePaymentDto,
    @Headers("idempotency-key") idempotencyKey: string,
  ) {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException("Idempotency-Key header is required.");
    }

    if (!body.amountMinor) {
      throw new BadRequestException("amountMinor is required.");
    }

    return this.paymentsService.createQrPhPayment(body, idempotencyKey.trim());
  }

  @Get(":id")
  async getPayment(@Param("id") id: string) {
    return this.paymentsService.getPaymentIntent(id);
  }
}
