import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthService } from "./auth.service";
import { RolesGuard } from "./roles.guard";
import { UnauthorizedException, ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

describe("AuthService & RBAC", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe("Token Generation & Verification", () => {
    it("generates and verifies a tamper-resistant session token", () => {
      const token = authService.generateSessionToken(
        "usr_123",
        "finance@payrail.ph",
        "FINANCE",
        "merchant_default",
      );

      const payload = authService.verifySessionToken(token);
      expect(payload.userId).toBe("usr_123");
      expect(payload.email).toBe("finance@payrail.ph");
      expect(payload.role).toBe("FINANCE");
      expect(payload.merchantId).toBe("merchant_default");
    });

    it("rejects token with tampered payload", () => {
      const token = authService.generateSessionToken("usr_123", "viewer@payrail.ph", "VIEWER");

      const [serialized, signature] = token.split(".");
      if (!serialized || !signature) {
        throw new Error("Expected token to have serialized and signature parts");
      }
      // Tamper with payload to elevate role to ADMIN
      const tamperedObj = JSON.parse(Buffer.from(serialized, "base64url").toString());
      tamperedObj.role = "ADMIN";
      const tamperedSerialized = Buffer.from(JSON.stringify(tamperedObj)).toString("base64url");
      const tamperedToken = `${tamperedSerialized}.${signature}`;

      expect(() => authService.verifySessionToken(tamperedToken)).toThrow(UnauthorizedException);
    });

    it("rejects expired token", () => {
      // Token expired 1 hour ago
      const token = authService.generateSessionToken(
        "usr_123",
        "test@payrail.ph",
        "VIEWER",
        "merchant_default",
        -1, // -1 hour duration
      );

      expect(() => authService.verifySessionToken(token)).toThrow(UnauthorizedException);
    });

    it("rejects malformed token strings", () => {
      expect(() => authService.verifySessionToken("invalid-token-without-dot")).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("RolesGuard Authorization", () => {
    let reflector: Reflector;
    let rolesGuard: RolesGuard;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    it("permits user possessing required role", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["FINANCE", "ADMIN"]);
      const mockContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: "FINANCE" } }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it("permits ADMIN user even if specific role is FINANCE", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["FINANCE"]);
      const mockContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: "ADMIN" } }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it("throws ForbiddenException if user lacks required role", () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["FINANCE"]);
      const mockContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: "VIEWER" } }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
