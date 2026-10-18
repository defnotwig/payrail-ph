import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as crypto from "node:crypto";
import type { UserRole } from "./roles.decorator";

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  merchantId: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly secretKey = process.env.INTERNAL_SERVICE_SECRET || "dev_internal_secret";

  /**
   * Generates a signed, tamper-resistant HMAC-SHA256 operator session token.
   */
  generateSessionToken(
    userId: string,
    email: string,
    role: UserRole,
    merchantId = "merchant_default",
    expiresInHours = 24,
  ): string {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + expiresInHours * 3600;

    const payload: SessionPayload = {
      userId,
      email,
      role,
      merchantId,
      iat,
      exp,
    };

    const serializedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(serializedPayload)
      .digest("base64url");

    return `${serializedPayload}.${signature}`;
  }

  /**
   * Verifies and decodes an HMAC-SHA256 operator session token.
   * Uses constant-time comparison to prevent timing side-channel attacks.
   */
  verifySessionToken(token: string): SessionPayload {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new UnauthorizedException("Malformed session token.");
    }

    const serializedPayload = parts[0];
    const signature = parts[1];
    const expectedSignature = crypto
      .createHmac("sha256", this.secretKey)
      .update(serializedPayload)
      .digest("base64url");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const actualBuffer = Buffer.from(signature, "utf8");

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new UnauthorizedException("Invalid token signature.");
    }

    try {
      const payload: SessionPayload = JSON.parse(
        Buffer.from(serializedPayload, "base64url").toString("utf8"),
      );

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new UnauthorizedException("Session token has expired.");
      }

      return payload;
    } catch {
      throw new UnauthorizedException("Corrupt session payload.");
    }
  }

  /**
   * Authenticates standard development/demo operator credentials.
   */
  authenticateDevUser(
    email: string,
    requestedRole?: UserRole,
  ): { token: string; user: SessionPayload } {
    let role: UserRole = requestedRole || "VIEWER";

    if (email.includes("admin")) role = "ADMIN";
    else if (email.includes("finance")) role = "FINANCE";
    else if (email.includes("engineer")) role = "ENGINEER";
    else if (email.includes("support")) role = "SUPPORT";

    const userId = `usr_${crypto.createHash("sha256").update(email).digest("hex").slice(0, 12)}`;
    const token = this.generateSessionToken(userId, email, role);
    const user = this.verifySessionToken(token);

    return { token, user };
  }
}
