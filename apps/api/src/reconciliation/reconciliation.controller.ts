import { Controller, Get, Post, Param, Query, Inject, Req } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { ReconciliationService } from "./reconciliation.service";
import { Permissions, type OperatorRequest } from "../auth/authorization";
import { identifier, pageLimit, parseInput } from "../auth/validation";
@Controller("reconciliation")
@ApiBearerAuth()
export class ReconciliationController {
  constructor(
    @Inject(ReconciliationService) private readonly reconciliation: ReconciliationService,
  ) {}
  @Get("runs")
  @Permissions("reconciliation:read")
  async getRuns(@Req() request: OperatorRequest, @Query("limit") limit?: string) {
    return {
      data: await this.reconciliation.getRuns(request.user.merchantId, pageLimit(limit, 50)),
    };
  }
  @Get("runs/:id/items")
  @Permissions("reconciliation:read")
  async getRunItems(@Param("id") id: string) {
    return { data: await this.reconciliation.getItems(parseInput(identifier, id)) };
  }
  @Post("runs")
  @Permissions("reconciliation:write")
  async startRun(@Req() request: OperatorRequest) {
    return { data: await this.reconciliation.runReconciliation(request.user.merchantId) };
  }
}
