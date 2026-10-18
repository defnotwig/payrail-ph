import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitMetrics {
  provider: string;
  state: CircuitState;
  consecutiveFailures: number;
  totalCalls: number;
  totalFailures: number;
  lastFailureTime?: number | undefined;
  lastSuccessTime?: number | undefined;
  openUntil?: number | undefined;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  private readonly failureThreshold = 5; // 5 consecutive failures trips circuit
  private readonly recoveryTimeoutMs = 15_000; // 15 seconds in OPEN state before HALF_OPEN probe

  private readonly circuits = new Map<string, CircuitMetrics>();

  constructor() {
    this.initProvider("paymongo");
    this.initProvider("xendit");
  }

  private initProvider(provider: string): void {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        provider,
        state: "CLOSED",
        consecutiveFailures: 0,
        totalCalls: 0,
        totalFailures: 0,
      });
    }
  }

  /**
   * Asserts whether a provider is available for new outbound requests.
   * If OPEN and within recovery timeout: throws ServiceUnavailableException immediately (fail fast).
   * If OPEN and past recovery timeout: transitions to HALF_OPEN to allow single probe request.
   */
  checkAvailability(provider: string): void {
    const circuit = this.circuits.get(provider);
    if (!circuit) return;

    const now = Date.now();

    if (circuit.state === "OPEN") {
      if (circuit.openUntil && now < circuit.openUntil) {
        throw new ServiceUnavailableException(
          `Circuit breaker is OPEN for provider '${provider}'. Upstream API is degraded. Failing fast.`,
        );
      }
      // Transition to HALF_OPEN to test upstream recovery
      circuit.state = "HALF_OPEN";
      this.logger.warn(
        `Circuit breaker for '${provider}' transitioned from OPEN to HALF_OPEN (probing).`,
      );
    }
  }

  /**
   * Records a successful provider request.
   */
  recordSuccess(provider: string): void {
    this.initProvider(provider);
    const circuit = this.circuits.get(provider);
    if (!circuit) return;
    circuit.totalCalls++;
    circuit.consecutiveFailures = 0;
    circuit.lastSuccessTime = Date.now();

    if (circuit.state === "HALF_OPEN") {
      circuit.state = "CLOSED";
      circuit.openUntil = undefined;
      this.logger.log(`Circuit breaker for '${provider}' recovered to CLOSED state.`);
    }
  }

  /**
   * Records a failed provider request.
   */
  recordFailure(provider: string): void {
    this.initProvider(provider);
    const circuit = this.circuits.get(provider);
    if (!circuit) return;
    circuit.totalCalls++;
    circuit.totalFailures++;
    circuit.consecutiveFailures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === "HALF_OPEN" || circuit.consecutiveFailures >= this.failureThreshold) {
      circuit.state = "OPEN";
      circuit.openUntil = Date.now() + this.recoveryTimeoutMs;
      this.logger.error(
        `Circuit breaker for '${provider}' TRIPPED to OPEN state! Next probe in ${this.recoveryTimeoutMs / 1000}s.`,
      );
    }
  }

  /**
   * Returns metrics for all tracked provider circuits.
   */
  getMetrics(): CircuitMetrics[] {
    return Array.from(this.circuits.values());
  }

  /**
   * Allows manual chaos/diagnostic override for reliability tests.
   */
  setCircuitState(provider: string, state: CircuitState, durationSeconds = 30): void {
    this.initProvider(provider);
    const circuit = this.circuits.get(provider);
    if (!circuit) return;
    circuit.state = state;
    if (state === "OPEN") {
      circuit.openUntil = Date.now() + durationSeconds * 1000;
    } else {
      circuit.openUntil = undefined;
      circuit.consecutiveFailures = 0;
    }
  }
}
