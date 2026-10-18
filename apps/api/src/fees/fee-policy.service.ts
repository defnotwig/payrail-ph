import { BadRequestException, Injectable } from "@nestjs/common";

export interface FeeSchedule {
  currency: string;
  fixedMinor: bigint;
  basisPoints: bigint; // 100 bps = 1.00%
  minFeeMinor?: bigint | undefined;
  maxFeeMinor?: bigint | undefined;
  rounding?: "floor" | "ceil" | "round_half_up" | undefined;
}

export interface CalculateFeeResult {
  amountMinor: bigint;
  currency: string;
  variableFeeMinor: bigint;
  fixedFeeMinor: bigint;
  grossFeeMinor: bigint;
  netFeeMinor: bigint;
  netPayoutMinor: bigint;
  appliedCap?: "min" | "max" | undefined;
}

@Injectable()
export class FeePolicyService {
  /**
   * Calculates provider-neutral payment fees using pure BigInt arithmetic.
   * Prohibits IEEE 754 floating-point numbers to guarantee mathematical integrity.
   */
  calculateFee(amountMinor: bigint, currency: string, schedule: FeeSchedule): CalculateFeeResult {
    if (currency.toUpperCase() !== schedule.currency.toUpperCase()) {
      throw new BadRequestException(
        `Currency mismatch: fee schedule currency '${schedule.currency}' does not match transaction currency '${currency}'`,
      );
    }

    if (amountMinor < 0n) {
      throw new BadRequestException("Amount cannot be negative");
    }

    if (amountMinor === 0n) {
      return {
        amountMinor: 0n,
        currency,
        variableFeeMinor: 0n,
        fixedFeeMinor: 0n,
        grossFeeMinor: 0n,
        netFeeMinor: 0n,
        netPayoutMinor: 0n,
      };
    }

    // Variable Fee = (amount * basisPoints) / 10,000
    const basisPointsNumerator = amountMinor * schedule.basisPoints;
    const denominator = 10000n;
    const rounding = schedule.rounding || "round_half_up";

    let variableFeeMinor: bigint;
    const remainder = basisPointsNumerator % denominator;
    const integerDiv = basisPointsNumerator / denominator;

    if (remainder === 0n) {
      variableFeeMinor = integerDiv;
    } else if (rounding === "floor") {
      variableFeeMinor = integerDiv;
    } else if (rounding === "ceil") {
      variableFeeMinor = integerDiv + 1n;
    } else {
      // round_half_up: if remainder >= 5,000, round up
      variableFeeMinor = remainder >= 5000n ? integerDiv + 1n : integerDiv;
    }

    const fixedFeeMinor = schedule.fixedMinor;
    const grossFeeMinor = variableFeeMinor + fixedFeeMinor;
    let netFeeMinor = grossFeeMinor;
    let appliedCap: "min" | "max" | undefined;

    if (schedule.minFeeMinor !== undefined && netFeeMinor < schedule.minFeeMinor) {
      netFeeMinor = schedule.minFeeMinor;
      appliedCap = "min";
    }

    if (schedule.maxFeeMinor !== undefined && netFeeMinor > schedule.maxFeeMinor) {
      netFeeMinor = schedule.maxFeeMinor;
      appliedCap = "max";
    }

    const netPayoutMinor = amountMinor > netFeeMinor ? amountMinor - netFeeMinor : 0n;

    return {
      amountMinor,
      currency,
      variableFeeMinor,
      fixedFeeMinor,
      grossFeeMinor,
      netFeeMinor,
      netPayoutMinor,
      appliedCap,
    };
  }
}
