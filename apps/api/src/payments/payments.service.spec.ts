import { describe, expect, it } from "vitest";
import { paymentTransitions, type PaymentState } from "./payments.service";

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
});
