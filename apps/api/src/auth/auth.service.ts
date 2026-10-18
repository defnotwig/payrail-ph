import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import type { UserRole } from "./roles.decorator";
export const AUTH_JWKS = Symbol("AUTH_JWKS");
export interface SessionPayload {
  userId: string;
  email: string;
  merchantId: string;
  role: UserRole;
  permissions: string[];
  actorType: "OPERATOR" | "API_KEY";
}
const identitySchema = z.object({
  sub: z.uuid(),
  email: z.email(),
  role: z.literal("authenticated"),
  session_id: z.uuid(),
});
export function createAuthKeyResolver(): JWTVerifyGetKey {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is required to configure operator identity.");
  return createRemoteJWKSet(new URL(`${url.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`), {
    timeoutDuration: 3000,
    cacheMaxAge: 600_000,
    cooldownDuration: 30_000,
  });
}
@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private readonly pool: DatabasePool,
    @Inject(AUTH_JWKS) private readonly keys: JWTVerifyGetKey,
  ) {}
  async verifyAccessToken(token: string, selectedMerchant?: string): Promise<SessionPayload> {
    let identity: z.infer<typeof identitySchema>;
    try {
      const url = process.env.SUPABASE_URL;
      if (!url) throw new Error("Identity unavailable");
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: `${url.replace(/\/$/, "")}/auth/v1`,
        audience: "authenticated",
        algorithms: ["ES256", "RS256"],
        requiredClaims: ["exp", "iat", "sub", "session_id", "role"],
        clockTolerance: 0,
      });
      identity = identitySchema.parse(payload);
    } catch {
      throw new UnauthorizedException("Invalid or expired operator access token.");
    }
    // JWT identity is distinct from authorization, read from current private database rows.
    const result = await this.pool.query<{
      merchant_id: string;
      role: UserRole;
      permissions: string[];
    }>(
      `SELECT m.merchant_id, m.role, COALESCE(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}') AS permissions
       FROM payrail_private.operator_memberships m
       JOIN payrail_private.operators o ON o.id = m.operator_id AND o.is_active = true
       LEFT JOIN payrail_private.role_permissions p ON p.role = m.role
       WHERE m.operator_id = $1 AND ($2::text IS NULL OR m.merchant_id = $2)
         AND m.environment = $3 AND m.is_active = true
       GROUP BY m.merchant_id, m.role`,
      [identity.sub, selectedMerchant || null, process.env.APP_ENV || "local"],
    );
    const membership = result.rows[0];
    if (!membership || result.rows.length !== 1)
      throw new ForbiddenException("An active, unambiguous merchant membership is required.");
    return {
      userId: identity.sub,
      email: identity.email,
      merchantId: membership.merchant_id,
      role: membership.role,
      permissions: membership.permissions,
      actorType: "OPERATOR",
    };
  }
}
