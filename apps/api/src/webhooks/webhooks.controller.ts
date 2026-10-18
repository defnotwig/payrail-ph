import { BadRequestException, Controller, Headers, Inject, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

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
  async handlePayMongoWebhook(
    @Req() req: RawBodyRequest<IncomingRequest>,
    @Headers("paymongo-signature") signatureHeader: string,
  ) {
    const rawBody =
      req.rawBody || (req.body ? Buffer.from(JSON.stringify(req.body)) : Buffer.alloc(0));

    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException("Missing raw request body.");
    }

    return this.webhooksService.processPayMongoWebhook(rawBody, signatureHeader);
  }
}
