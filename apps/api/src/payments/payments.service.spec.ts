import { describe, expect, it, vi } from "vitest";
import {
  paymentTransitions,
  minorAmount,
  PaymentsService,
  type PaymentState,
} from "./payments.service";

describe("Payment State Transitions Contract", () => {
  it("enforces exact allowed outgoing edges", () => {
    expect(paymentTransitions.CREATED).toEqual(["SUBMISSION_PENDING"]);
    expect(paymentTransitions.SUBMISSION_PENDING).toContain("AWAITING_PAYMENT");
    expect(paymentTransitions.SUBMISSION_PENDING).toContain("SUCCEEDED");
    expect(paymentTransitions.AWAITING_PAYMENT).toContain("SUCCEEDED");
    expect(paymentTransitions.AWAITING_PAYMENT).toContain("FAILED");
  });

  it("strictly enforces SUCCEEDED as a terminal state", () => {
    expect(paymentTransitions.SUCCEEDED).toEqual([]);
    expect(paymentTransitions.SUCCEEDED.length).toBe(0);
  });

  it("permits FAILED and EXPIRED to transition only to authorized recovery or retries", () => {
    expect(paymentTransitions.FAILED).toEqual(["SUBMISSION_PENDING", "SUCCEEDED"]);
    expect(paymentTransitions.EXPIRED).toEqual(["SUBMISSION_PENDING", "SUCCEEDED"]);
  });

  it("blocks arbitrary regression from terminal SUCCEEDED", () => {
    const isAllowed = (from: PaymentState, to: PaymentState) =>
      paymentTransitions[from]?.includes(to) ?? false;

    expect(isAllowed("SUCCEEDED", "FAILED")).toBe(false);
    expect(isAllowed("SUCCEEDED", "EXPIRED")).toBe(false);
    expect(isAllowed("SUCCEEDED", "PROCESSING")).toBe(false);
    expect(isAllowed("SUCCEEDED", "AWAITING_PAYMENT")).toBe(false);
  });

  it("validates minor amount parsing", () => {
    expect(minorAmount("100")).toBe(100n);
    expect(minorAmount("5000")).toBe(5000n);
    expect(() => minorAmount("0")).toThrow();
    expect(() => minorAmount("-100")).toThrow();
    expect(() => minorAmount("abc")).toThrow();
  });

  it("assembles payment investigation records correctly", async () => {
    const mockPool = {
      query: vi.fn().mockImplementation((queryText: string) => {
        if (queryText.includes("FROM payrail_private.payment_intents p")) {
          return Promise.resolve({
            rows: [
              {
                id: "pi_test_123",
                merchant_id: "merchant_test",
                order_id: "ord_123",
                order_number: "PRL-123456",
                amount_minor: "100",
                currency: "PHP",
                state: "SUCCEEDED",
                provider: "paymongo",
                payment_method: "qrph",
                provider_payment_id: "pay_test_123",
                response_body: { qrCodeUrl: "https://qr.test", testUrl: "https://sim.test" },
                evidence_mode: "sandbox",
                created_at: new Date("2026-10-19T00:00:00Z"),
                updated_at: new Date("2026-10-19T00:01:00Z"),
              },
            ],
          });
        }
        if (queryText.includes("FROM payrail_private.payment_state_events")) {
          return Promise.resolve({
            rows: [
              {
                id: "1",
                previousState: "AWAITING_PAYMENT",
                nextState: "SUCCEEDED",
                source: "VERIFIED_WEBHOOK",
                providerEventId: "evt_1",
                createdAt: new Date(),
              },
            ],
          });
        }
        if (queryText.includes("FROM payrail_private.journal_entries")) {
          return Promise.resolve({
            rows: [
              {
                id: "je_1",
                entryNumber: "JE-1",
                referenceType: "PAYMENT",
                referenceId: "pi_test_123",
                description: "Settlement",
                postedAt: new Date(),
                lines: [],
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    };

    const service = new PaymentsService(
      mockPool as unknown as ConstructorParameters<typeof PaymentsService>[0],
      {} as unknown as ConstructorParameters<typeof PaymentsService>[1],
      {} as unknown as ConstructorParameters<typeof PaymentsService>[2],
    );

    const result = await service.getPaymentInvestigation("pi_test_123", "merchant_test");
    expect(result.payment.id).toBe("pi_test_123");
    expect(result.timeline.length).toBe(1);
    expect(result.ledger.length).toBe(1);
    expect(result.payment.orderNumber).toBe("PRL-123456");
  });
});
