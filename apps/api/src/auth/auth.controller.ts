import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthService, SessionPayload } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import type { UserRole } from "./roles.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: { email: string; role?: UserRole }) {
    const result = this.authService.authenticateDevUser(body.email, body.role);
    return { data: result };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async getMe(@Req() req: { user?: SessionPayload }) {
    return { data: req.user };
  }
}
