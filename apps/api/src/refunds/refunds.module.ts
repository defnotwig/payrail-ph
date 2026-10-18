import { Module } from "@nestjs/common";
import { RefundsService } from "./refunds.service";
import { RefundsController } from "./refunds.controller";
import { LedgerModule } from "../ledger/ledger.module";
import { PayMongoModule } from "../paymongo/paymongo.module";

@Module({
  imports: [LedgerModule, PayMongoModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
