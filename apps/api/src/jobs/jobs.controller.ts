import { Controller, Get, Post, Param, Query, Headers } from "@nestjs/common";
import type { DurableJobsService } from "./durable-jobs.service";
import type { OutboxService } from "./outbox.service";

@Controller("jobs")
export class JobsController {
  constructor(
    private readonly durableJobsService: DurableJobsService,
    private readonly outboxService: OutboxService,
  ) {}

  @Get("dlq")
  async getDeadLetters(@Query("limit") limit = "50") {
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
    const deadLetters = await this.durableJobsService.getDeadLetters(parsedLimit);
    return { data: deadLetters };
  }

  @Post("dlq/:id/replay")
  async replayDeadLetter(
    @Param("id") id: string,
    @Headers("x-operator-id") operatorId = "operator_default",
  ) {
    const newJobId = await this.durableJobsService.replayDeadLetter(id, operatorId);
    return {
      message: "Dead letter replayed successfully.",
      data: { originalDlqId: id, newJobId },
    };
  }

  @Get("outbox/unpublished")
  async getUnpublishedOutbox(@Query("limit") limit = "20") {
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);
    const events = await this.outboxService.fetchUnpublished(parsedLimit);
    return { data: events };
  }
}
