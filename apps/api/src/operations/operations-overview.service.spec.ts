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

  describe("searchOperationalData", () => {
    it("returns empty structure for empty or short queries without db access", async () => {
      const mockPool = { query: vi.fn() } as unknown as DatabasePool;
      const service = new OperationsOverviewService(
        mockPool,
        new CircuitBreakerService(),
        {} as unknown as LedgerService,
        {} as unknown as ReconciliationService,
        {} as unknown as DurableJobsService,
        {} as unknown as MerchantKeysService,
        {} as unknown as MerchantWebhooksService,
      );

      const emptyRes = await service.searchOperationalData("merchant_1", "");
      expect(emptyRes.payments).toHaveLength(0);
      expect(mockPool.query).not.toHaveBeenCalled();

      const singleCharRes = await service.searchOperationalData("merchant_1", "p");
      expect(singleCharRes.payments).toHaveLength(0);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("executes parallel parameterized queries and maps results correctly", async () => {
      const mockPool = {
        query: vi
          .fn()
          // 1. payments
          .mockResolvedValueOnce({
            rows: [
              {
                id: "pi_12345678",
                order_number: "PRL-20261019-001",
                amount_minor: "100",
                currency: "PHP",
                state: "SUCCEEDED",
                created_at: new Date("2026-10-19T10:00:00Z"),
              },
            ],
          })
          // 2. refunds
          .mockResolvedValueOnce({
            rows: [
              {
                id: "ref_98765432",
                payment_intent_id: "pi_12345678",
                amount_minor: "100",
                currency: "PHP",
                reason: "Customer requested",
                state: "SUCCEEDED",
                created_at: new Date("2026-10-19T11:00:00Z"),
              },
            ],
          })
          // 3. ledger
          .mockResolvedValueOnce({
            rows: [
              {
                id: "jrn_1",
                entry_number: "JE-1001",
                reference_type: "PAYMENT",
                reference_id: "pi_12345678",
                description: "Payment settlement",
                posting_state: "POSTED",
                created_at: new Date("2026-10-19T10:01:00Z"),
              },
            ],
          })
          // 4. webhooks
          .mockResolvedValueOnce({
            rows: [
              {
                id: "evt_row_1",
                provider: "paymongo",
                provider_event_id: "evt_12345",
                event_type: "payment.paid",
                signature_verified: true,
                received_at: new Date("2026-10-19T10:00:30Z"),
              },
            ],
          })
          // 5. jobs
          .mockResolvedValueOnce({
            rows: [
              {
                id: "dlq_1",
                job_type: "SEND_WEBHOOK",
                failure_reason: "Connection timeout",
                created_at: new Date("2026-10-19T10:05:00Z"),
              },
            ],
          })
          // 6. reconciliation
          .mockResolvedValueOnce({
            rows: [
              {
                id: "rec_1",
                status: "COMPLETED",
                total_records: 10,
                discrepancy_records: 0,
                created_at: new Date("2026-10-19T12:00:00Z"),
              },
            ],
          }),
      } as unknown as DatabasePool;

      const service = new OperationsOverviewService(
        mockPool,
        new CircuitBreakerService(),
        {} as unknown as LedgerService,
        {} as unknown as ReconciliationService,
        {} as unknown as DurableJobsService,
        {} as unknown as MerchantKeysService,
        {} as unknown as MerchantWebhooksService,
      );

      const res = await service.searchOperationalData("merchant_1", "PRL");

      expect(mockPool.query).toHaveBeenCalledTimes(6);
      expect(res.payments).toHaveLength(1);
      expect(res.payments[0]?.title).toBe("PRL-20261019-001");
      expect(res.payments[0]?.subtitle).toContain("PHP 1.00");
      expect(res.payments[0]?.status).toBe("SUCCEEDED");
      expect(res.payments[0]?.href).toBe("/ops/transactions?search=PRL-20261019-001");

      expect(res.refunds).toHaveLength(1);
      expect(res.refunds[0]?.title).toBe("Refund: Customer requested");

      expect(res.ledger).toHaveLength(1);
      expect(res.ledger[0]?.title).toBe("Journal #JE-1001");

      expect(res.webhooks).toHaveLength(1);
      expect(res.webhooks[0]?.title).toBe("Event: payment.paid");
      expect(res.webhooks[0]?.status).toBe("VERIFIED");

      expect(res.jobs).toHaveLength(1);
      expect(res.jobs[0]?.title).toBe("DLQ: SEND_WEBHOOK");

      expect(res.reconciliation).toHaveLength(1);
      expect(res.reconciliation[0]?.status).toBe("COMPLETED");
    });
  });
});
