import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { Iso8583Service } from "./iso8583.service";
import { Public } from "../auth/authorization";

@Controller("v1/iso8583")
@Public()
export class Iso8583Controller {
  constructor(@Inject(Iso8583Service) private readonly isoService: Iso8583Service) {}

  @Post("pack")
  packMessage(@Body() body: { mti: string; fields: Record<number, string> }) {
    return this.isoService.pack(body.mti, body.fields);
  }

  @Post("unpack")
  unpackMessage(@Body() body: { rawString: string }) {
    return this.isoService.unpack(body.rawString);
  }

  @Get("sample-0200")
  getSamplePurchase(
    @Query("amountMinor") amountMinor = "50000",
    @Query("stan") stan = "123456",
    @Query("terminalId") terminalId = "TERM0001",
    @Query("reference") reference = "PAYRAILTEST1",
  ) {
    return this.isoService.createSamplePurchase0200(
      parseInt(amountMinor, 10),
      stan,
      terminalId,
      reference,
    );
  }
}
