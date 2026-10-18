import { Module } from "@nestjs/common";
import { Iso8583Service } from "./iso8583.service";
import { Iso8583Controller } from "./iso8583.controller";

@Module({
  controllers: [Iso8583Controller],
  providers: [Iso8583Service],
  exports: [Iso8583Service],
})
export class Iso8583Module {}
