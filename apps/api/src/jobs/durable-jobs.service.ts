import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import type { PoolClient } from "pg";

export type JobState =
  | "PENDING"
  | "CLAIMED"
  | "PROCESSING"
  | "RETRY_SCHEDULED"
  | "COMPLETED"
  | "DEAD_LETTER";

export interface DurableJobRecord {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  state: JobState;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lockedBy?: string | undefined;
  claimToken?: string | undefined;
  lockedUntil?: string | undefined;
  lastError?: string | undefined;
  errorCode?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface DeadLetterRecord {
  id: string;
  jobId: string;
  merchantId?: string | undefined;
  jobType: string;
  payload: Record<string, unknown>;
  failureReason: string;
  replayedAt?: string | undefined;
  replayedBy?: string | undefined;
  createdAt: string;
}

@Injectable()
export class DurableJobsService {
  constructor(@Inject(PG_POOL) private readonly pool: DatabasePool) {}

  /**
   * Creates a durable job, optionally within an existing transaction client.
   */
  async createJob(
    jobType: string,
    payload: Record<string, unknown>,
    client?: PoolClient,
  ): Promise<string> {
    const queryExecutor = client || this.pool;
    const res = await queryExecutor.query<{ id: string }>(
      `INSERT INTO payrail_private.durable_jobs (job_type, payload, state)
       VALUES ($1, $2, 'PENDING')
       RETURNING id`,
      [jobType, JSON.stringify(payload)],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to enqueue durable job");
    }
    return row.id;
  }

  /**
   * Claims up to `limit` pending or scheduled jobs using SELECT ... FOR UPDATE SKIP LOCKED.
   * Employs lease fencing to guarantee only one worker owns the job during the lease window.
   */
  async claimJobs(workerId: string, limit = 5, leaseSeconds = 30): Promise<DurableJobRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const res = await client.query<{
        id: string;
        job_type: string;
        payload: Record<string, unknown>;
        state: JobState;
        attempt_count: number;
        max_attempts: number;
        next_attempt_at: Date;
        locked_by: string | null;
        claim_token: string | null;
        locked_until: Date | null;
        last_error: string | null;
        error_code: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `WITH claimable AS (
           SELECT id
           FROM payrail_private.durable_jobs
           WHERE (state IN ('PENDING', 'RETRY_SCHEDULED') AND next_attempt_at <= clock_timestamp())
              OR (state='CLAIMED' AND locked_until <= clock_timestamp())
           ORDER BY next_attempt_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         UPDATE payrail_private.durable_jobs j
         SET state = 'CLAIMED',
             locked_by = $2,
             claim_token = gen_random_uuid(),
             locked_until = clock_timestamp() + ($3 * INTERVAL '1 second'),
             attempt_count = j.attempt_count + 1,
             updated_at = clock_timestamp()
         FROM claimable
         WHERE j.id = claimable.id
        RETURNING j.*`,
        [limit, workerId, leaseSeconds],
      );

      await client.query("COMMIT");

