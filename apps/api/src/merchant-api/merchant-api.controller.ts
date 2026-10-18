import { Controller, Get, Post, Delete, Body, Param, Query, Inject, Req } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { z } from "zod";
import { MerchantKeysService } from "./merchant-keys.service";
import { MerchantWebhooksService } from "./merchant-webhooks.service";
import { Permissions, type OperatorRequest } from "../auth/authorization";
import { pageLimit, parseInput } from "../auth/validation";
import { AuditService } from "../audit/audit.service";
@Controller("v1")
@ApiBearerAuth()
export class MerchantApiController {
  constructor(
    @Inject(MerchantKeysService) private readonly keys: MerchantKeysService,
    @Inject(MerchantWebhooksService) private readonly webhooks: MerchantWebhooksService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}
  @Get("api-keys")
  @Permissions("keys:read")
  async listKeys(@Req() request: OperatorRequest) {
    return { data: await this.keys.listApiKeys(request.user.merchantId) };
  }
  @Post("api-keys")
  @Permissions("keys:write")
  async createKey(@Req() request: OperatorRequest, @Body() body: unknown) {
    const parsed = parseInput(
      z.strictObject({
        name: z.string().min(1).max(100),
        scopes: z
          .array(z.enum(["payments:read", "payments:write", "refunds:read", "refunds:write"]))
          .min(1)
          .max(4)
          .optional(),
        environment: z.literal("test").optional(),
        keyType: z.literal("secret").optional(),
      }),
      body,
    );
    const created = await this.keys.createApiKey({
      ...parsed,
      merchantId: request.user.merchantId,
    });
    try {
      await this.audit.recordEvent({
        merchantId: request.user.merchantId,
        actorType: request.user.actorType,
        actorId: request.user.userId,
        action: "API_KEY_CREATED",
        resourceType: "merchant_api_key",
        resourceId: created.id,
        metadata: { name: created.name, scopes: created.scopes, environment: created.environment },
      });
    } catch (error) {
      await this.keys.revokeApiKey(request.user.merchantId, created.id);
      throw error;
    }
    return { data: created };
  }
  @Delete("api-keys/:id")
  @Permissions("keys:write")
  async revokeKey(@Req() request: OperatorRequest, @Param("id") id: string) {
    const keyId = parseInput(z.uuid(), id);
    await this.keys.revokeApiKey(request.user.merchantId, keyId);
    await this.audit.recordEvent({
      merchantId: request.user.merchantId,
      actorType: request.user.actorType,
      actorId: request.user.userId,
      action: "API_KEY_REVOKED",
      resourceType: "merchant_api_key",
      resourceId: keyId,
    });
    return { message: "API key revoked." };
  }
  @Get("webhooks/endpoints")
  @Permissions("webhooks:read")
  async listEndpoints(@Req() request: OperatorRequest) {
    return { data: await this.webhooks.listEndpoints(request.user.merchantId) };
  }
  @Post("webhooks/endpoints")
  @Permissions("webhooks:write")
  async registerEndpoint(@Req() request: OperatorRequest, @Body() body: unknown) {
    const parsed = parseInput(
      z.strictObject({
        url: z.url().max(2048),
        subscribedEvents: z
          .array(
            z.enum(["payment.succeeded", "payment.failed", "refund.succeeded", "refund.failed"]),
          )
          .min(1)
          .max(4),
      }),
      body,
    );
    const created = await this.webhooks.registerEndpoint({
      ...parsed,
      merchantId: request.user.merchantId,
    });
    try {
      await this.audit.recordEvent({
        merchantId: request.user.merchantId,
        actorType: request.user.actorType,
        actorId: request.user.userId,
        action: "WEBHOOK_ENDPOINT_CREATED",
        resourceType: "merchant_webhook_endpoint",
        resourceId: created.id,
        metadata: { url: created.url, subscribedEvents: created.subscribedEvents },
      });
    } catch (error) {
      await this.webhooks.deactivateEndpoint(request.user.merchantId, created.id);
      throw error;
    }
    return { data: created };
  }
  @Delete("webhooks/endpoints/:id")
  @Permissions("webhooks:write")
  async revokeEndpoint(@Req() request: OperatorRequest, @Param("id") id: string) {
    const endpointId = parseInput(z.uuid(), id);
    await this.webhooks.deactivateEndpoint(request.user.merchantId, endpointId);
    await this.audit.recordEvent({
      merchantId: request.user.merchantId,
      actorType: request.user.actorType,
      actorId: request.user.userId,
      action: "WEBHOOK_ENDPOINT_DEACTIVATED",
      resourceType: "merchant_webhook_endpoint",
      resourceId: endpointId,
    });
    return { message: "Webhook endpoint deactivated." };
  }
  @Get("webhooks/deliveries")
  @Permissions("webhooks:read")
  async listDeliveries(
    @Req() request: OperatorRequest,
    @Query("endpointId") id?: string,
    @Query("limit") limit?: string,
  ) {
    return {
      data: await this.webhooks.getDeliveries(
        request.user.merchantId,
        id === undefined ? undefined : parseInput(z.uuid(), id),
        pageLimit(limit),
      ),
    };
  }
}
