import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefundsService } from "./refunds.service";
import type { DatabasePool } from "../database/database.pool";
import type { LedgerService } from "../ledger/ledger.service";
import type { PayMongoAdapter } from "../paymongo/paymongo.adapter";
import { BadRequestException, ConflictException } from "@nestjs/common";

describe("RefundsService", () => {
  let service: RefundsService;
  let mockDb: { connect: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let mockLedgerService: { postRefund: ReturnType<typeof vi.fn> };
  let mockPayMongoAdapter: Record<string, unknown>;

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
      postRefund: vi.fn().mockResolvedValue({ id: "je-ref-1" }),
    };
    mockPayMongoAdapter = {
      assertRefundAvailable: vi.fn(),
      createRefund: vi.fn().mockResolvedValue({ providerRefundId: "ref_paymongo_123" }),
    };
    service = new RefundsService(
      mockDb as unknown as DatabasePool,
      mockLedgerService as unknown as LedgerService,
      mockPayMongoAdapter as unknown as PayMongoAdapter,
    );
  });

  describe("Capacity & Financial Invariants", () => {
    it("rejects non-positive refund amounts", async () => {
      await expect(
        service.createRefund({
          merchantId: "merchant_test",
          paymentIntentId: "pi_100",
          amountMinor: "0",
          reason: "Customer request",
          idempotencyKey: "idem_1",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects refunds on non-succeeded payments", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, request_fingerprint")) {
          return Promise.resolve({ rows: [] }); // No existing idempotency
        }
        if (sql.includes("SELECT id, merchant_id, amount_minor")) {
          return Promise.resolve({
            rows: [
              {
                id: "pi_100",
                merchant_id: "merchant_test",
                amount_minor: "10000",
                currency: "PHP",
                state: "AWAITING_PAYMENT", // Non-succeeded state
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        service.createRefund({
          merchantId: "merchant_test",
          paymentIntentId: "pi_100",
          amountMinor: "5000",
          reason: "Customer request",
          idempotencyKey: "idem_1",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects refund when requested amount exceeds available capacity", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, request_fingerprint")) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes("SELECT id, merchant_id, amount_minor")) {
          return Promise.resolve({
            rows: [
              {
                id: "pi_100",
                merchant_id: "merchant_test",
                amount_minor: "10000", // 100 PHP total payment
                currency: "PHP",
                state: "SUCCEEDED",
              },
            ],
          });
        }
        if (sql.includes("SELECT COALESCE(SUM(amount_minor)")) {
          return Promise.resolve({
            rows: [{ total_refunded: "8000" }], // 80 PHP already refunded/reserved
          });
        }
        return Promise.resolve({ rows: [] });
      });

      // Attempting to refund 30 PHP when only 20 PHP capacity remains
      await expect(
        service.createRefund({
          merchantId: "merchant_test",
          paymentIntentId: "pi_100",
          amountMinor: "3000",
          reason: "Partial refund",
          idempotencyKey: "idem_1",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("successfully creates refund within capacity and posts to ledger", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, request_fingerprint")) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes("SELECT id, merchant_id, amount_minor")) {
          return Promise.resolve({
            rows: [
              {
                id: "pi_100",
                merchant_id: "merchant_test",
                amount_minor: "10000", // 100 PHP
                currency: "PHP",
                state: "SUCCEEDED",
              },
            ],
          });
        }
        if (sql.includes("SELECT COALESCE(SUM(amount_minor)")) {
          return Promise.resolve({
            rows: [{ total_refunded: "0" }], // Zero prior refunds
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const refund = await service.createRefund({
        merchantId: "merchant_test",
        paymentIntentId: "pi_100",
        amountMinor: "5000", // 50 PHP refund
        reason: "Customer satisfaction",
        idempotencyKey: "idem_1",
      });

      expect(refund.state).toBe("SUCCEEDED");
      expect(refund.amountMinor).toBe("5000");
      expect(refund.providerRefundId).toBeDefined();
      expect(mockLedgerService.postRefund).toHaveBeenCalledWith(
        "merchant_test",
        expect.any(String),
        "5000",
        "PHP",
        mockClient,
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });
  });

  describe("Idempotency Invariant", () => {
    it("detects payload mismatch and throws 409 Conflict", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("FROM payrail_private.idempotency_records")) {
          return Promise.resolve({
            rows: [
              {
                request_fingerprint: "different_hash_value",
                result_reference: "ref-1",
                status: "SUCCESS",
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        service.createRefund({
          merchantId: "merchant_test",
          paymentIntentId: "pi_100",
          amountMinor: "5000",
          reason: "Payload drift",
          idempotencyKey: "idem_reused",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