      return res.rows.map((r) => ({
        id: r.id,
        jobType: r.job_type,
        payload: r.payload,
        state: r.state,
        attemptCount: r.attempt_count,
        maxAttempts: r.max_attempts,
        nextAttemptAt: r.next_attempt_at.toISOString(),
        lockedBy: r.locked_by || undefined,
        claimToken: r.claim_token || undefined,
        lockedUntil: r.locked_until?.toISOString(),
        lastError: r.last_error || undefined,
        errorCode: r.error_code || undefined,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      }));
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Marks a claimed job as COMPLETED.
   */
  async completeJob(jobId: string, workerId: string, claimToken: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE payrail_private.durable_jobs
       SET state = 'COMPLETED', locked_by = NULL, locked_until = NULL, claim_token = NULL, updated_at = clock_timestamp()
       WHERE id = $1 AND state='CLAIMED' AND locked_by = $2 AND claim_token=$3 AND locked_until > clock_timestamp()`,
      [jobId, workerId, claimToken],
    );
    if (!result.rowCount) throw new Error("Job claim is stale or not owned by this worker");
  }

  /**
   * Handles job failure with exponential backoff and jitter, or routes to Dead Letter Queue.
   */
  async failJob(
    jobId: string,
    workerId: string,
    claimToken: string,
    error: Error | string,
    isTransient = true,
  ): Promise<void> {
    const errorMessage = typeof error === "string" ? error : error.message;
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const res = await client.query<{
        id: string;
        job_type: string;
        payload: Record<string, unknown>;
        attempt_count: number;
        max_attempts: number;
      }>(
        `SELECT id, job_type, payload, attempt_count, max_attempts
         FROM payrail_private.durable_jobs
         WHERE id = $1 AND state='CLAIMED' AND locked_by=$2 AND claim_token=$3 AND locked_until > clock_timestamp()
         FOR UPDATE`,
        [jobId, workerId, claimToken],
      );

      const job = res.rows[0];
      if (!job) {
        await client.query("ROLLBACK");
        throw new Error("Job claim is stale or not owned by this worker");
      }

      if (isTransient && job.attempt_count < job.max_attempts) {
        // Exponential backoff with random jitter (seconds: 2^attempt + jitter)
        const baseDelay = 2 ** job.attempt_count;
        const jitter = Math.random() * 2;
        const delaySeconds = Math.min(Math.round(baseDelay + jitter), 300);

        await client.query(
          `UPDATE payrail_private.durable_jobs
           SET state = 'RETRY_SCHEDULED',
               next_attempt_at = clock_timestamp() + ($1 * INTERVAL '1 second'),
               locked_by = NULL,
               locked_until = NULL,
               claim_token = NULL,
               last_error = $2,
               updated_at = clock_timestamp()
           WHERE id = $3`,
          [delaySeconds, errorMessage, jobId],
        );
      } else {
        // Exceeded attempts or permanent failure -> DEAD_LETTER
        await client.query(
          `UPDATE payrail_private.durable_jobs
           SET state = 'DEAD_LETTER',
               locked_by = NULL,
               locked_until = NULL,
               claim_token = NULL,
               last_error = $1,
               updated_at = clock_timestamp()
           WHERE id = $2`,
          [errorMessage, jobId],
        );

        const merchantId = (job.payload as Record<string, unknown>)?.merchantId as
          | string
          | undefined;

        await client.query(
          `INSERT INTO payrail_private.dead_letter_queue
             (job_id, merchant_id, job_type, payload, failure_reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [jobId, merchantId || null, job.job_type, JSON.stringify(job.payload), errorMessage],
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves active Dead Letter Queue entries for operations inspection.
   */
  async getDeadLetters(limit = 50): Promise<DeadLetterRecord[]> {
    const res = await this.pool.query<{
      id: string;
      job_id: string;
      merchant_id: string | null;
      job_type: string;
      payload: Record<string, unknown>;
      failure_reason: string;
      replayed_at: Date | null;
      replayed_by: string | null;
      created_at: Date;
    }>(
      `SELECT * FROM payrail_private.dead_letter_queue
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );

    return res.rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      merchantId: r.merchant_id || undefined,
      jobType: r.job_type,
      payload: r.payload,
      failureReason: r.failure_reason,
      replayedAt: r.replayed_at?.toISOString(),
      replayedBy: r.replayed_by || undefined,
      createdAt: r.created_at.toISOString(),
    }));
  }

  /**
   * Retrieves active durable jobs for operations inspection.
   */
  async getActiveJobs(limit = 50): Promise<DurableJobRecord[]> {
    const res = await this.pool.query<{
      id: string;
      job_type: string;
      payload: Record<string, unknown>;
      state: JobState;
      attempt_count: number;
      max_attempts: number;
      next_attempt_at: Date;
      locked_by: string | null;
      claim_token: string | null;
      locked_until: Date | null;
      last_error: string | null;
      error_code: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM payrail_private.durable_jobs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );

    return res.rows.map((r) => ({
      id: r.id,
      jobType: r.job_type,
      payload: r.payload,
      state: r.state,
      attemptCount: r.attempt_count,
      maxAttempts: r.max_attempts,
      nextAttemptAt: r.next_attempt_at.toISOString(),
      lockedBy: r.locked_by || undefined,
      claimToken: r.claim_token || undefined,
      lockedUntil: r.locked_until?.toISOString(),
      lastError: r.last_error || undefined,
      errorCode: r.error_code || undefined,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  /**
   * Replays an existing dead-letter item by re-queuing a new clean durable job.
   */
  async replayDeadLetter(dlqId: string, replayedBy: string): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const res = await client.query<{
        id: string;
        job_type: string;
        payload: Record<string, unknown>;
      }>(
        `SELECT id, job_type, payload FROM payrail_private.dead_letter_queue WHERE id = $1 FOR UPDATE`,
        [dlqId],
      );

      const dlq = res.rows[0];
      if (!dlq) {
        throw new NotFoundException(`Dead letter entry '${dlqId}' not found.`);
      }

      // Insert clean job
      const jobRes = await client.query<{ id: string }>(
        `INSERT INTO payrail_private.durable_jobs (job_type, payload, state)
         VALUES ($1, $2, 'PENDING')
         RETURNING id`,
        [dlq.job_type, JSON.stringify(dlq.payload)],
      );

      const replayedJobId = jobRes.rows[0]?.id || "";

      // Mark DLQ entry as replayed
      await client.query(
        `UPDATE payrail_private.dead_letter_queue
         SET replayed_at = clock_timestamp(), replayed_by = $1
         WHERE id = $2`,
        [replayedBy, dlqId],
      );

      // Record in immutable audit trail
      await client.query(
        `INSERT INTO payrail_private.audit_events
           (actor_type, actor_id, action, resource_type, resource_id, metadata)
         VALUES ('OPERATOR', $1, 'DLQ_REPLAY', 'dead_letter_queue', $2, $3)`,
        [replayedBy, dlqId, JSON.stringify({ replayedJobId, jobType: dlq.job_type })],
      );

      await client.query("COMMIT");
      return replayedJobId;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
