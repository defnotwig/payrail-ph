import { BadRequestException, Controller, Headers, Inject, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import { Public } from "../auth/authorization";

interface IncomingRequest {
  rawBody?: Buffer;
  body?: unknown;
}

@Controller("webhooks")
export class WebhooksController {
  constructor(
    @Inject(WebhooksService)
    private readonly webhooksService: WebhooksService,
  ) {}

  @Post("paymongo")
  @Public()
  async handlePayMongoWebhook(
    @Req() req: RawBodyRequest<IncomingRequest>,
    @Headers("paymongo-signature") signatureHeader: string,
  ) {
    const rawBody = req.rawBody;

    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      throw new BadRequestException("Missing raw request body.");
    }

    return this.webhooksService.processPayMongoWebhook(rawBody, signatureHeader);
  }
}
