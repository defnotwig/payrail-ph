import { describe, it, expect, vi } from "vitest";
import { RefundsService } from "./refunds.service";
import type { DatabasePool } from "../database/database.pool";
import type { LedgerService } from "../ledger/ledger.service";
import type { PayMongoAdapter } from "../paymongo/paymongo.adapter";
import type { PoolClient } from "pg";
import { ConflictException } from "@nestjs/common";

describe("Refunds Concurrency & Invariants", () => {
  describe("Concurrent Refund Capacity Competition", () => {
    it("serializes concurrent refunds under row locks such that when capacity is exhausted, the competing refund is rejected with 409 Conflict", async () => {
      // Payment total: 10,000 minor units (100 PHP)
      // Two concurrent refund attempts of 6,000 minor units each (total 12,000 > 10,000)
      const paymentTotalMinor = 10000n;
      let activeRefundMinor = 0n;
      let providerCalls = 0;

      const mockAdapter = {
        assertRefundAvailable: vi.fn(),
        createRefund: vi.fn().mockImplementation(async () => {
          providerCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 15));
          return { providerRefundId: `ref_paymongo_${providerCalls}` };
        }),
      } as unknown as PayMongoAdapter;

      const mockLedger = {
        postRefund: vi.fn().mockResolvedValue({ id: "je-ref-1" }),
      } as unknown as LedgerService;

      // In real PostgreSQL, SELECT ... FOR UPDATE serializes access to the payment intent.
      // We simulate this mutex in the mock pool client.
      let isRowLocked = false;
      const waitForRowLock = async () => {
        while (isRowLocked) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        isRowLocked = true;
      };

      const createClient = (): PoolClient => {
        let holdsLock = false;
        return {
          query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes("SELECT request_fingerprint, result_reference")) {
              return { rows: [] };
            }
            if (sql.includes("SELECT id, merchant_id, amount_minor, currency, state")) {
              await waitForRowLock();
              holdsLock = true;
              return {
                rows: [
                  {
                    id: "pi_compete_100",
                    merchant_id: "merchant_test",
                    amount_minor: paymentTotalMinor.toString(),
                    currency: "PHP",
                    state: "SUCCEEDED",
                  },
                ],
              };
            }
            if (sql.includes("SELECT COALESCE(SUM(amount_minor)")) {
              return {
                rows: [{ total_refunded: activeRefundMinor.toString() }],
              };
            }
            if (sql.includes("INSERT INTO payrail_private.refunds")) {
              const amount = BigInt(params?.[3] as string);
              activeRefundMinor += amount;
              return { rowCount: 1, rows: [{ id: "ref_1" }] };
            }
            if (sql.includes("SELECT provider_payment_id FROM payrail_private.payment_attempts")) {
              return { rows: [{ provider_payment_id: "pay_ext_1" }] };
            }
            return { rowCount: 1, rows: [] };
          }),
          release: vi.fn().mockImplementation(() => {
            if (holdsLock) {
              isRowLocked = false;
              holdsLock = false;
            }
          }),
        } as unknown as PoolClient;
      };

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => createClient()),
        query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      } as unknown as DatabasePool;

      const refundsService = new RefundsService(mockPool, mockLedger, mockAdapter);

      // Launch 2 concurrent refund requests competing for the remaining capacity
      const [res1, res2] = await Promise.allSettled([
        refundsService.createRefund({
          merchantId: "merchant_test",
          paymentIntentId: "pi_compete_100",
          amountMinor: "6000",
          reason: "Competitor refund A",
          idempotencyKey: "idem_compete_A",
        }),
        refundsService.createRefund({
          merchantId: "merchant_test",
          paymentIntentId: "pi_compete_100",
          amountMinor: "6000",
          reason: "Competitor refund B",
          idempotencyKey: "idem_compete_B",
        }),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
      const rejected = [res1, res2].filter((r) => r.status === "rejected");

      // Exactly 1 refund succeeded and 1 was rejected with 409 Conflict
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      if (rejected[0]?.status === "rejected") {
        expect(rejected[0].reason).toBeInstanceOf(ConflictException);
        expect(rejected[0].reason.message).toContain("Refund capacity exceeded");
      }

      // Total confirmed refund amount does not exceed payment amount
      expect(activeRefundMinor).toBeLessThanOrEqual(paymentTotalMinor);
      expect(mockLedger.postRefund).toHaveBeenCalledTimes(1);
    });
  });

  describe("Concurrent Same-Key Refund Idempotency", () => {
    it("ensures identical concurrent refund requests execute provider refund once and return same result", async () => {
      let isClaimed = false;
      let existingRefundId: string | null = null;
      let ledgerCalls = 0;

      const mockAdapter = {
        assertRefundAvailable: vi.fn(),
        createRefund: vi.fn().mockResolvedValue({ providerRefundId: "ref_paymongo_same_key" }),
      } as unknown as PayMongoAdapter;

      const mockLedger = {
        postRefund: vi.fn().mockImplementation(async () => {
          ledgerCalls += 1;
          return { id: "je-ref-same-key" };
        }),
      } as unknown as LedgerService;

      let storedFingerprint: string | null = null;
      let isTxLocked = false;
      const acquireTxLock = async () => {
        while (isTxLocked) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        isTxLocked = true;
      };

      const createClient = (): PoolClient => {
        let holdsTx = false;
        return {
          query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql === "BEGIN") {
              await acquireTxLock();
              holdsTx = true;
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes("SELECT request_fingerprint, result_reference")) {
              if (isClaimed && existingRefundId) {
                return {
                  rows: [
                    {
                      request_fingerprint: storedFingerprint,
                      result_reference: existingRefundId,
                      status: "RESOLVED",
                    },
                  ],
                };
              }
              return { rows: [] };
            }
            if (sql.includes("SELECT * FROM payrail_private.refunds WHERE id = $1")) {
              return {
                rows: [
                  {
                    id: existingRefundId,
                    merchant_id: "merchant_test",
                    payment_intent_id: "pi_100",
                    amount_minor: "3000",
                    currency: "PHP",
                    reason: "Duplicate same key request",
                    state: "SUCCEEDED",
                    idempotency_key: "idem_same_key",
                    provider_refund_id: "ref_paymongo_same_key",
                    created_at: new Date(),
                    updated_at: new Date(),
                  },
                ],
              };
            }
            if (sql.includes("SELECT id, merchant_id, amount_minor, currency, state")) {
              return {
                rows: [
                  {
                    id: "pi_100",
                    merchant_id: "merchant_test",
                    amount_minor: "10000",
                    currency: "PHP",
                    state: "SUCCEEDED",
                  },
                ],
              };
            }
            if (sql.includes("SELECT COALESCE(SUM(amount_minor)")) {
              return { rows: [{ total_refunded: "0" }] };
            }
            if (sql.includes("INSERT INTO payrail_private.refunds")) {
              isClaimed = true;
              existingRefundId = params?.[0] as string;
              return { rowCount: 1, rows: [{ id: existingRefundId }] };
            }
            if (sql.includes("INSERT INTO payrail_private.idempotency_records")) {
              storedFingerprint = params?.[2] as string;
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes("SELECT provider_payment_id FROM payrail_private.payment_attempts")) {
              return { rows: [{ provider_payment_id: "pay_ext_1" }] };
            }
            return { rowCount: 1, rows: [] };
          }),
          release: vi.fn().mockImplementation(() => {
            if (holdsTx) {
              isTxLocked = false;
              holdsTx = false;
            }
          }),
        } as unknown as PoolClient;
      };

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => createClient()),
        query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      } as unknown as DatabasePool;

      const refundsService = new RefundsService(mockPool, mockLedger, mockAdapter);

      const [r1, r2] = await Promise.all([
        refundsService.createRefund({
          merchantId: "merchant_test",
          paymentIntentId: "pi_100",
          amountMinor: "3000",
          reason: "Duplicate same key request",
          idempotencyKey: "idem_same_key",
        }),
        refundsService.createRefund({
          merchantId: "merchant_test",
          paymentIntentId: "pi_100",
          amountMinor: "3000",
          reason: "Duplicate same key request",
          idempotencyKey: "idem_same_key",
        }),
      ]);

      expect(r1.id).toBe(r2.id);
      expect(ledgerCalls).toBe(1);
      expect(mockAdapter.createRefund).toHaveBeenCalledTimes(1);
    });
  });
});
