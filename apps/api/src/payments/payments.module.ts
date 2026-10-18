import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PayMongoModule } from "../paymongo/paymongo.module";
import { LedgerModule } from "../ledger/ledger.module";

@Module({
  imports: [PayMongoModule, LedgerModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
