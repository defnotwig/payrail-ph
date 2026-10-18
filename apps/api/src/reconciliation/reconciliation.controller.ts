import { Controller, Get, Post, Param, Query, Headers } from "@nestjs/common";
import type { ReconciliationService } from "./reconciliation.service";

@Controller("reconciliation")
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get("runs")
  async getRuns(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Query("limit") limit = "20",
  ) {
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);
    const runs = await this.reconciliationService.getRuns(merchantId, parsedLimit);
    return { data: runs };
  }

  @Get("runs/:id/items")
  async getRunItems(@Param("id") runId: string) {
    const items = await this.reconciliationService.getItems(runId);
    return { data: items };
  }

  @Post("runs")
  async startRun(@Headers("x-merchant-id") merchantId = "merchant_default") {
    const run = await this.reconciliationService.runReconciliation(merchantId);
    return {
      message: "Reconciliation run completed successfully.",
      data: run,
    };
  }
}
