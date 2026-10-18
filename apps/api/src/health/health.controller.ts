import { Controller, Get, HttpException, Inject } from "@nestjs/common";
import { HealthService } from "./health.service";
import { Public } from "../auth/authorization";

@Controller("health")
@Public()
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get("live")
  live() {
    return { status: "ok" } as const;
  }

  @Get("ready")
  async ready() {
    if (!(await this.healthService.isReady())) {
      throw new HttpException({ status: "unavailable" }, 503);
    }

    return { status: "ready" } as const;
  }
}
