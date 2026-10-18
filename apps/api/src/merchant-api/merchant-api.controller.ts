import { Controller, Get, Post, Delete, Body, Param, Query, Headers } from "@nestjs/common";
import type { MerchantKeysService } from "./merchant-keys.service";
import type { MerchantWebhooksService } from "./merchant-webhooks.service";

@Controller("v1")
export class MerchantApiController {
  constructor(
    private readonly keysService: MerchantKeysService,
    private readonly webhooksService: MerchantWebhooksService,
  ) {}

  // 1. Merchant API Keys
  @Get("api-keys")
  async listKeys(@Headers("x-merchant-id") merchantId = "merchant_default") {
    const keys = await this.keysService.listApiKeys(merchantId);
    return { data: keys };
  }

  @Post("api-keys")
  async createKey(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Body()
    body: {
      name: string;
      scopes?: string[];
      environment?: "test" | "live";
      keyType?: "public" | "secret";
    },
  ) {
    const result = await this.keysService.createApiKey({
      merchantId,
      name: body.name,
      scopes: body.scopes,
      environment: body.environment,
      keyType: body.keyType,
    });
    return { data: result };
  }

  @Delete("api-keys/:id")
  async revokeKey(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Param("id") id: string,
  ) {
    await this.keysService.revokeApiKey(merchantId, id);
    return { message: `API key '${id}' has been revoked successfully.` };
  }

  // 2. Outbound Webhooks
  @Get("webhooks/endpoints")
  async listEndpoints(@Headers("x-merchant-id") merchantId = "merchant_default") {
    const endpoints = await this.webhooksService.listEndpoints(merchantId);
    return { data: endpoints };
  }

  @Post("webhooks/endpoints")
  async registerEndpoint(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Body()
    body: {
      url: string;
      subscribedEvents: string[];
    },
  ) {
    const endpoint = await this.webhooksService.registerEndpoint({
      merchantId,
      url: body.url,
      subscribedEvents: body.subscribedEvents,
    });
    return { data: endpoint };
  }

  @Get("webhooks/deliveries")
  async listDeliveries(@Query("endpointId") endpointId?: string, @Query("limit") limit = "50") {
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
    const deliveries = await this.webhooksService.getDeliveries(endpointId, parsedLimit);
    return { data: deliveries };
  }
}
