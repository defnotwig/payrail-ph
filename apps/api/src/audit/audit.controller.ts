import { Controller, Get, Query, Inject, Req } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { AuditService } from "./audit.service";
import { Permissions, type OperatorRequest } from "../auth/authorization";
import { pageLimit } from "../auth/validation";
@Controller("audit")
@ApiBearerAuth()
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}
  @Get("events")
  @Permissions("audit:read")
  async getEvents(@Req() request: OperatorRequest, @Query("limit") limit?: string) {
    return { data: await this.audit.getEvents(request.user.merchantId, pageLimit(limit)) };
  }
}
