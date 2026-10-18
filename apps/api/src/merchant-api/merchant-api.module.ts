import { Module } from "@nestjs/common";
import { MerchantKeysService } from "./merchant-keys.service";
import { MerchantWebhooksService } from "./merchant-webhooks.service";
import { MerchantApiController } from "./merchant-api.controller";

@Module({
  controllers: [MerchantApiController],
  providers: [MerchantKeysService, MerchantWebhooksService],
  exports: [MerchantKeysService, MerchantWebhooksService],
})
export class MerchantApiModule {}
