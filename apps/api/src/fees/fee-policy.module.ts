import { Module } from "@nestjs/common";
import { FeePolicyService } from "./fee-policy.service";

@Module({
  providers: [FeePolicyService],
  exports: [FeePolicyService],
})
export class FeePolicyModule {}
