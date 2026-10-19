import { describe, expect, it, vi } from "vitest";
import { OperationsOverviewService } from "./operations-overview.service";
import type { DatabasePool } from "../database/database.pool";
import { CircuitBreakerService } from "../providers/circuit-breaker.service";
import type { LedgerService } from "../ledger/ledger.service";
import type { ReconciliationService } from "../reconciliation/reconciliation.service";
import type { DurableJobsService } from "../jobs/durable-jobs.service";
import type { MerchantKeysService } from "../merchant-api/merchant-keys.service";
import type { MerchantWebhooksService } from "../merchant-api/merchant-webhooks.service";

describe("OperationsOverviewService", () => {
  it("calculates real metrics and handles empty state properly", async () => {
    const mockPool = {
      query: vi
        .fn()
        // 1. metrics query
        .mockResolvedValueOnce({
          rows: [
            {
              total_payments: "2",
              successful_payments: "2",
              failed_payments: "0",
              gross_volume_minor: "200",
            },
          ],
        })
        // 2. latency query
        .mockResolvedValueOnce({
          rows: [{ p50_latency_ms: "150", p95_latency_ms: "220" }],
        })
        // 3. unknown payments query
        .mockResolvedValueOnce({ rows: [] })
        // 4. dlq query
        .mockResolvedValueOnce({ rows: [] })
        // 5. failed webhooks query
        .mockResolvedValueOnce({ rows: [] })
        // 6. recent payments query
        .mockResolvedValueOnce({
          rows: [
            {
              id: "pi_1",
              order_number: "PRL-1001",
              amount_minor: "100",
              currency: "PHP",
              state: "SUCCEEDED",
              provider: "paymongo",
              payment_method: "qrph",
              created_at: new Date("2026-10-19T10:00:00Z"),
              updated_at: new Date("2026-10-19T10:00:01Z"),
              latency_ms: "1000",
            },
          ],
        })
        // 7. provider attempts query
        .mockResolvedValueOnce({
          rows: [{ total_attempts: "2", failed_attempts: "0" }],
        }),
    } as unknown as DatabasePool;

    const circuitBreaker = new CircuitBreakerService();
    const mockLedger = {
      getAccountBalances: vi.fn().mockResolvedValue([]),
      getJournalEntries: vi.fn().mockResolvedValue([]),
    } as unknown as LedgerService;
    const mockRecon = {
      getRuns: vi.fn().mockResolvedValue([]),
      runReconciliation: vi.fn().mockResolvedValue({ id: "run_1" }),
    } as unknown as ReconciliationService;
    const mockJobs = {
      getActiveJobs: vi.fn().mockResolvedValue([]),
      getDeadLetters: vi.fn().mockResolvedValue([]),
      replayDeadLetter: vi.fn().mockResolvedValue("job_1"),
    } as unknown as DurableJobsService;
    const mockKeys = {
      listApiKeys: vi.fn().mockResolvedValue([]),
    } as unknown as MerchantKeysService;
    const mockWebhooks = {
      getDeliveries: vi.fn().mockResolvedValue([]),
    } as unknown as MerchantWebhooksService;

    const service = new OperationsOverviewService(
      mockPool,
      circuitBreaker,
      mockLedger,
      mockRecon,
      mockJobs,
      mockKeys,
      mockWebhooks,
    );

    const result = await service.getOverview("merchant_default", { period: "today" });

    expect(result.period).toBe("today");
    expect(result.totalPayments).toBe(2);
    expect(result.successfulPayments).toBe(2);
    expect(result.successRate).toBe(100);
    expect(result.grossVolumeMinor).toBe("200");
    expect(result.p50LatencyMs).toBe(150);
    expect(result.p95LatencyMs).toBe(220);
    expect(result.needsAttention).toHaveLength(0);
    expect(result.recentPayments).toHaveLength(1);
    expect(result.recentPayments[0]?.orderNumber).toBe("PRL-1001");
    expect(result.providerHealth.provider).toBe("paymongo");
    expect(result.providerHealth.status).toBe("HEALTHY");
  });

  it("handles empty database state without dividing by zero", async () => {
    const mockPool = {
      query: vi
        .fn()
        // 1. metrics query
        .mockResolvedValueOnce({
          rows: [
            {
              total_payments: "0",
              successful_payments: "0",
              failed_payments: "0",
              gross_volume_minor: "0",
            },
          ],
        })
        // 2. latency query
        .mockResolvedValueOnce({
          rows: [{ p50_latency_ms: null, p95_latency_ms: null }],
        })
        // 3. unknown payments query
        .mockResolvedValueOnce({ rows: [] })
        // 4. dlq query
        .mockResolvedValueOnce({ rows: [] })
        // 5. failed webhooks query
        .mockResolvedValueOnce({ rows: [] })
        // 6. recent payments query
        .mockResolvedValueOnce({ rows: [] })
        // 7. provider attempts query
        .mockResolvedValueOnce({
          rows: [{ total_attempts: "0", failed_attempts: "0" }],
        }),
    } as unknown as DatabasePool;

    const circuitBreaker = new CircuitBreakerService();
    const service = new OperationsOverviewService(
      mockPool,
      circuitBreaker,
      {} as unknown as LedgerService,
      {} as unknown as ReconciliationService,
      {} as unknown as DurableJobsService,
      {} as unknown as MerchantKeysService,
      {} as unknown as MerchantWebhooksService,
    );

    const result = await service.getOverview("merchant_default", { period: "all" });

    expect(result.totalPayments).toBe(0);
    expect(result.successfulPayments).toBe(0);
    expect(result.successRate).toBeNull();
    expect(result.grossVolumeMinor).toBe("0");
    expect(result.p50LatencyMs).toBeNull();
    expect(result.p95LatencyMs).toBeNull();
    expect(result.recentPayments).toHaveLength(0);
  });
});
