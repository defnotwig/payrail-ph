import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { PayMongoModule } from "./paymongo/paymongo.module";
import { PaymentsModule } from "./payments/payments.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { LedgerModule } from "./ledger/ledger.module";
import { RefundsModule } from "./refunds/refunds.module";
import { JobsModule } from "./jobs/jobs.module";
import { AuthModule } from "./auth/auth.module";
import { MerchantApiModule } from "./merchant-api/merchant-api.module";
import { CardsModule } from "./cards/cards.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { AuditModule } from "./audit/audit.module";
import { Iso8583Module } from "./iso8583/iso8583.module";

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    PayMongoModule,
    PaymentsModule,
    WebhooksModule,
    LedgerModule,
    RefundsModule,
    JobsModule,
    AuthModule,
    MerchantApiModule,
    CardsModule,
    ReconciliationModule,
    AuditModule,
    Iso8583Module,
  ],
})
export class AppModule {}
