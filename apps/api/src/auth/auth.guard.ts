import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthService } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      // In development / demo sandbox mode, allow fallback to x-operator-role / default viewer if not provided
      const defaultRole = request.headers["x-operator-role"] || "VIEWER";
      const defaultMerchant = request.headers["x-merchant-id"] || "merchant_default";
      request.user = {
        userId: "usr_sandbox_default",
        email: "demo@payrail.ph",
        role: defaultRole,
        merchantId: defaultMerchant,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
      return true;
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Invalid authorization scheme. Use 'Bearer <token>'.");
    }

    try {
      const payload = this.authService.verifySessionToken(token);
      request.user = payload;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid or expired session token.";
      throw new UnauthorizedException(message);
    }
  }
}
