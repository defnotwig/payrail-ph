import { describe, expect, it } from "vitest";
import { feePolicy } from "./fee-policy.test-support";

describe("test-only bigint fee policy", () => {
  it("applies fixed and basis-point fees with explicit half-up minor-unit rounding and bounds", () => {
    const policy = feePolicy({
      fixedMinor: 7n,
      basisPoints: 250n,
      minimumMinor: 10n,
      maximumMinor: 100n,
      currency: "PHP",
    });
    expect(policy.calculate(1000n, "PHP")).toBe(32n);
    expect(policy.calculate(1n, "PHP")).toBe(10n);
    expect(policy.calculate(10000n, "PHP")).toBe(100n);
    expect(() => policy.calculate(1000n, "USD")).toThrow(/currency/i);
    expect(() => policy.calculate(-1n, "PHP")).toThrow(/amount/i);
  });
  it("rounds a half minor unit upward with integer arithmetic", () => {
    const policy = feePolicy({
      fixedMinor: 0n,
      basisPoints: 2500n,
      minimumMinor: 0n,
      maximumMinor: 100n,
      currency: "PHP",
    });
    expect(policy.calculate(2n, "PHP")).toBe(1n);
  });
});
