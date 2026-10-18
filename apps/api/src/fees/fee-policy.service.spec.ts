import { describe, it, expect, beforeEach } from "vitest";
import { FeePolicyService, type FeeSchedule } from "./fee-policy.service";
import { BadRequestException } from "@nestjs/common";

describe("FeePolicyService (BigInt Pure Accounting)", () => {
  let service: FeePolicyService;

  beforeEach(() => {
    service = new FeePolicyService();
  });

  it("calculates fixed-only fees correctly", () => {
    const schedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 1500n, // ₱15.00 fixed
      basisPoints: 0n,
    };

    const res = service.calculateFee(10000n, "PHP", schedule); // ₱100.00
    expect(res.fixedFeeMinor).toBe(1500n);
    expect(res.variableFeeMinor).toBe(0n);
    expect(res.netFeeMinor).toBe(1500n);
    expect(res.netPayoutMinor).toBe(8500n);
  });

  it("calculates percentage-only (basis points) fees correctly", () => {
    const schedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 0n,
      basisPoints: 150n, // 1.50%
    };

    const res = service.calculateFee(100000n, "PHP", schedule); // ₱1,000.00
    // 100,000 * 150 / 10,000 = 1,500 centavos = ₱15.00
    expect(res.variableFeeMinor).toBe(1500n);
    expect(res.netFeeMinor).toBe(1500n);
    expect(res.netPayoutMinor).toBe(98500n);
  });

  it("calculates combined fixed + percentage fees", () => {
    const schedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 1000n, // ₱10.00
      basisPoints: 200n, // 2.00%
    };

    const res = service.calculateFee(50000n, "PHP", schedule); // ₱500.00
    // Variable = 50,000 * 200 / 10,000 = 1,000 centavos
    // Total = 1,000 + 1,000 = 2,000 centavos = ₱20.00
    expect(res.grossFeeMinor).toBe(2000n);
    expect(res.netFeeMinor).toBe(2000n);
    expect(res.netPayoutMinor).toBe(48000n);
  });

  it("applies minimum fee floor when calculated fee is below threshold", () => {
    const schedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 0n,
      basisPoints: 100n, // 1.00%
      minFeeMinor: 2500n, // Minimum ₱25.00
    };

    // On ₱100.00 (10,000 centavos), 1% is ₱1.00 (100 centavos), should be capped at ₱25.00
    const res = service.calculateFee(10000n, "PHP", schedule);
    expect(res.variableFeeMinor).toBe(100n);
    expect(res.netFeeMinor).toBe(2500n);
    expect(res.appliedCap).toBe("min");
    expect(res.netPayoutMinor).toBe(7500n);
  });

  it("applies maximum fee ceiling when calculated fee exceeds threshold", () => {
    const schedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 0n,
      basisPoints: 200n, // 2.00%
      maxFeeMinor: 50000n, // Maximum ₱500.00
    };

    // On ₱100,000.00 (10,000,000 centavos), 2% is ₱2,000.00 (200,000 centavos), capped at ₱500.00
    const res = service.calculateFee(10000000n, "PHP", schedule);
    expect(res.variableFeeMinor).toBe(200000n);
    expect(res.netFeeMinor).toBe(50000n);
    expect(res.appliedCap).toBe("max");
    expect(res.netPayoutMinor).toBe(9950000n);
  });

  it("honors explicit rounding modes (floor, ceil, round_half_up)", () => {
    // ₱15.55 (1,555 centavos) at 150 bps (1.5%) -> 1,555 * 150 / 10,000 = 233,250 / 10,000 = 23.325
    const baseSchedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 0n,
      basisPoints: 150n,
    };

    const floorRes = service.calculateFee(1555n, "PHP", {
      ...baseSchedule,
      rounding: "floor",
    });
    expect(floorRes.variableFeeMinor).toBe(23n);

    const ceilRes = service.calculateFee(1555n, "PHP", {
      ...baseSchedule,
      rounding: "ceil",
    });
    expect(ceilRes.variableFeeMinor).toBe(24n);

    // 1,570 centavos * 150 / 10,000 = 235,500 / 10,000 = 23.55 (remainder 5500 >= 5000 -> round up)
    const halfUpRes = service.calculateFee(1570n, "PHP", {
      ...baseSchedule,
      rounding: "round_half_up",
    });
    expect(halfUpRes.variableFeeMinor).toBe(24n);
  });

  it("handles very large institutional amounts without numeric overflow", () => {
    const schedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 5000n,
      basisPoints: 120n, // 1.20%
    };

    // ₱500,000,000.00 (50,000,000,000 centavos)
    const largeAmount = 50000000000n;
    const res = service.calculateFee(largeAmount, "PHP", schedule);
    // Variable = 50,000,000,000 * 120 / 10,000 = 600,000,000 centavos = ₱6,000,000.00
    expect(res.variableFeeMinor).toBe(600000000n);
    expect(res.netFeeMinor).toBe(600005000n);
    expect(res.netPayoutMinor).toBe(largeAmount - 600005000n);
  });

  it("returns zero fees on zero amount transaction", () => {
    const schedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 1500n,
      basisPoints: 200n,
    };

    const res = service.calculateFee(0n, "PHP", schedule);
    expect(res.netFeeMinor).toBe(0n);
    expect(res.netPayoutMinor).toBe(0n);
  });

  it("throws BadRequestException on currency mismatch", () => {
    const schedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 1000n,
      basisPoints: 100n,
    };

    expect(() => service.calculateFee(5000n, "USD", schedule)).toThrow(BadRequestException);
  });

  it("throws BadRequestException on negative amount", () => {
    const schedule: FeeSchedule = {
      currency: "PHP",
      fixedMinor: 1000n,
      basisPoints: 100n,
    };

    expect(() => service.calculateFee(-500n, "PHP", schedule)).toThrow(BadRequestException);
  });
});
