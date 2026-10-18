import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
export interface RegisterWebhookEndpointDto {
  merchantId: string;
  url: string;
  subscribedEvents: string[];
}
export interface WebhookEndpointRecord {
  id: string;
  merchantId: string;
  url: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: string;
  secretKey?: string;
}
interface EndpointRow {
  id: string;
  merchant_id: string;
  url: string;
  subscribed_events: string[];
  is_active: boolean;
  created_at: Date;
  encrypted_secret?: string;
  secret_version?: string;
}
const events = ["payment.succeeded", "payment.failed", "refund.succeeded", "refund.failed"];
@Injectable()
export class MerchantWebhooksService {
  constructor(@Inject(PG_POOL) private readonly pool: DatabasePool) {}
  validateDestinationUrl(targetUrl: string): URL {
    let url: URL;
    try {
      url = new URL(targetUrl);
    } catch {
      throw new BadRequestException("Invalid webhook URL.");
    }
    if (
      url.protocol !== "https:" ||
      (url.port && url.port !== "443") ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new BadRequestException(
        "Webhook requires HTTPS on port 443 without credentials or fragment.",
      );
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.includes("metadata.google.internal")
    )
      throw new BadRequestException("Private webhook destination is forbidden.");
    if (ipaddr.isValid(host)) this.assertPublicAddress(host);
    return url;
  }
  private assertPublicAddress(address: string): void {
    if (!ipaddr.isValid(address) || ipaddr.process(address).range() !== "unicast")
      throw new BadRequestException("Non-public webhook address is forbidden.");
  }
  async resolveDestination(
    targetUrl: string,
  ): Promise<{ url: URL; address: string; family: 4 | 6 }> {
    const url = this.validateDestinationUrl(targetUrl);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length) throw new BadRequestException("Webhook hostname has no addresses.");
    for (const item of addresses) this.assertPublicAddress(item.address);
    const first = addresses[0];
    if (!first || (first.family !== 4 && first.family !== 6))
      throw new BadRequestException("Invalid webhook address family.");
    return { url, address: first.address, family: first.family };
  }
  private encryptionKey(): Buffer {
    const value = process.env.WEBHOOK_ENCRYPTION_KEY;
    if (!value || !/^[a-fA-F0-9]{64}$/.test(value))
      throw new ServiceUnavailableException("Merchant webhook encryption is not configured.");
    return Buffer.from(value, "hex");
  }
  private encrypt(secret: string, merchantId: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from(`payrail:webhook:v1:${merchantId}`));
    const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((value) => value.toString("base64url")).join(".");
  }
  private decrypt(value: string, merchantId: string): string {
    const parts = value.split(".");
    if (parts.length !== 3 || parts.some((part) => !part))
      throw new ServiceUnavailableException("Webhook secret unavailable; rotate endpoint.");
    const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
    if (!iv || !tag || !data) throw new ServiceUnavailableException("Webhook secret unavailable.");
    const cipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from(`payrail:webhook:v1:${merchantId}`));
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
  }
  private record(row: EndpointRow): WebhookEndpointRecord {
    return {
      id: row.id,
      merchantId: row.merchant_id,
      url: row.url,
      subscribedEvents: row.subscribed_events,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
    };
  }
  async registerEndpoint(dto: RegisterWebhookEndpointDto): Promise<WebhookEndpointRecord> {
    await this.resolveDestination(dto.url);
    if (
      !dto.subscribedEvents.length ||
      dto.subscribedEvents.some((event) => !events.includes(event))
    )
      throw new BadRequestException("Unsupported webhook event.");
    const secretKey = `whsec_${randomBytes(24).toString("hex")}`;
    const encrypted = this.encrypt(secretKey, dto.merchantId);
    const result = await this.pool.query<EndpointRow>(
      `INSERT INTO payrail_private.merchant_webhook_endpoints (merchant_id, url, encrypted_secret, secret_version, subscribed_events)
       VALUES ($1, $2, $3, 'v1', $4)
       RETURNING id, merchant_id, url, subscribed_events, is_active, created_at`,
      [dto.merchantId, dto.url, encrypted, dto.subscribedEvents],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Webhook endpoint creation failed.");
    return { ...this.record(row), secretKey };
  }
  async listEndpoints(merchantId: string): Promise<WebhookEndpointRecord[]> {
    const result = await this.pool.query<EndpointRow>(
      `SELECT id, merchant_id, url, subscribed_events, is_active, created_at FROM payrail_private.merchant_webhook_endpoints WHERE merchant_id = $1 ORDER BY created_at DESC`,
      [merchantId],
    );
    return result.rows.map((row) => this.record(row));
  }
  async deactivateEndpoint(merchantId: string, id: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE payrail_private.merchant_webhook_endpoints SET is_active = false WHERE id = $1 AND merchant_id = $2`,
      [id, merchantId],
    );
    if (!result.rowCount) throw new NotFoundException("Webhook endpoint not found.");
  }
  signPayload(
    payload: string,
    secretKey: string,
    timestamp = Math.floor(Date.now() / 1000),
  ): string {
    return `t=${timestamp},v1=${createHmac("sha256", secretKey).update(`${timestamp}.${payload}`).digest("hex")}`;
  }
  async sendSigned(targetUrl: string, payload: string, signature: string): Promise<number> {
    if (Buffer.byteLength(payload) > 32768)
      throw new BadRequestException("Webhook payload too large.");
    const destination = await this.resolveDestination(targetUrl);
    // Resolve every retry and pin the verified IP into the actual connection. Redirects are never followed.
    return new Promise((resolve, reject) => {
      const outgoing = request(
        destination.url,
        {
          method: "POST",
          agent: false,
          lookup: (_hostname, _options, callback) =>
            callback(null, destination.address, destination.family),
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            "Payrail-Signature": signature,
          },
        },
        (incoming) => {
          let bytes = 0;
          incoming.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 16384) incoming.destroy(new Error("Webhook response exceeds limit."));
          });
          incoming.on("error", reject);
          incoming.on("end", () => resolve(incoming.statusCode || 0));
        },
      );
      outgoing.setTimeout(5000, () =>
        outgoing.destroy(new Error("Webhook destination timed out.")),
      );
      outgoing.on("error", reject);
      outgoing.end(payload);
    });
  }
  async deliver(
    endpointId: string,
    merchantId: string,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const result = await this.pool.query<EndpointRow>(
      `SELECT * FROM payrail_private.merchant_webhook_endpoints WHERE id = $1 AND merchant_id = $2 AND is_active = true AND $3 = ANY(subscribed_events)`,
      [endpointId, merchantId, eventType],
    );
    const endpoint = result.rows[0];
    if (!endpoint?.encrypted_secret || endpoint.secret_version !== "v1")
      throw new NotFoundException("Active webhook endpoint not found.");
    const safe = Object.fromEntries(
      Object.entries(payload).filter(([key]) =>
        ["paymentIntentId", "refundId", "amountMinor", "currency", "state", "merchantId"].includes(
          key,
        ),
      ),
    );
    const body = JSON.stringify({ id: eventId, type: eventType, data: safe });
    const statusCode = await this.sendSigned(
      endpoint.url,
      body,
      this.signPayload(body, this.decrypt(endpoint.encrypted_secret, merchantId)),
    );
    await this.recordDelivery(
      endpointId,
      eventId,
      eventType,
      safe,
      statusCode >= 200 && statusCode < 300 ? "DELIVERED" : "RETRYING",
      statusCode,
    );
    if (statusCode < 200 || statusCode >= 300)
      throw new ServiceUnavailableException("Merchant webhook was not acknowledged.");
  }
  async recordDelivery(
    endpointId: string,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    status: string,
    statusCode?: number,
  ): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO payrail_private.merchant_webhook_deliveries (endpoint_id,event_id,event_type,payload,status,status_code) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [endpointId, eventId, eventType, JSON.stringify(payload), status, statusCode || null],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Delivery recording failed.");
    return row.id;
  }
  async getDeliveries(merchantId: string, endpointId?: string, limit = 50) {
    const result = await this.pool.query(
      `SELECT d.id, d.endpoint_id AS "endpointId", d.event_id AS "eventId", d.event_type AS "eventType", d.status, d.status_code AS "statusCode", d.attempt_count AS "attemptCount", d.created_at AS "createdAt"
       FROM payrail_private.merchant_webhook_deliveries d JOIN payrail_private.merchant_webhook_endpoints e ON e.id = d.endpoint_id
       WHERE e.merchant_id = $1 AND ($2::uuid IS NULL OR e.id = $2) ORDER BY d.created_at DESC LIMIT $3`,
      [merchantId, endpointId || null, limit],
    );
    return result.rows;
  }
}
