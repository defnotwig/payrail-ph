import { Module } from "@nestjs/common";
import { CardsService } from "./cards.service";
import { CardsController } from "./cards.controller";
import { CircuitBreakerService } from "../providers/circuit-breaker.service";
import { LedgerModule } from "../ledger/ledger.module";

@Module({
  imports: [LedgerModule],
  controllers: [CardsController],
  providers: [CardsService, CircuitBreakerService],
  exports: [CardsService, CircuitBreakerService],
})
export class CardsModule {}
