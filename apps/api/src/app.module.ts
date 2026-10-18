import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { PayMongoModule } from "./paymongo/paymongo.module";
import { PaymentsModule } from "./payments/payments.module";
import { WebhooksModule } from "./webhooks/webhooks.module";

@Module({
  imports: [DatabaseModule, HealthModule, PayMongoModule, PaymentsModule, WebhooksModule],
})
export class AppModule {}
