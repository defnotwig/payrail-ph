import { Controller, Get, Post, Param, Inject, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiSecurity } from "@nestjs/swagger";
import { OperationsOverviewService } from "./operations-overview.service";
import { AllowApiKey, Permissions, type OperatorRequest } from "../auth/authorization";

@Controller("ops")
@ApiBearerAuth()
@ApiSecurity("merchantKey")
@AllowApiKey()
export class OperationsController {
  constructor(
    @Inject(OperationsOverviewService)
    private readonly overviewService: OperationsOverviewService,
  ) {}

  @Get("overview")
  @Permissions("payments:read")
  async getOverview(
    @Req() request: OperatorRequest,
    @Query("period") period?: "today" | "7d" | "30d" | "all",
  ) {
    const sanitizedPeriod: "today" | "7d" | "30d" | "all" =
      period === "7d" || period === "30d" || period === "all" ? period : "today";
    const data = await this.overviewService.getOverview(request.user.merchantId, {
      period: sanitizedPeriod,
    });
    return { data };
  }

  @Get("health")
  @Permissions("payments:read")
  async getHealth() {
    return { data: await this.overviewService.getSystemHealth() };
  }

  @Get("ledger")
  @Permissions("payments:read")
  async getLedger(@Req() request: OperatorRequest) {
    return { data: await this.overviewService.getLedgerOverview(request.user.merchantId) };
  }

  @Get("reconciliation")
  @Permissions("payments:read")
  async getReconciliation(@Req() request: OperatorRequest) {
    return { data: await this.overviewService.getReconciliationOverview(request.user.merchantId) };
  }

  @Post("reconciliation/run")
  @Permissions("payments:write")
  async runReconciliation(@Req() request: OperatorRequest) {
    return { data: await this.overviewService.runReconciliation(request.user.merchantId) };
  }

  @Get("jobs")
  @Permissions("payments:read")
  async getJobs() {
    return { data: await this.overviewService.getJobsOverview() };
  }

  @Post("jobs/dlq/:id/replay")
  @Permissions("payments:write")
  async replayDeadLetter(@Req() request: OperatorRequest, @Param("id") id: string) {
    const newJobId = await this.overviewService.replayDeadLetter(id, request.user.userId);
    return { message: "Dead letter replayed", data: { originalDlqId: id, newJobId } };
  }

  @Get("developer")
  @Permissions("payments:read")
  async getDeveloper(@Req() request: OperatorRequest) {
    return { data: await this.overviewService.getDeveloperOverview(request.user.merchantId) };
  }
}
