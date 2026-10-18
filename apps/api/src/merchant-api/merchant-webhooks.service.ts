import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import * as crypto from "node:crypto";
import { URL } from "node:url";

export interface RegisterWebhookEndpointDto {
  merchantId: string;
  url: string;
  subscribedEvents: string[];
}

export interface WebhookEndpointRecord {
  id: string;
  merchantId: string;
  url: string;
  secretKey: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "DELIVERED" | "RETRYING" | "FAILED" | "DEAD_LETTER";
  statusCode?: number | undefined;
  responseBody?: string | undefined;
  attemptCount: number;
  nextAttemptAt?: string | undefined;
  createdAt: string;
}

@Injectable()
export class MerchantWebhooksService {
  constructor(@Inject(PG_POOL) private readonly pool: DatabasePool) {}

  /**
   * Validates URLs against Server-Side Request Forgery (SSRF) vulnerabilities.
   * Blocks:
   * - Localhost & loopbacks: 127.0.0.1, localhost, [::1], 0.0.0.0
   * - AWS/GCP/Azure instance metadata: 169.254.169.254, metadata.google.internal
   * - Private RFC 1918 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) in production
   * - Non-HTTP/HTTPS protocols (e.g. file://, gopher://, ftp://)
   */
  validateDestinationUrl(targetUrl: string, allowLocalForTesting = false): void {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      throw new BadRequestException("Invalid webhook destination URL.");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new BadRequestException(
        `Forbidden protocol: ${parsed.protocol}. Only HTTPS/HTTP allowed.`,
      );
    }

    const host = parsed.hostname.toLowerCase();

    // Check Cloud Metadata IP
    if (host === "169.254.169.254" || host.includes("metadata.google.internal")) {
      throw new BadRequestException(
        "Forbidden destination: Cloud instance metadata endpoint blocked.",
      );
    }

    if (!allowLocalForTesting) {
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "0.0.0.0" ||
        host === "::1" ||
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      ) {
        throw new BadRequestException(
          "Forbidden destination: Loopback, localhost, and RFC 1918 private subnets are blocked.",
        );
      }
    }
  }

  /**
   * Registers a new merchant webhook destination with a unique HMAC signing secret.
   */
  async registerEndpoint(
    dto: RegisterWebhookEndpointDto,
    allowLocal = false,
  ): Promise<WebhookEndpointRecord> {
    this.validateDestinationUrl(dto.url, allowLocal);

    if (!dto.subscribedEvents || dto.subscribedEvents.length === 0) {
      throw new BadRequestException("Must subscribe to at least one event type.");
    }

    const secretKey = `whsec_${crypto.randomBytes(24).toString("hex")}`;

    const res = await this.pool.query<{
      id: string;
      merchant_id: string;
      url: string;
      secret_key: string;
      subscribed_events: string[];
      is_active: boolean;
      created_at: Date;
    }>(
      `INSERT INTO payrail_private.merchant_webhook_endpoints
         (merchant_id, url, secret_key, subscribed_events)
       VALUES ($1, $2, $3, $4)
       RETURNING id, merchant_id, url, secret_key, subscribed_events, is_active, created_at`,
      [dto.merchantId, dto.url, secretKey, dto.subscribedEvents],
    );

    const r = res.rows[0];
    if (!r) {
      throw new NotFoundException("Failed to register webhook endpoint.");
    }
    return {
      id: r.id,
      merchantId: r.merchant_id,
      url: r.url,
      secretKey: r.secret_key,
      subscribedEvents: r.subscribed_events,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
    };
  }

  /**
   * Signs an outbound payload using HMAC-SHA256 according to PayRail's webhook contract.
   * Format: payrail-signature: t=<timestamp>,v1=<hmac_hex>
   */
  signPayload(payloadString: string, secretKey: string, timestamp?: number): string {
    const t = timestamp || Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(`${t}.${payloadString}`)
      .digest("hex");

    return `t=${t},v1=${signature}`;
  }

  /**
   * Records a webhook delivery attempt in the delivery log.
   */
  async recordDelivery(
    endpointId: string,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    status: "PENDING" | "DELIVERED" | "RETRYING" | "FAILED" | "DEAD_LETTER",
    statusCode?: number,
    responseBody?: string,
  ): Promise<string> {
    const res = await this.pool.query<{ id: string }>(
      `INSERT INTO payrail_private.merchant_webhook_deliveries
         (endpoint_id, event_id, event_type, payload, status, status_code, response_body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        endpointId,
        eventId,
        eventType,
        JSON.stringify(payload),
        status,
        statusCode || null,
        responseBody || null,
      ],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert delivery attempt");
    }
    return row.id;
  }

  /**
   * Lists endpoints registered for a merchant.
   */
  async listEndpoints(merchantId: string): Promise<WebhookEndpointRecord[]> {
    const res = await this.pool.query<{
      id: string;
      merchant_id: string;
      url: string;
      secret_key: string;
      subscribed_events: string[];
      is_active: boolean;
      created_at: Date;
    }>(
      `SELECT * FROM payrail_private.merchant_webhook_endpoints
       WHERE merchant_id = $1
       ORDER BY created_at DESC`,
      [merchantId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      merchantId: r.merchant_id,
      url: r.url,
      secretKey: r.secret_key,
      subscribedEvents: r.subscribed_events,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
    }));
  }

  /**
   * Lists recent webhook deliveries for operations inspection.
   */
  async getDeliveries(endpointId?: string, limit = 50): Promise<WebhookDeliveryRecord[]> {
    let query = `SELECT * FROM payrail_private.merchant_webhook_deliveries`;
    const params: unknown[] = [];

    if (endpointId) {
      query += ` WHERE endpoint_id = $1`;
      params.push(endpointId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await this.pool.query<{
      id: string;
      endpoint_id: string;
      event_id: string;
      event_type: string;
      payload: Record<string, unknown>;
      status: "PENDING" | "DELIVERED" | "RETRYING" | "FAILED" | "DEAD_LETTER";
      status_code: number | null;
      response_body: string | null;
      attempt_count: number;
      next_attempt_at: Date | null;
      created_at: Date;
    }>(query, params);

    return res.rows.map((r) => ({
      id: r.id,
      endpointId: r.endpoint_id,
      eventId: r.event_id,
      eventType: r.event_type,
      payload: r.payload,
      status: r.status,
      statusCode: r.status_code || undefined,
      responseBody: r.response_body || undefined,
      attemptCount: r.attempt_count,
      nextAttemptAt: r.next_attempt_at?.toISOString(),
      createdAt: r.created_at.toISOString(),
    }));
  }
}
