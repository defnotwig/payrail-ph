import { Inject, Injectable } from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import type { PoolClient } from "pg";

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  publishedAt?: string | undefined;
}

@Injectable()
export class OutboxService {
  constructor(@Inject(PG_POOL) private readonly pool: DatabasePool) {}

  /**
   * Atomically records an outbox event.
   * If a client is provided, the event is committed within the exact same database transaction
   * as the originating financial mutation, guaranteeing zero message loss.
   */
  async emit(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    client?: PoolClient,
  ): Promise<string> {
    const executor = client || this.pool;
    const res = await executor.query<{ id: string }>(
      `INSERT INTO payrail_private.outbox_events 
         (event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [eventType, aggregateType, aggregateId, JSON.stringify(payload)],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert outbox event");
    }
    return row.id;
  }

  /**
   * Fetches unpublished outbox events and marks them as published after dispatch.
   */
  async fetchUnpublished(limit = 20): Promise<OutboxEventRecord[]> {
    const res = await this.pool.query<{
      id: string;
      event_type: string;
      aggregate_type: string;
      aggregate_id: string;
      payload: Record<string, unknown>;
      created_at: Date;
      published_at: Date | null;
    }>(
      `SELECT * FROM payrail_private.outbox_events
       WHERE published_at IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit],
    );

    return res.rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      aggregateType: r.aggregate_type,
      aggregateId: r.aggregate_id,
      payload: r.payload,
      createdAt: r.created_at.toISOString(),
      publishedAt: r.published_at?.toISOString(),
    }));
  }

  /**
   * Marks a batch of outbox events as published.
   */
  async markPublished(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    await this.pool.query(
      `UPDATE payrail_private.outbox_events
       SET published_at = clock_timestamp()
       WHERE id = ANY($1::uuid[])`,
      [eventIds],
    );
  }
}
