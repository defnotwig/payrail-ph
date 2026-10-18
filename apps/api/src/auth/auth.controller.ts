import { Controller, Get, Req } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Permissions, type OperatorRequest } from "./authorization";
@Controller("auth")
@ApiBearerAuth()
export class AuthController {
  @Get("me")
  @Permissions()
  getMe(@Req() request: OperatorRequest) {
    return { data: request.user };
  }
}
