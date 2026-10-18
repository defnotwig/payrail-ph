import { beforeAll, describe, expect, it } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { DatabasePool } from "../database/database.pool";
import { AuthService } from "./auth.service";

const subject = "b1111111-1111-4111-8111-111111111111";
const membership = {
  merchant_id: "merchant_a",
  role: "VIEWER" as const,
  permissions: ["payments:read"],
};
let auth: AuthService;
let privateKey: CryptoKey;

async function token(
  overrides: Record<string, unknown> = {},
  issuer = "https://identity.example.test/auth/v1",
  audience: string | string[] = "authenticated",
) {
  return new SignJWT({
    email: "operator@example.test",
    role: "authenticated",
    session_id: subject,
    ...overrides,
  })
    .setProtectedHeader({ alg: "ES256", kid: "fixture" })
    .setSubject(subject)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("Supabase operator identity and database authorization", () => {
  beforeAll(async () => {
    process.env.SUPABASE_URL = "https://identity.example.test";
    const pair = await generateKeyPair("ES256");
    privateKey = pair.privateKey;
    const jwk = await exportJWK(pair.publicKey);
    jwk.kid = "fixture";
    jwk.alg = "ES256";
    const pool = {
      query: async (_sql: string, values: unknown[]) => ({
        rows: values[1] === "merchant_b" ? [] : [membership],
      }),
    } as unknown as DatabasePool;
    auth = new AuthService(pool, createLocalJWKSet({ keys: [jwk] }));
  });

  it("verifies the signed token and resolves role, permissions, and merchant from PostgreSQL", async () => {
    const result = await auth.verifyAccessToken(
      await token({ user_metadata: { role: "ADMIN", merchantId: "merchant_b" } }),
    );
    expect(result).toEqual({
      userId: subject,
      email: "operator@example.test",
      merchantId: "merchant_a",
      role: "VIEWER",
      permissions: ["payments:read"],
      actorType: "OPERATOR",
    });
  });

  it("uses x-merchant-id only to select an existing membership", async () => {
    await expect(auth.verifyAccessToken(await token(), "merchant_b")).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("rejects wrong issuer, audience, signature, expiry, and missing identity claims", async () => {
    const good = await token();
    for (const bad of [
      await token({}, "https://attacker.example/auth/v1"),
      await token({}, "https://identity.example.test/auth/v1", "service_role"),
      await token({ session_id: undefined }),
      `${good.slice(0, -8)}AAAAAAAA`,
      await new SignJWT({
        email: "operator@example.test",
        role: "authenticated",
        session_id: subject,
      })
        .setProtectedHeader({ alg: "ES256", kid: "fixture" })
        .setSubject(subject)
        .setIssuer("https://identity.example.test/auth/v1")
        .setAudience("authenticated")
        .setIssuedAt()
        .setExpirationTime("-1s")
        .sign(privateKey),
    ]) {
      await expect(auth.verifyAccessToken(bad)).rejects.toThrow(UnauthorizedException);
    }
  });

  it("rejects when no current active membership resolves", async () => {
    const noMembership = new AuthService(
      { query: async () => ({ rows: [] }) } as unknown as DatabasePool,
      createLocalJWKSet({ keys: [await exportJWK((await generateKeyPair("ES256")).publicKey)] }),
    );
    // A valid token must use the matching verification key; database misses remain an authorization denial.
    const pair = await generateKeyPair("ES256");
    const jwk = await exportJWK(pair.publicKey);
    jwk.kid = "fixture";
    jwk.alg = "ES256";
    const verifiedService = new AuthService(
      { query: async () => ({ rows: [] }) } as unknown as DatabasePool,
      createLocalJWKSet({ keys: [jwk] }),
    );
    const identityToken = await new SignJWT({
      email: "operator@example.test",
      role: "authenticated",
      session_id: subject,
    })
      .setProtectedHeader({ alg: "ES256", kid: "fixture" })
      .setSubject(subject)
      .setIssuer("https://identity.example.test/auth/v1")
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(pair.privateKey);
    await expect(verifiedService.verifyAccessToken(identityToken)).rejects.toThrow(
      ForbiddenException,
    );
    expect(noMembership).toBeTruthy();
  });
});
