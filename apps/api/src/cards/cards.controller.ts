import { Controller, Post, Body, Param, Headers, Inject, Req } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { z } from "zod";
import { CardsService } from "./cards.service";
import { Permissions, type OperatorRequest } from "../auth/authorization";
import { identifier, money, parseInput, requiredIdempotency } from "../auth/validation";
@Controller("cards")
@ApiBearerAuth()
export class CardsController {
  constructor(@Inject(CardsService) private readonly cards: CardsService) {}
  @Post("initiate")
  @Permissions("cards:write")
  initiate(
    @Headers("idempotency-key") key: string,
    @Body() body: unknown,
    @Req() request: OperatorRequest,
  ) {
    const parsed = parseInput(
      z.strictObject({
        orderNumber: identifier,
        amountMinor: money,
        currency: z.literal("PHP").optional(),
        cardholderName: z.string().min(1).max(100),
        cardNumber: z.string().min(12).max(19),
        expMonth: z.number().int().min(1).max(12),
        expYear: z.number().int().min(2025).max(2040),
        cvc: z.string().min(3).max(4),
      }),
      body,
    );
    return this.cards
      .initiateCardPayment({
        ...parsed,
        currency: parsed.currency || "PHP",
        merchantId: request.user.merchantId,
        idempotencyKey: requiredIdempotency(key),
      })
      .then((data) => ({ data }));
  }
  @Post(":id/3ds-challenge")
  @Permissions("cards:write")
  resolve3DS(@Param("id") id: string, @Body() body: unknown) {
    const parsed = parseInput(z.strictObject({ outcome: z.enum(["success", "failure"]) }), body);
    return this.cards
      .resolve3DSChallenge(parseInput(identifier, id), parsed.outcome)
      .then((data) => ({ data }));
  }
}
