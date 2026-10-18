import { Module, Global } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthService, AUTH_JWKS, createAuthKeyResolver } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";
import { MerchantApiModule } from "../merchant-api/merchant-api.module";
@Global()
@Module({
  imports: [MerchantApiModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_JWKS, useFactory: createAuthKeyResolver },
    AuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
