import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReconciliationService } from "./reconciliation.service";
import type { DatabasePool } from "../database/database.pool";
import type { LedgerService } from "../ledger/ledger.service";

describe("ReconciliationService", () => {
  let service: ReconciliationService;
  let mockDb: { connect: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let mockLedgerService: { postPaymentSuccess: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    };
    mockLedgerService = {
      postPaymentSuccess: vi.fn().mockResolvedValue({ id: "je-1" }),
    };
    service = new ReconciliationService(
      mockDb as unknown as DatabasePool,
      mockLedgerService as unknown as LedgerService,
    );
  });

  describe("Automated 3-Way Reconciliation Invariants", () => {
    it("classifies clean match between local and provider states as MATCHED", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT \n           pi.id")) {
          return Promise.resolve({
            rows: [
              {
                id: "pi-1",
                merchant_id: "merchant_test",
                amount_minor: "10000",
                currency: "PHP",
                state: "SUCCEEDED",
                provider_payment_id: "pay_1",
                submission_state: "SUCCEEDED",
                observation: { state: "SUCCEEDED", amountMinor: "10000", currency: "PHP" },
              },
            ],
          });
        }
        if (sql.includes("UPDATE payrail_private.reconciliation_runs")) {
          return Promise.resolve({
            rows: [
              {
                id: "run-1",
                merchant_id: "merchant_test",
                started_at: new Date(),
                completed_at: new Date(),
                status: "COMPLETED",
                total_records: 1,
                matched_records: 1,
                discrepancy_records: 0,
                summary: {},
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const run = await service.runReconciliation("merchant_test");

      expect(run.status).toBe("COMPLETED");
      expect(run.matchedRecords).toBe(1);
      expect(run.discrepancyRecords).toBe(0);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO payrail_private.reconciliation_items"),
        expect.arrayContaining(["MATCHED"]),
      );
    });

    it("detects missed webhook, marks AUTO_REPAIRED, transitions state, and posts to ledger", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT \n           pi.id")) {
          return Promise.resolve({
            rows: [
              {
                id: "pi-missed-webhook",
                merchant_id: "merchant_test",
                amount_minor: "15000",
                currency: "PHP",
                state: "AWAITING_PAYMENT", // Local state was waiting for webhook
                provider_payment_id: "pay_2",
                submission_state: "SUCCEEDED", // Provider has succeeded
                observation: { state: "SUCCEEDED", amountMinor: "15000", currency: "PHP" },
              },
            ],
          });
        }
        if (sql.includes("UPDATE payrail_private.reconciliation_runs")) {
          return Promise.resolve({
            rows: [
              {
                id: "run-2",
                merchant_id: "merchant_test",
                started_at: new Date(),
                completed_at: new Date(),
                status: "COMPLETED",
                total_records: 1,
                matched_records: 0,
                discrepancy_records: 1,
                summary: {},
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const run = await service.runReconciliation("merchant_test");

      expect(run.discrepancyRecords).toBe(1);

      // Verify automatic safe repair transition to SUCCEEDED
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET state = 'SUCCEEDED'"),
        ["pi-missed-webhook", "AWAITING_PAYMENT"],
      );

      // Verify compensating ledger posting
      expect(mockLedgerService.postPaymentSuccess).toHaveBeenCalledWith(
        "merchant_test",
        "pi-missed-webhook",
        "15000",
        "PHP",
        mockClient,
      );

      // Verify item discrepancy record
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO payrail_private.reconciliation_items"),
        expect.arrayContaining(["STATUS_MISMATCH", "AUTO_REPAIRED"]),
      );
    });

    it("ensures repeated reconciliation runs are idempotent and produce no second financial effect", async () => {
      let localState = "AWAITING_PAYMENT";
      let ledgerPostings = 0;

      mockLedgerService.postPaymentSuccess.mockImplementation(async () => {
        ledgerPostings += 1;
        return { id: "je-recon-1" };
      });

      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT \n           pi.id")) {
          return Promise.resolve({
            rows: [
              {
                id: "pi-repeated-recon",
                merchant_id: "merchant_test",
                amount_minor: "20000",
                currency: "PHP",
                state: localState,
                provider_payment_id: "pay_rep_1",
                submission_state: "SUCCEEDED",
                observation: { state: "SUCCEEDED", amountMinor: "20000", currency: "PHP" },
              },
            ],
          });
        }
        if (sql.includes("SET state = 'SUCCEEDED'")) {
          localState = "SUCCEEDED";
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        if (sql.includes("UPDATE payrail_private.reconciliation_runs")) {
          return Promise.resolve({
            rows: [
              {
                id: "run-rep",
                merchant_id: "merchant_test",
                started_at: new Date(),
                completed_at: new Date(),
                status: "COMPLETED",
                total_records: 1,
                matched_records: localState === "SUCCEEDED" ? 1 : 0,
                discrepancy_records: localState === "SUCCEEDED" ? 0 : 1,
                summary: {},
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      // Run 1: Repairs missed webhook and posts to ledger
      const run1 = await service.runReconciliation("merchant_test");
      expect(run1.status).toBe("COMPLETED");
      expect(ledgerPostings).toBe(1);
      expect(localState).toBe("SUCCEEDED");

      // Run 2: Immediately re-run reconciliation
      const run2 = await service.runReconciliation("merchant_test");
      expect(run2.status).toBe("COMPLETED");
      // Critical Invariant: Zero second ledger posting, zero second financial effect!
      expect(ledgerPostings).toBe(1);
    });
  });
});
