import { describe, it, expect, vi, beforeAll } from "vitest";
import { PaymentsService, type PaymentObservation } from "./payments.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import type { DatabasePool } from "../database/database.pool";
import type { LedgerService } from "../ledger/ledger.service";
import type { PayMongoAdapter } from "../paymongo/paymongo.adapter";
import type { PoolClient } from "pg";
import { createHmac } from "node:crypto";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://localhost:5432/test";
  process.env.WEB_ORIGIN = "http://localhost:3000";
  process.env.PAYMONGO_WEBHOOK_SECRET = "whsk_test_placeholder";
});

describe("Payments & Webhooks Concurrency & Invariants", () => {
  describe("Same-Key Concurrent Payment Requests", () => {
    it("ensures 10 simultaneous requests with the same idempotency key result in only 1 charge-producing attempt", async () => {
      let isClaimed = false;
      let chargeCalls = 0;
      let storedFingerprint = "";
      const idempotencyKey = "idem_concurrent_payment_test";
      const paymentIntentId = "pi_concurrent_123";

      const mockAdapter = {
        mode: "fixture",
        account: "sandbox",
        assertAvailable: vi.fn(),
        createQrPhPayment: vi.fn().mockImplementation(async () => {
          chargeCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            providerPaymentIntentId: "pi_paymongo_concurrent_123",
            providerPaymentMethodId: "pm_paymongo_concurrent_123",
            qrCodeUrl: "https://test.payrail.ph/qr/123",
            testUrl: "https://test-paymongo.payrail.ph/simulate/123",
          };
        }),
      } as unknown as PayMongoAdapter;

      const mockLedger = {
        postPaymentSuccess: vi.fn().mockResolvedValue({ id: "je-1" }),
      } as unknown as LedgerService;

      let isTxLocked = false;
      const acquireTxLock = async () => {
        while (isTxLocked) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        isTxLocked = true;
      };

      const createMockClient = (): PoolClient => {
        let holdsTx = false;
        let localClaimedInTx = false;
        return {
          query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql === "BEGIN") {
              await acquireTxLock();
              holdsTx = true;
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes("INSERT INTO payrail_private.idempotency_records")) {
              if (!isClaimed) {
                isClaimed = true;
                localClaimedInTx = true;
                storedFingerprint = params?.[2] as string;
                return { rowCount: 1, rows: [{ merchant_id: "merchant_test" }] };
              }
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes("SELECT * FROM payrail_private.idempotency_records")) {
              return {
                rows: [
                  {
                    merchant_id: "merchant_test",
                    operation: "CREATE_QRPH_PAYMENT",
                    idempotency_key: idempotencyKey,
                    request_fingerprint: storedFingerprint,
                    result_reference: localClaimedInTx ? undefined : paymentIntentId,
                    status: localClaimedInTx ? "PENDING" : "RESOLVED",
                  },
                ],
              };
            }
            if (sql.includes("SELECT state FROM payrail_private.payment_intents")) {
              return { rows: [{ state: "SUBMISSION_PENDING" }] };
            }
            return { rowCount: 1, rows: [{ id: paymentIntentId }] };
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
        connect: vi.fn().mockImplementation(async () => createMockClient()),
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("SELECT p.*,o.order_number")) {
            return {
              rows: [
                {
                  id: paymentIntentId,
                  merchant_id: "merchant_test",
                  order_id: "ord_1",
                  order_number: "ORD-1",
                  amount_minor: "15000",
                  currency: "PHP",
                  state: "AWAITING_PAYMENT",
                  provider: "paymongo",
                  payment_method: "qrph",
                  provider_payment_id: "pi_paymongo_concurrent_123",
                  response_body: {
                    qrCodeUrl: "https://test.payrail.ph/qr/123",
                    testUrl: "https://test-paymongo.payrail.ph/simulate/123",
                  },
                  evidence_mode: "fixture",
                  created_at: new Date(),
                  updated_at: new Date(),
                },
              ],
            };
          }
          return { rowCount: 1, rows: [] };
        }),
      } as unknown as DatabasePool;

      const paymentsService = new PaymentsService(mockPool, mockAdapter, mockLedger);

      // Execute 10 concurrent payment requests with the identical idempotency key
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          paymentsService.createQrPhPayment(
            {
              merchantId: "merchant_test",
              amountMinor: "15000",
              orderNumber: "ORD-1",
              currency: "PHP",
            },
            idempotencyKey,
          ),
        ),
      );

      // Exactly 1 provider charge call was initiated
      expect(chargeCalls).toBe(1);
      expect(mockAdapter.createQrPhPayment).toHaveBeenCalledTimes(1);

      // All 10 requests safely returned the exact same payment intent
      expect(results).toHaveLength(10);
      for (const res of results) {
        expect(res.id).toBe(paymentIntentId);
      }
    });
  });

  describe("Duplicate Webhook Storm", () => {
    it("safely handles 10x simultaneous duplicate webhooks with exactly 1 processed and 9 deduplicated", async () => {
      const processedEventIds = new Set<string>();
      let ledgerPostings = 0;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => {
          return {
            query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
              if (sql.includes("SELECT id FROM payrail_private.provider_events")) {
                const eventId = params?.[2] as string;
                if (processedEventIds.has(eventId)) {
                  return { rows: [{ id: "existing_event" }] };
                }
                return { rows: [] };
              }
              if (sql.includes("INSERT INTO payrail_private.provider_events")) {
                const eventId = params?.[3] as string;
                if (processedEventIds.has(eventId)) {
                  return { rowCount: 0, rows: [] };
                }
                processedEventIds.add(eventId);
                return { rowCount: 1, rows: [{ id: "internal_evt_1" }] };
              }
              if (sql.includes("SELECT p.id,p.merchant_id FROM payrail_private.payment_intents")) {
                return {
                  rows: [{ id: "pi_webhook_test", merchant_id: "merchant_test" }],
                };
              }
              if (
                sql.includes("SELECT amount_minor,currency FROM payrail_private.payment_intents")
              ) {
                return {
                  rows: [{ amount_minor: "25000", currency: "PHP" }],
                };
              }
              if (
                sql.includes("SELECT p.*,a.id AS attempt_id FROM payrail_private.payment_intents")
              ) {
                return {
                  rows: [
                    {
                      id: "pi_webhook_test",
                      merchant_id: "merchant_test",
                      amount_minor: "25000",
                      currency: "PHP",
                      state: "AWAITING_PAYMENT",
                      attempt_id: "att_1",
                    },
                  ],
                };
              }
              return { rowCount: 1, rows: [] };
            }),
            release: vi.fn(),
          } as unknown as PoolClient;
        }),
        query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      } as unknown as DatabasePool;

      const mockLedger = {
        postPaymentSuccess: vi.fn().mockImplementation(async () => {
          ledgerPostings += 1;
          return { id: "je-wh-1" };
        }),
      } as unknown as LedgerService;

      const mockAdapter = {
        account: "sandbox",
        mode: "fixture",
      } as unknown as PayMongoAdapter;

      const paymentsService = new PaymentsService(mockPool, mockAdapter, mockLedger);
      const webhooksService = new WebhooksService(mockPool, paymentsService, mockAdapter);

      const eventId = "evt_paymongo_storm_999";
      const webhookSecret = "whsk_test_placeholder";
      const body = JSON.stringify({
        data: {
          id: eventId,
          type: "event",
          attributes: {
            type: "payment.paid",
            data: {
              id: "pay_storm_1",
              type: "payment",
              attributes: {
                payment_intent_id: "pi_paymongo_target",
                status: "paid",
                amount: 25000,
                currency: "PHP",
              },
            },
          },
        },
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac("sha256", webhookSecret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      const signatureHeader = `t=${timestamp},te=${signature}`;

      // Simulate 10 simultaneous webhook arrivals
      const deliveries = await Promise.all(
        Array.from({ length: 10 }, () =>
          webhooksService.processPayMongoWebhook(body, signatureHeader),
        ),
      );

      const processed = deliveries.filter((d) => d.processed);
      const deduplicated = deliveries.filter((d) => d.deduplicated);

      expect(processed).toHaveLength(1);
      expect(deduplicated).toHaveLength(9);
      expect(ledgerPostings).toBe(1);
    });
  });

  describe("Out-of-Order Webhook Delivery", () => {
    it("does not regress payment state or post duplicate ledger entries when FAILED observation arrives after SUCCEEDED", async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("SELECT p.*,a.id AS attempt_id FROM payrail_private.payment_intents")) {
            return {
              rows: [
                {
                  id: "pi_terminal_check",
                  merchant_id: "merchant_test",
                  amount_minor: "10000",
                  currency: "PHP",
                  state: "SUCCEEDED", // Already in terminal SUCCEEDED state
                  attempt_id: "att_term_1",
                },
              ],
            };
          }
          return { rowCount: 1, rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockLedger = {
        postPaymentSuccess: vi.fn(),
      } as unknown as LedgerService;

      const mockAdapter = {
        account: "sandbox",
      } as unknown as PayMongoAdapter;

      const paymentsService = new PaymentsService(
        {} as unknown as DatabasePool,
        mockAdapter,
        mockLedger,
      );

      const outOfOrderObservation: PaymentObservation = {
        paymentIntentId: "pi_terminal_check",
        merchantId: "merchant_test",
        provider: "paymongo",
        providerAccount: "sandbox",
        environment: "test",
        providerPaymentIntentId: "pi_ext_123",
        amountMinor: "10000",
        currency: "PHP",
        state: "FAILED", // Out-of-order delayed failure event
        source: "VERIFIED_WEBHOOK",
      };

      const result = await paymentsService.applyObservationInTransaction(
        mockClient,
        outOfOrderObservation,
      );

      // State transition is refused
      expect(result.transitioned).toBe(false);
      expect(result.currentState).toBe("SUCCEEDED");

      // No ledger entry or status regression executed
      expect(mockLedger.postPaymentSuccess).not.toHaveBeenCalled();
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining("UPDATE payrail_private.payment_intents SET state='FAILED'"),
        expect.anything(),
      );
    });
  });
});
