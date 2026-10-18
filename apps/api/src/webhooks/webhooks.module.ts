import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { PaymentsModule } from "../payments/payments.module";
import { PayMongoModule } from "../paymongo/paymongo.module";

@Module({
  imports: [PaymentsModule, PayMongoModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
