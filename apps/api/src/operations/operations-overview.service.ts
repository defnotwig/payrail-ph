import { Inject, Injectable } from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import { CircuitBreakerService } from "../providers/circuit-breaker.service";
import { LedgerService } from "../ledger/ledger.service";
import { ReconciliationService } from "../reconciliation/reconciliation.service";
import { DurableJobsService } from "../jobs/durable-jobs.service";
import { MerchantKeysService } from "../merchant-api/merchant-keys.service";
import { MerchantWebhooksService } from "../merchant-api/merchant-webhooks.service";

export interface OperationsOverviewQuery {
  period?: "today" | "7d" | "30d" | "all";
}

export interface NeedsAttentionItem {
  id: string;
  entityType: "PAYMENT" | "JOB" | "WEBHOOK" | "REFUND" | "RECONCILIATION";
  condition: string;
  summary: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  createdAt: string;
  recommendedAction: string;
}

export interface RecentPaymentItem {
  id: string;
  orderNumber: string;
  amountMinor: string;
  currency: string;
  state: string;
  provider: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  confirmationLatencyMs?: number | null;
}

export interface ProviderHealthReport {
  provider: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN";
  totalAttempts24h: number;
  failedAttempts24h: number;
  failureRate: number;
  p95LatencyMs: number | null;
}

export interface OperationsOverviewResult {
  period: "today" | "7d" | "30d" | "all";
  successfulPayments: number;
  totalPayments: number;
  successRate: number | null;
  grossVolumeMinor: string;
  currency: "PHP";
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  providerFailures: number;
  needsAttention: NeedsAttentionItem[];
  recentPayments: RecentPaymentItem[];
  providerHealth: ProviderHealthReport;
}

@Injectable()
export class OperationsOverviewService {
  constructor(
    @Inject(PG_POOL) private readonly pool: DatabasePool,
    @Inject(CircuitBreakerService) private readonly circuitBreaker: CircuitBreakerService,
    @Inject(LedgerService) private readonly ledgerService: LedgerService,
    @Inject(ReconciliationService) private readonly reconciliationService: ReconciliationService,
    @Inject(DurableJobsService) private readonly jobsService: DurableJobsService,
    @Inject(MerchantKeysService) private readonly keysService: MerchantKeysService,
    @Inject(MerchantWebhooksService) private readonly webhooksService: MerchantWebhooksService,
  ) {}

