import { Controller, Post, Body, Param, Headers } from "@nestjs/common";
import type { CardsService, InitiateCardPaymentDto } from "./cards.service";

@Controller("cards")
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post("initiate")
  async initiate(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Headers("idempotency-key") idempotencyKey: string,
    @Body()
    body: Omit<InitiateCardPaymentDto, "merchantId" | "idempotencyKey">,
  ) {
    const result = await this.cardsService.initiateCardPayment({
      ...body,
      merchantId,
      idempotencyKey: idempotencyKey || `idem_card_${Date.now()}`,
    });
    return { data: result };
  }

  @Post(":id/3ds-challenge")
  async resolve3DS(
    @Param("id") paymentIntentId: string,
    @Body() body: { outcome: "success" | "failure" },
  ) {
    const result = await this.cardsService.resolve3DSChallenge(
      paymentIntentId,
      body.outcome || "success",
    );
    return { data: result };
  }
}
