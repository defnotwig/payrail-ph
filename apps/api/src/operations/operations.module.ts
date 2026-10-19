import { Module } from "@nestjs/common";
import { OperationsController } from "./operations.controller";
import { OperationsOverviewService } from "./operations-overview.service";
import { CircuitBreakerService } from "../providers/circuit-breaker.service";
import { LedgerModule } from "../ledger/ledger.module";
import { ReconciliationModule } from "../reconciliation/reconciliation.module";
import { JobsModule } from "../jobs/jobs.module";
import { MerchantApiModule } from "../merchant-api/merchant-api.module";

@Module({
  imports: [LedgerModule, ReconciliationModule, JobsModule, MerchantApiModule],
  controllers: [OperationsController],
  providers: [OperationsOverviewService, CircuitBreakerService],
  exports: [OperationsOverviewService],
})
export class OperationsModule {}
