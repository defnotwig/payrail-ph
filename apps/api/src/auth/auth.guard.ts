import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService, type SessionPayload } from "./auth.service";
import { MerchantKeysService } from "../merchant-api/merchant-keys.service";
import { ALLOW_API_KEY, PUBLIC_ROUTE, PERMISSIONS } from "./authorization";
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(MerchantKeysService) private readonly keys: MerchantKeysService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets)) return true;
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    const apiKey = request.headers["x-api-key"];
    const merchant = request.headers["x-merchant-id"];
    if (
      merchant !== undefined &&
      (typeof merchant !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(merchant))
    )
      throw new ForbiddenException("Invalid merchant selector.");
    if (
      typeof apiKey === "string" &&
      !authorization &&
      this.reflector.getAllAndOverride<boolean>(ALLOW_API_KEY, targets)
    ) {
      const key = await this.keys.validateApiKey(apiKey);
      if (merchant && merchant !== key.merchantId)
        throw new ForbiddenException("Merchant does not match API key.");
      request.user = {
        userId: key.id,
        email: "",
        merchantId: key.merchantId,
        role: "VIEWER",
        permissions: key.scopes,
        actorType: "API_KEY",
      } satisfies SessionPayload;
    } else {
      if (apiKey || typeof authorization !== "string" || !/^Bearer [^\s]+$/.test(authorization))
        throw new UnauthorizedException("A valid Bearer operator token is required.");
      request.user = await this.auth.verifyAccessToken(authorization.slice(7), merchant);
    }
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS, targets);
    if (!required?.every((permission) => request.user.permissions.includes(permission)))
      throw new ForbiddenException("This operation is not permitted.");
    return true;
  }
}
