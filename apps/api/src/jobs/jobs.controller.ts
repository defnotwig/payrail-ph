import { Controller, Get, Post, Param, Query, Inject, Req } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { DurableJobsService } from "./durable-jobs.service";
import { OutboxService } from "./outbox.service";
import { Permissions, type OperatorRequest } from "../auth/authorization";
import { identifier, pageLimit, parseInput } from "../auth/validation";
@Controller("jobs")
@ApiBearerAuth()
export class JobsController {
  constructor(
    @Inject(DurableJobsService) private readonly jobs: DurableJobsService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}
  @Get("dlq")
  @Permissions("jobs:read")
  async getDeadLetters(@Req() _request: OperatorRequest, @Query("limit") limit?: string) {
    return { data: await this.jobs.getDeadLetters(pageLimit(limit)) };
  }
  @Post("dlq/:id/replay")
  @Permissions("jobs:replay")
  async replayDeadLetter(@Param("id") id: string, @Req() request: OperatorRequest) {
    const newJobId = await this.jobs.replayDeadLetter(
      parseInput(identifier, id),
      request.user.userId,
    );
    return { message: "Dead letter replayed.", data: { originalDlqId: id, newJobId } };
  }
  @Get("outbox/unpublished")
  @Permissions("jobs:read")
  async getUnpublishedOutbox(@Req() _request: OperatorRequest, @Query("limit") limit?: string) {
    return { data: await this.outbox.fetchUnpublished(pageLimit(limit, 50)) };
  }
}
