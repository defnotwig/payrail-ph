import { Inject, Injectable } from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import type { PoolClient } from "pg";

export interface RecordAuditEventDto {
  merchantId?: string | undefined;
  actorType: "OPERATOR" | "API_KEY" | "SYSTEM" | "WEBHOOK";
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
}

export interface AuditEventRecord {
  id: string;
  merchantId?: string | undefined;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ipAddress?: string | undefined;
  createdAt: string;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: DatabasePool) {}

  /**
   * Appends an immutable audit event for financial or security operations.
   */
  async recordEvent(dto: RecordAuditEventDto, client?: PoolClient): Promise<string> {
    const executor = client || this.pool;
    const res = await executor.query<{ id: string }>(
      `INSERT INTO payrail_private.audit_events
         (merchant_id, actor_type, actor_id, action, resource_type, resource_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        dto.merchantId || null,
        dto.actorType,
        dto.actorId,
        dto.action,
        dto.resourceType,
        dto.resourceId,
        JSON.stringify(dto.metadata || {}),
        dto.ipAddress || null,
      ],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert audit event");
    }
    return row.id;
  }

  /**
   * Retrieves audit events for compliance review and forensic investigation.
   */
  async getEvents(merchantId: string, limit = 50): Promise<AuditEventRecord[]> {
    let query = `SELECT * FROM payrail_private.audit_events WHERE merchant_id = $1`;
    const params: unknown[] = [merchantId];

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await this.pool.query<{
      id: string;
      merchant_id: string | null;
      actor_type: string;
      actor_id: string;
      action: string;
      resource_type: string;
      resource_id: string;
      metadata: Record<string, unknown>;
      ip_address: string | null;
      created_at: Date;
    }>(query, params);

    return res.rows.map((r) => ({
      id: r.id,
      merchantId: r.merchant_id || undefined,
      actorType: r.actor_type,
      actorId: r.actor_id,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      metadata: r.metadata,
      ipAddress: r.ip_address || undefined,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
