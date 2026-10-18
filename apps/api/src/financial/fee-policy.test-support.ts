export interface TestFeePolicyConfig {
  fixedMinor: bigint;
  basisPoints: bigint;
  minimumMinor: bigint;
  maximumMinor: bigint;
  currency: string;
}

/** Fixture-only arithmetic; it represents no PayMongo or production fees. */
export function feePolicy(config: TestFeePolicyConfig) {
  if (
    config.fixedMinor < 0n ||
    config.basisPoints < 0n ||
    config.minimumMinor < 0n ||
    config.maximumMinor < config.minimumMinor
  ) {
    throw new Error("Invalid fee policy bounds");
  }
  return {
    calculate(amountMinor: bigint, currency: string): bigint {
      if (currency !== config.currency) throw new Error("Fee policy currency mismatch");
      if (amountMinor <= 0n) throw new Error("Fee amount must be positive");
      const variable = (amountMinor * config.basisPoints + 5000n) / 10000n;
      const total = config.fixedMinor + variable;
      return total < config.minimumMinor
        ? config.minimumMinor
        : total > config.maximumMinor
          ? config.maximumMinor
          : total;
    },
  };
}