  async getOverview(
    merchantId: string,
    query?: OperationsOverviewQuery,
  ): Promise<OperationsOverviewResult> {
    const period = query?.period || "today";

    let dateFilterSql = "";
    if (period === "today") {
      dateFilterSql = "AND created_at >= date_trunc('day', clock_timestamp())";
    } else if (period === "7d") {
      dateFilterSql = "AND created_at >= clock_timestamp() - interval '7 days'";
    } else if (period === "30d") {
      dateFilterSql = "AND created_at >= clock_timestamp() - interval '30 days'";
    }

    // 1. Authoritative payment metrics from PostgreSQL
    const metricsRes = await this.pool.query<{
      total_payments: string;
      successful_payments: string;
      failed_payments: string;
      gross_volume_minor: string;
    }>(
      `SELECT
         count(*)::text AS total_payments,
         count(*) FILTER (WHERE state = 'SUCCEEDED')::text AS successful_payments,
         count(*) FILTER (WHERE state = 'FAILED')::text AS failed_payments,
         coalesce(sum(amount_minor) FILTER (WHERE state = 'SUCCEEDED'), 0)::text AS gross_volume_minor
       FROM payrail_private.payment_intents
       WHERE merchant_id = $1 ${dateFilterSql}`,
      [merchantId],
    );

    const m = metricsRes.rows[0] ?? {
      total_payments: "0",
      successful_payments: "0",
      failed_payments: "0",
      gross_volume_minor: "0",
    };

    const totalPayments = Number.parseInt(m.total_payments, 10) || 0;
    const successfulPayments = Number.parseInt(m.successful_payments, 10) || 0;
    const providerFailures = Number.parseInt(m.failed_payments, 10) || 0;
    const grossVolumeMinor = m.gross_volume_minor;

    const successRate =
      totalPayments > 0 ? Math.round((successfulPayments / totalPayments) * 1000) / 10 : null;

    // 2. Real end-to-end confirmation latency: elapsed time from created_at to terminal updated_at
    const latencyRes = await this.pool.query<{
      p50_latency_ms: string | null;
      p95_latency_ms: string | null;
    }>(
      `SELECT
         percentile_cont(0.50) WITHIN GROUP (
           ORDER BY extract(epoch from (updated_at - created_at)) * 1000
         )::int::text AS p50_latency_ms,
         percentile_cont(0.95) WITHIN GROUP (
           ORDER BY extract(epoch from (updated_at - created_at)) * 1000
         )::int::text AS p95_latency_ms
       FROM payrail_private.payment_intents
       WHERE merchant_id = $1
         AND state IN ('SUCCEEDED', 'FAILED', 'EXPIRED')
         ${dateFilterSql}`,
      [merchantId],
    );

    const l = latencyRes.rows[0];
    const p50LatencyMs = l?.p50_latency_ms ? Number.parseInt(l.p50_latency_ms, 10) : null;
    const p95LatencyMs = l?.p95_latency_ms ? Number.parseInt(l.p95_latency_ms, 10) : null;

    // 3. Needs Attention Queue: Exceptions requiring human operator action
    const needsAttention: NeedsAttentionItem[] = [];

    // Payments in UNKNOWN state
    const unknownPaymentsRes = await this.pool.query<{
      id: string;
      created_at: Date;
    }>(
      `SELECT id, created_at
       FROM payrail_private.payment_intents
       WHERE merchant_id = $1 AND state = 'UNKNOWN_REQUIRES_RECONCILIATION'
       ORDER BY created_at DESC LIMIT 5`,
      [merchantId],
    );
    for (const row of unknownPaymentsRes.rows) {
      needsAttention.push({
        id: row.id,
        entityType: "PAYMENT",
        condition: "UNKNOWN_REQUIRES_RECONCILIATION",
        summary: `Payment ${row.id} indeterminate; requires PSP ledger reconciliation.`,
        severity: "HIGH",
        createdAt: row.created_at.toISOString(),
        recommendedAction: "Run reconciliation match against PayMongo payout batch.",
      });
    }

    // Dead-letter queue jobs
    const dlqRes = await this.pool.query<{
      id: string;
      job_type: string;
      failure_reason: string;
      created_at: Date;
    }>(
      `SELECT id, job_type, failure_reason, created_at
       FROM payrail_private.dead_letter_queue
       WHERE (merchant_id = $1 OR merchant_id IS NULL) AND replayed_at IS NULL
       ORDER BY created_at DESC LIMIT 5`,
      [merchantId],
    );
    for (const row of dlqRes.rows) {
      needsAttention.push({
        id: row.id,
        entityType: "JOB",
        condition: "DEAD_LETTER",
        summary: `Job ${row.job_type} exhausted max attempts: ${row.failure_reason}`,
        severity: "CRITICAL",
        createdAt: row.created_at.toISOString(),
        recommendedAction: "Inspect job payload and replay after fixing underlying dependency.",
      });
    }

    // Failed webhook events
    const failedWebhooksRes = await this.pool.query<{
      id: string;
      event_type: string;
      error_message: string | null;
      received_at: Date;
    }>(
      `SELECT id, event_type, error_message, received_at
       FROM payrail_private.provider_events
       WHERE processing_state = 'FAILED' OR signature_verified = false
       ORDER BY received_at DESC LIMIT 5`,
    );
    for (const row of failedWebhooksRes.rows) {
      needsAttention.push({
        id: row.id,
        entityType: "WEBHOOK",
        condition: "FAILED_PROCESSING",
        summary: `Webhook ${row.event_type} (${row.id}): ${row.error_message || "Invalid signature"}`,
        severity: "HIGH",
        createdAt: row.received_at.toISOString(),
        recommendedAction: "Verify webhook secret and inspect raw payload header signatures.",
      });
    }

    // 4. Recent payments: authoritative DB rows
    const recentRes = await this.pool.query<{
      id: string;
      order_number: string;
      amount_minor: string;
      currency: string;
      state: string;
      provider: string;
      payment_method: string;
      created_at: Date;
      updated_at: Date;
      latency_ms: string | null;
    }>(
      `SELECT
         p.id,
         o.order_number,
         p.amount_minor,
         p.currency,
         p.state,
         p.provider,
         p.payment_method,
         p.created_at,
         p.updated_at,
         CASE
           WHEN p.state IN ('SUCCEEDED', 'FAILED', 'EXPIRED')
           THEN (extract(epoch from (p.updated_at - p.created_at)) * 1000)::int::text
           ELSE NULL
         END AS latency_ms
       FROM payrail_private.payment_intents p
       JOIN payrail_private.orders o ON o.id = p.order_id
       WHERE p.merchant_id = $1
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [merchantId],
    );

    const recentPayments: RecentPaymentItem[] = recentRes.rows.map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      amountMinor: row.amount_minor,
      currency: row.currency,
      state: row.state,
      provider: row.provider,
      paymentMethod: row.payment_method,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      confirmationLatencyMs: row.latency_ms ? Number.parseInt(row.latency_ms, 10) : null,
    }));

    // 5. Provider health
    const attemptsRes = await this.pool.query<{
      total_attempts: string;
      failed_attempts: string;
    }>(
      `SELECT
         count(*)::text AS total_attempts,
         count(*) FILTER (WHERE submission_state = 'FAILED')::text AS failed_attempts
       FROM payrail_private.payment_attempts
       WHERE created_at >= clock_timestamp() - interval '24 hours'`,
    );

    const totalAttempts = Number.parseInt(attemptsRes.rows[0]?.total_attempts ?? "0", 10);
    const failedAttempts = Number.parseInt(attemptsRes.rows[0]?.failed_attempts ?? "0", 10);
    const failureRate =
      totalAttempts > 0 ? Math.round((failedAttempts / totalAttempts) * 1000) / 10 : 0;

    const circuitMetrics = this.circuitBreaker.getMetrics();
    const paymongoCircuit = circuitMetrics.find((c) => c.provider === "paymongo");
    const circuitState = paymongoCircuit?.state || "CLOSED";

    let providerStatus: "HEALTHY" | "DEGRADED" | "DOWN" = "HEALTHY";
    if (circuitState === "OPEN") {
      providerStatus = "DOWN";
    } else if (circuitState === "HALF_OPEN" || failureRate > 5) {
      providerStatus = "DEGRADED";
    }

    const providerHealth: ProviderHealthReport = {
      provider: "paymongo",
      status: providerStatus,
      circuitState,
      totalAttempts24h: totalAttempts,
      failedAttempts24h: failedAttempts,
      failureRate,
      p95LatencyMs,
    };

    return {
      period,
      successfulPayments,
      totalPayments,
      successRate,
      grossVolumeMinor,
      currency: "PHP",
      p50LatencyMs,
      p95LatencyMs,
      providerFailures,
      needsAttention,
      recentPayments,
      providerHealth,
    };
  }

  async getSystemHealth(): Promise<{
    status: "HEALTHY" | "DEGRADED" | "DOWN";
    timestamp: string;
    components: {
      api: { status: "OK"; latencyMs: number };
      database: { status: "OK" | "DOWN"; latencyMs: number };
      paymongo: { status: "HEALTHY" | "DEGRADED" | "DOWN"; circuit: string };
      webhooks: { status: "OK" | "DEGRADED"; unverifiedCount: number };
      workers: { status: "OK" | "DEGRADED"; dlqCount: number };
    };
  }> {
    const t0 = Date.now();
    let dbStatus: "OK" | "DOWN" = "OK";
    let dbLatencyMs = 0;
    try {
      const dbStart = Date.now();
      await this.pool.query("SELECT 1");
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbStatus = "DOWN";
    }

    const circuitMetrics = this.circuitBreaker.getMetrics();
    const paymongoCircuit = circuitMetrics.find((c) => c.provider === "paymongo");
    const circuitState = paymongoCircuit?.state || "CLOSED";

    const dlqRes = await this.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM payrail_private.dead_letter_queue WHERE replayed_at IS NULL",
    );
    const dlqCount = Number.parseInt(dlqRes.rows[0]?.count ?? "0", 10);

    const webhookRes = await this.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM payrail_private.provider_events WHERE processing_state = 'FAILED' OR signature_verified = false",
    );
    const unverifiedCount = Number.parseInt(webhookRes.rows[0]?.count ?? "0", 10);

    let overallStatus: "HEALTHY" | "DEGRADED" | "DOWN" = "HEALTHY";
    if (dbStatus === "DOWN" || circuitState === "OPEN") {
      overallStatus = "DOWN";
    } else if (circuitState === "HALF_OPEN" || dlqCount > 0 || unverifiedCount > 5) {
      overallStatus = "DEGRADED";
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        api: { status: "OK", latencyMs: Date.now() - t0 },
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        paymongo: {
          status:
            circuitState === "OPEN"
              ? "DOWN"
              : circuitState === "HALF_OPEN"
                ? "DEGRADED"
                : "HEALTHY",
          circuit: circuitState,
        },
        webhooks: {
          status: unverifiedCount > 0 ? "DEGRADED" : "OK",
          unverifiedCount,
        },
        workers: {
          status: dlqCount > 0 ? "DEGRADED" : "OK",
          dlqCount,
        },
      },
    };
  }

  async getLedgerOverview(merchantId: string) {
    const [accounts, entries] = await Promise.all([
      this.ledgerService.getAccountBalances(merchantId),
      this.ledgerService.getJournalEntries(merchantId, 50),
    ]);
    return { accounts, entries };
  }

  async getReconciliationOverview(merchantId: string) {
    const runs = await this.reconciliationService.getRuns(merchantId, 50);
    return { runs };
  }

  async runReconciliation(merchantId: string) {
    return this.reconciliationService.runReconciliation(merchantId);
  }

  async getJobsOverview() {
    const [jobs, dlq] = await Promise.all([
      this.jobsService.getActiveJobs(50),
      this.jobsService.getDeadLetters(50),
    ]);
    return { jobs, dlq };
  }

  async replayDeadLetter(dlqId: string, replayedBy: string) {
    return this.jobsService.replayDeadLetter(dlqId, replayedBy);
  }

  async getDeveloperOverview(merchantId: string) {
    const [keys, deliveries, endpointsRes] = await Promise.all([
      this.keysService.listApiKeys(merchantId),
      this.webhooksService.getDeliveries(merchantId, undefined, 20),
      this.pool.query<{
        id: string;
        url: string;
        subscribed_events: string[];
        is_active: boolean;
        created_at: Date;
      }>(
        `SELECT id, url, subscribed_events, is_active, created_at
         FROM payrail_private.merchant_webhook_endpoints
         WHERE merchant_id = $1
         ORDER BY created_at DESC`,
        [merchantId],
      ),
    ]);
    const webhooks = endpointsRes.rows.map((r) => ({
      id: r.id,
      url: r.url,
      subscribedEvents: r.subscribed_events,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
    }));
    return { keys, webhooks, deliveries };
  }
}
