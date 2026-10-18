import { Controller, Get, Query, Headers } from "@nestjs/common";
import type { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("events")
  async getEvents(@Headers("x-merchant-id") merchantId?: string, @Query("limit") limit = "50") {
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
    const events = await this.auditService.getEvents(merchantId, parsedLimit);
    return { data: events };
  }
}
