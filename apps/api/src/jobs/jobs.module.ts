import { Module } from "@nestjs/common";
import { DurableJobsService } from "./durable-jobs.service";
import { OutboxService } from "./outbox.service";
import { JobsController } from "./jobs.controller";

@Module({
  controllers: [JobsController],
  providers: [DurableJobsService, OutboxService],
  exports: [DurableJobsService, OutboxService],
})
export class JobsModule {}
