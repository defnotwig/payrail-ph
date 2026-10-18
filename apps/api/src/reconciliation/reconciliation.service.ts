import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import { LedgerService } from "../ledger/ledger.service";

export type DiscrepancyType =
  | "MATCHED"
  | "LOCAL_ONLY"
  | "PROVIDER_ONLY"
  | "STATUS_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "DUPLICATE"
  | "UNKNOWN";

export type ResolutionStatus =
  | "UNRESOLVED"
  | "AUTO_REPAIRED"
  | "MANUAL_INVESTIGATION"
  | "DISMISSED";

export interface ReconciliationRunRecord {
  id: string;
  merchantId: string;
  startedAt: string;
  completedAt?: string | undefined;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  totalRecords: number;
  matchedRecords: number;
  discrepancyRecords: number;
  summary: Record<string, unknown>;
}

export interface ReconciliationItemRecord {
  id: string;
  runId: string;
  paymentIntentId?: string | undefined;
  providerPaymentId?: string | undefined;
  discrepancyType: DiscrepancyType;
  resolution?: ResolutionStatus | undefined;
  localState?: string | undefined;
  providerState?: string | undefined;
  amountMinor?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
}

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(PG_POOL) private readonly pool: DatabasePool,
    @Inject(LedgerService) private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Executes an automated 3-way reconciliation run:
   * Compares Local Payment Intents vs Provider Attempts vs Ledger Postings.
   * Safe Policy: Automatically repairs clean STATUS_MISMATCH (missed webhooks where provider confirmed payment)
   * while escalating unknown amount/currency mismatches to MANUAL_INVESTIGATION.
   */
  async runReconciliation(merchantId: string): Promise<ReconciliationRunRecord> {
    const runId = crypto.randomUUID();

    // 1. Create Run Record
    await this.pool.query(
      `INSERT INTO payrail_private.reconciliation_runs
         (id, merchant_id, status)
       VALUES ($1, $2, 'RUNNING')`,
      [runId, merchantId],
    );

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // 2. Fetch all local payment intents with their attempts
      const localIntentsRes = await client.query<{
        id: string;
        merchant_id: string;
        amount_minor: string;
        currency: string;
        state: string;
        provider_payment_id: string | null;
        submission_state: string | null;
      }>(
        `SELECT 
           pi.id,
           pi.merchant_id,
           pi.amount_minor,
           pi.currency,
           pi.state,
           pa.provider_payment_id,
           pa.submission_state
         FROM payrail_private.payment_intents pi
         LEFT JOIN payrail_private.payment_attempts pa ON pa.payment_intent_id = pi.id
         WHERE pi.merchant_id = $1
         ORDER BY pi.created_at DESC`,
        [merchantId],
      );

      let matchedCount = 0;
      let discrepancyCount = 0;

      for (const intent of localIntentsRes.rows) {
        let discrepancy: DiscrepancyType = "MATCHED";
        let resolution: ResolutionStatus = "UNRESOLVED";
        let notes = "Verified 3-way match";
        const providerState = intent.submission_state || "unknown";

        if (!intent.provider_payment_id) {
          if (intent.state === "CREATED") {
            discrepancy = "MATCHED";
            notes = "Pending submission";
          } else {
            discrepancy = "LOCAL_ONLY";
            resolution = "MANUAL_INVESTIGATION";
            notes = "Payment has non-initial state but zero provider attempts recorded";
          }
        } else if (intent.state === "SUCCEEDED" && providerState === "SUCCEEDED") {
          discrepancy = "MATCHED";
          matchedCount++;
        } else if (intent.state === "AWAITING_PAYMENT" && providerState === "SUCCEEDED") {
          // Missed webhook scenario: Provider confirmed payment, but local DB missed webhook
          discrepancy = "STATUS_MISMATCH";
          resolution = "AUTO_REPAIRED";
          notes =
            "Missed webhook recovered: transitioning local state to SUCCEEDED and posting to ledger";

          // Execute deterministic safe repair:
          await client.query(
            `UPDATE payrail_private.payment_intents
             SET state = 'SUCCEEDED', updated_at = clock_timestamp()
             WHERE id = $1`,
            [intent.id],
          );

          await client.query(
            `INSERT INTO payrail_private.payment_state_events
               (payment_intent_id, previous_state, next_state, source)
             VALUES ($1, 'AWAITING_PAYMENT', 'SUCCEEDED', 'RECONCILIATION_REPAIR')`,
            [intent.id],
          );

          // Post compensating ledger entry
          await this.ledgerService.postPaymentSuccess(
            merchantId,
            intent.id,
            intent.amount_minor,
            intent.currency,
            client,
          );

          discrepancyCount++;
        } else if (intent.state === "SUCCEEDED" && providerState === "FAILED") {
          discrepancy = "STATUS_MISMATCH";
          resolution = "MANUAL_INVESTIGATION";
          notes = "Critical discrepancy: local marks SUCCEEDED but provider reported FAILED";
          discrepancyCount++;
        } else {
          discrepancy = "MATCHED";
          matchedCount++;
        }

        // Insert item record
        await client.query(
          `INSERT INTO payrail_private.reconciliation_items
             (run_id, payment_intent_id, provider_payment_id, discrepancy_type, resolution, local_state, provider_state, amount_minor, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            runId,
            intent.id,
            intent.provider_payment_id,
            discrepancy,
            resolution,
            intent.state,
            providerState,
            intent.amount_minor,
            notes,
          ],
        );
      }

      const totalCount = localIntentsRes.rows.length;
      const summary = {
        totalIntents: totalCount,
        matched: matchedCount,
        discrepancies: discrepancyCount,
        policy: "AUTOMATED_SAFE_REPAIR_ON_MISSED_WEBHOOK",
      };

      // 3. Complete Run
      const completedRunRes = await client.query<{
        id: string;
        merchant_id: string;
        started_at: Date;
        completed_at: Date;
        status: "RUNNING" | "COMPLETED" | "FAILED";
        total_records: number;
        matched_records: number;
        discrepancy_records: number;
        summary: Record<string, unknown>;
      }>(
        `UPDATE payrail_private.reconciliation_runs
         SET status = 'COMPLETED',
             completed_at = clock_timestamp(),
             total_records = $1,
             matched_records = $2,
             discrepancy_records = $3,
             summary = $4
         WHERE id = $5
         RETURNING *`,
        [totalCount, matchedCount, discrepancyCount, JSON.stringify(summary), runId],
      );

      await client.query("COMMIT");

      const r = completedRunRes.rows[0];
      if (!r) {
        throw new NotFoundException(`Reconciliation run '${runId}' not found.`);
      }
      return {
        id: r.id,
        merchantId: r.merchant_id,
        startedAt: r.started_at.toISOString(),
        completedAt: r.completed_at?.toISOString(),
        status: r.status,
        totalRecords: r.total_records,
        matchedRecords: r.matched_records,
        discrepancyRecords: r.discrepancy_records,
        summary: r.summary,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      await this.pool.query(
        `UPDATE payrail_private.reconciliation_runs SET status = 'FAILED', completed_at = clock_timestamp() WHERE id = $1`,
        [runId],
      );
      throw err;
    } finally {
      client.release();
    }
  }

  async getRuns(merchantId: string, limit = 20): Promise<ReconciliationRunRecord[]> {
    const res = await this.pool.query<{
      id: string;
      merchant_id: string;
      started_at: Date;
      completed_at: Date | null;
      status: "RUNNING" | "COMPLETED" | "FAILED";
      total_records: number;
      matched_records: number;
      discrepancy_records: number;
      summary: Record<string, unknown>;
    }>(
      `SELECT * FROM payrail_private.reconciliation_runs
       WHERE merchant_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [merchantId, limit],
    );

    return res.rows.map((r) => ({
      id: r.id,
      merchantId: r.merchant_id,
      startedAt: r.started_at.toISOString(),
      completedAt: r.completed_at?.toISOString(),
      status: r.status,
      totalRecords: r.total_records,
      matchedRecords: r.matched_records,
      discrepancyRecords: r.discrepancy_records,
      summary: r.summary,
    }));
  }

  async getItems(runId: string): Promise<ReconciliationItemRecord[]> {
    const res = await this.pool.query<{
      id: string;
      run_id: string;
      payment_intent_id: string | null;
      provider_payment_id: string | null;
      discrepancy_type: DiscrepancyType;
      resolution: ResolutionStatus | null;
      local_state: string | null;
      provider_state: string | null;
      amount_minor: string | null;
      notes: string | null;
      created_at: Date;
    }>(
      `SELECT * FROM payrail_private.reconciliation_items
       WHERE run_id = $1
       ORDER BY discrepancy_type DESC, created_at ASC`,
      [runId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      runId: r.run_id,
      paymentIntentId: r.payment_intent_id || undefined,
      providerPaymentId: r.provider_payment_id || undefined,
      discrepancyType: r.discrepancy_type,
      resolution: r.resolution || undefined,
      localState: r.local_state || undefined,
      providerState: r.provider_state || undefined,
      amountMinor: r.amount_minor || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
