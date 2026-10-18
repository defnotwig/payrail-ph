import { describe, it, expect, vi, beforeEach } from "vitest";
import { CardsService } from "./cards.service";
import { CircuitBreakerService } from "../providers/circuit-breaker.service";
import type { DatabasePool } from "../database/database.pool";
import type { LedgerService } from "../ledger/ledger.service";
import { ServiceUnavailableException } from "@nestjs/common";

describe("Cards & Circuit Breaker", () => {
  let cardsService: CardsService;
  let circuitBreaker: CircuitBreakerService;
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
      postPaymentSuccess: vi.fn().mockResolvedValue({ id: "je-card-1" }),
    };
    circuitBreaker = new CircuitBreakerService();
    cardsService = new CardsService(
      mockDb as unknown as DatabasePool,
      circuitBreaker,
      mockLedgerService as unknown as LedgerService,
    );
  });

  describe("Circuit Breaker Behavior", () => {
    it("starts in CLOSED state and allows traffic", () => {
      expect(() => circuitBreaker.checkAvailability("paymongo")).not.toThrow();
    });

    it("trips to OPEN state after 5 consecutive failures and fails fast", () => {
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure("paymongo");
      }

      const metrics = circuitBreaker.getMetrics().find((m) => m.provider === "paymongo");
      expect(metrics?.state).toBe("OPEN");
      expect(() => circuitBreaker.checkAvailability("paymongo")).toThrow(
        ServiceUnavailableException,
      );
    });

    it("recovers to CLOSED state after successful probe in HALF_OPEN", () => {
      circuitBreaker.setCircuitState("paymongo", "HALF_OPEN");
      circuitBreaker.recordSuccess("paymongo");

      const metrics = circuitBreaker.getMetrics().find((m) => m.provider === "paymongo");
      expect(metrics?.state).toBe("CLOSED");
    });
  });

  describe("Card Payment Initiation & 3DS", () => {
    it("initiates frictionless card payment with masked PAN", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await cardsService.initiateCardPayment({
        merchantId: "merchant_test",
        orderNumber: "ORD-CARD-1",
        amountMinor: "50000", // 500 PHP (< 1000 PHP frictionless threshold)
        cardholderName: "Juan Dela Cruz",
        cardNumber: "4111222233334444",
        expMonth: 12,
        expYear: 2028,
        cvc: "123",
        idempotencyKey: "idem_card_1",
      });

      expect(result.state).toBe("SUCCEEDED");
      expect(result.maskedCard).toBe("4111 **** **** 4444");
      expect(result.threeDSecureRequired).toBe(false);
      expect(mockLedgerService.postPaymentSuccess).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("triggers 3-D Secure challenge for payments >= 1,000 PHP", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await cardsService.initiateCardPayment({
        merchantId: "merchant_test",
        orderNumber: "ORD-CARD-2",
        amountMinor: "150000", // 1500 PHP (>= 1000 PHP threshold)
        cardholderName: "Maria Santos",
        cardNumber: "4111222233335555",
        expMonth: 11,
        expYear: 2027,
        cvc: "456",
        idempotencyKey: "idem_card_2",
      });

      expect(result.state).toBe("AWAITING_PAYMENT");
      expect(result.threeDSecureRequired).toBe(true);
      expect(result.threeDSecureUrl).toBeDefined();
    });

    it("resolves 3-D Secure challenge successfully and posts to ledger", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, merchant_id, amount_minor")) {
          return Promise.resolve({
            rows: [
              {
                id: "pi_3ds_test",
                merchant_id: "merchant_test",
                amount_minor: "150000",
                currency: "PHP",
                state: "AWAITING_PAYMENT",
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const outcome = await cardsService.resolve3DSChallenge("pi_3ds_test", "success");

      expect(outcome.state).toBe("SUCCEEDED");
      expect(mockLedgerService.postPaymentSuccess).toHaveBeenCalledWith(
        "merchant_test",
        "pi_3ds_test",
        "150000",
        "PHP",
        mockClient,
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });
  });
});
