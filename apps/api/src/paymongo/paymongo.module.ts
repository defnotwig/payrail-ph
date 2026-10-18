import { Module } from "@nestjs/common";
import { PayMongoAdapter } from "./paymongo.adapter";

@Module({
  providers: [PayMongoAdapter],
  exports: [PayMongoAdapter],
})
export class PayMongoModule {}
