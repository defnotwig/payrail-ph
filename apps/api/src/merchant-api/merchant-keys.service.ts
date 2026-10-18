import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import * as crypto from "node:crypto";

export interface CreateApiKeyDto {
  merchantId: string;
  name: string;
  scopes?: string[] | undefined;
  environment?: "test" | undefined;
  keyType?: "secret" | undefined;
}

export interface ApiKeyCreatedResult {
  id: string;
  merchantId: string;
  name: string;
  keyPrefix: string;
  apiKey: string; // Plaintext returned only once
  scopes: string[];
  environment: string;
  createdAt: string;
}

export interface ApiKeyRecord {
  id: string;
  merchantId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  environment: string;
  createdAt: string;
  expiresAt?: string | undefined;
  revokedAt?: string | undefined;
}

@Injectable()
export class MerchantKeysService {
  constructor(@Inject(PG_POOL) private readonly pool: DatabasePool) {}

  /**
   * Generates a cryptographically secure, scoped merchant API key.
   * Format: [sk|pk]_[test|live]_[16 random hex]_[32 random hex secret]
   * Storage: Stores SHA-256 hash only; never stores plaintext API keys.
   */
  async createApiKey(dto: CreateApiKeyDto): Promise<ApiKeyCreatedResult> {
    if (
      (dto.environment && dto.environment !== "test") ||
      (dto.keyType && dto.keyType !== "secret")
    )
      throw new BadRequestException("Only secret test keys are supported.");
    const environment = dto.environment || "test";
    const typePrefix = "sk";
    const keyPrefix = `${typePrefix}_${environment}_`;
    const randomEntropy = crypto.randomBytes(24).toString("base64url");
    const fullApiKey = `${keyPrefix}${randomEntropy}`;

    // SHA-256 Digest for storage & lookups
    const keyHash = crypto.createHash("sha256").update(fullApiKey).digest("hex");
    const scopes = dto.scopes || ["payments:read"];
    if (
      !dto.name ||
      dto.name.length > 100 ||
      scopes.length === 0 ||
      scopes.some(
        (scope) =>
          !["payments:read", "payments:write", "refunds:read", "refunds:write"].includes(scope),
      )
    )
      throw new BadRequestException("Invalid key name or scopes.");

    const res = await this.pool.query<{
      id: string;
      merchant_id: string;
      key_prefix: string;
      name: string;
      scopes: string[];
      environment: string;
      created_at: Date;
    }>(
      `INSERT INTO payrail_private.merchant_api_keys
         (merchant_id, key_prefix, key_hash, name, scopes, environment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, merchant_id, key_prefix, name, scopes, environment, created_at`,
      [dto.merchantId, keyPrefix, keyHash, dto.name, scopes, environment],
    );

    const r = res.rows[0];
    if (!r) {
      throw new NotFoundException("Failed to create API key record.");
    }
    return {
      id: r.id,
      merchantId: r.merchant_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      apiKey: fullApiKey, // Returned once
      scopes: r.scopes,
      environment: r.environment,
      createdAt: r.created_at.toISOString(),
    };
  }

  /**
   * Validates a high-entropy API key by looking up its SHA-256 digest among active keys.
   */
  async validateApiKey(apiKey: string): Promise<{
    id: string;
    merchantId: string;
    scopes: string[];
    environment: string;
  }> {
    if (!apiKey || typeof apiKey !== "string" || !/^sk_test_[a-zA-Z0-9_-]{16,64}$/.test(apiKey)) {
      throw new UnauthorizedException("Missing or invalid API key.");
    }

    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const res = await this.pool.query<{
      id: string;
      merchant_id: string;
      scopes: string[];
      environment: string;
    }>(
      `SELECT id, merchant_id, scopes, environment
       FROM payrail_private.merchant_api_keys
       WHERE key_hash = $1
         AND environment = 'test' AND key_prefix = 'sk_test_'
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > clock_timestamp())`,
      [keyHash],
    );

    const r = res.rows[0];
    if (
      r?.environment !== "test" ||
      r.scopes.some(
        (scope) =>
          !["payments:read", "payments:write", "refunds:read", "refunds:write"].includes(scope),
      )
    ) {
      throw new UnauthorizedException("Invalid, expired, or revoked API key.");
    }
    return {
      id: r.id,
      merchantId: r.merchant_id,
      scopes: r.scopes,
      environment: r.environment,
    };
  }

  /**
   * Revokes an existing merchant API key immediately.
   */
  async revokeApiKey(merchantId: string, keyId: string): Promise<void> {
    const res = await this.pool.query(
      `UPDATE payrail_private.merchant_api_keys
       SET revoked_at = clock_timestamp()
       WHERE id = $1 AND merchant_id = $2 AND revoked_at IS NULL`,
      [keyId, merchantId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException(`API key '${keyId}' not found or already revoked.`);
    }
  }

  /**
   * Lists all API keys for a merchant (omitting hash).
   */
  async listApiKeys(merchantId: string): Promise<ApiKeyRecord[]> {
    const res = await this.pool.query<{
      id: string;
      merchant_id: string;
      key_prefix: string;
      name: string;
      scopes: string[];
      environment: string;
      created_at: Date;
      expires_at: Date | null;
      revoked_at: Date | null;
    }>(
      `SELECT id, merchant_id, key_prefix, name, scopes, environment, created_at, expires_at, revoked_at
       FROM payrail_private.merchant_api_keys
       WHERE merchant_id = $1
       ORDER BY created_at DESC`,
      [merchantId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      merchantId: r.merchant_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      scopes: r.scopes,
      environment: r.environment,
      createdAt: r.created_at.toISOString(),
      expiresAt: r.expires_at?.toISOString(),
      revokedAt: r.revoked_at?.toISOString(),
    }));
  }
}
