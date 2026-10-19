/**
 * PayRail PH — Operations Experience V4 Health Evaluator
 * Evaluates truthful health status and computes aggregated system status.
 *
 * Epistemic Rules:
 * 1. Health requires fresh, verifiable telemetry. Never default to HEALTHY.
 * 2. If API is disconnected, downstream components (DB, PayMongo, Worker, Queue) are UNKNOWN.
 * 3. Nominal banner appears ONLY when all 7 subsystems are verified HEALTHY, DLQ is 0,
 *    unverified webhooks is 0, and the double-entry ledger is balanced.
 */

import type {
  AggregatedBanner,
  AggregatedSystemHealth,
  ComponentHealth,
  HealthStatus,
  ObservationSource,
  TelemetryFreshness,
} from "./types";

// biome-ignore lint/complexity/noStaticOnlyClass: Institutional domain state machine
export class HealthEvaluator {
  public static readonly TTL_ACTIVE_PROBE_MS = 30_000;
  public static readonly TTL_PASSIVE_WINDOW_MS = 900_000;
  public static readonly TTL_HEARTBEAT_MS = 60_000;

  /**
   * Constructs disconnected state when API Gateway cannot be contacted from Web Client.
   */
  public static buildApiDisconnectedState(
    now: number,
    errorDetail: string,
  ): AggregatedSystemHealth {
    const evaluatedAt = new Date(now).toISOString();
    const disconnectedFreshness: TelemetryFreshness = {
      observedAt: evaluatedAt,
      freshnessMs: 0,
      maxTtlMs: HealthEvaluator.TTL_ACTIVE_PROBE_MS,
      isFresh: false,
      observationSource: "DEPENDENT_UNKNOWN",
    };

    return {
      globalStatus: "UNAVAILABLE",
      evaluatedAt,
      vantagePoint: "CLIENT_BROWSER",
      banner: {
        variant: "UNAVAILABLE",
        headline: "Service disruption detected",
        subtitle: "The operations console cannot communicate with the PayRail Core API Gateway.",
        details: [
          "HTTP gateway connection failed or timed out.",
          "Health status for Database, PayMongo, Webhooks, and Worker daemons cannot be verified.",
          `Detail: ${errorDetail}`,
        ],
      },
      components: {
        web: {
          id: "web",
          displayName: "Operations Web Console",
          status: "HEALTHY",
          statusReason: "Browser client runtime active",
          telemetry: {
            routeLatencyMs: 0,
            browserOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
          },
          freshness: {
            observedAt: evaluatedAt,
            freshnessMs: 0,
            maxTtlMs: 30_000,
            isFresh: true,
            observationSource: "DIRECT_PROBE",
          },
        },
        api: {
          id: "api",
          displayName: "Core API Gateway",
          status: "UNAVAILABLE",
          statusReason: `Unreachable: ${errorDetail}`,
          telemetry: {
            gatewayLatencyMs: -1,
            uptimeSeconds: 0,
            activeRequests: 0,
            memoryUsageBytes: 0,
          },
          freshness: {
            observedAt: evaluatedAt,
            freshnessMs: 0,
            maxTtlMs: 30_000,
            isFresh: true,
            observationSource: "DIRECT_PROBE",
          },
        },
        database: {
          id: "database",
          displayName: "PostgreSQL Database",
          status: "UNKNOWN",
          statusReason: "Unobserved: Communication with API Gateway is severed",
          telemetry: {
            queryLatencyMs: -1,
            poolTotal: 0,
            poolIdle: 0,
            poolWaiting: 0,
            activeConnections: 0,
          },
          freshness: disconnectedFreshness,
        },
        paymongo: {
          id: "paymongo",
          displayName: "PayMongo Rail (QR Ph & Gateway)",
          status: "UNKNOWN",
          statusReason: "Unobserved: Communication with API Gateway is severed",
          telemetry: {
            circuitState: "CLOSED",
            totalAttemptsWindow: 0,
            failedAttemptsWindow: 0,
            failureRate: 0,
            lastSuccessTimestamp: null,
            lastFailureTimestamp: null,
            p95ProviderRoundtripMs: null,
          },
          freshness: disconnectedFreshness,
        },
        webhook_ingestion: {
          id: "webhook_ingestion",
          displayName: "Webhook Ingestion Pipeline",
          status: "UNKNOWN",
          statusReason: "Unobserved: Communication with API Gateway is severed",
          telemetry: {
            windowSeconds: 900,
            totalReceived: 0,
            unverifiedSignatures: 0,
            processingFailures: 0,
            lastWebhookReceivedAt: null,
          },
          freshness: disconnectedFreshness,
        },
        worker: {
          id: "worker",
          displayName: "Background Worker Daemons",
          status: "UNKNOWN",
          statusReason: "Unobserved: Communication with API Gateway is severed",
          telemetry: {
            activeWorkers: 0,
            lastHeartbeatAt: null,
            heartbeatAgeMs: null,
            runningJobCount: 0,
          },
          freshness: disconnectedFreshness,
        },
        queue_jobs: {
          id: "queue_jobs",
          displayName: "Queue & Durable Jobs Engine",
          status: "UNKNOWN",
          statusReason: "Unobserved: Communication with API Gateway is severed",
          telemetry: {
            pendingJobs: 0,
            claimedJobs: 0,
            overdueJobs: 0,
            dlqUnresolvedCount: 0,
            oldestPendingJobAgeSeconds: null,
          },
          freshness: disconnectedFreshness,
        },
      },
      metrics: {
        dlqUnresolvedCount: 0,
        unverifiedWebhooksCount: 0,
        ledgerBalanced: false,
        confirmationLatencyP95Ms: null,
        confirmationLatencyP50Ms: null,
      },
    };
  }

  /**
   * Evaluates Database health based on active ping and pool telemetry.
   */
  public static evaluateDatabase(
    now: number,
    dbCheck: {
      success: boolean;
      latencyMs: number;
      pool: { total: number; idle: number; waiting: number };
    } | null,
    observedAt: string,
  ): ComponentHealth<"database"> {
    if (!dbCheck) {
      return {
        id: "database",
        displayName: "PostgreSQL Database",
        status: "UNKNOWN",
        statusReason: "No database probe telemetry received",
        telemetry: {
          queryLatencyMs: -1,
          poolTotal: 0,
          poolIdle: 0,
          poolWaiting: 0,
          activeConnections: 0,
        },
        freshness: HealthEvaluator.makeFreshness(
          now,
          observedAt,
          HealthEvaluator.TTL_ACTIVE_PROBE_MS,
          "UNINITIALIZED",
        ),
      };
    }

    const freshness = HealthEvaluator.makeFreshness(
      now,
      observedAt,
      HealthEvaluator.TTL_ACTIVE_PROBE_MS,
      "DIRECT_PROBE",
    );
    if (!freshness.isFresh) {
      return {
        id: "database",
        displayName: "PostgreSQL Database",
        status: "UNKNOWN",
        statusReason: `Database telemetry expired (${Math.round(freshness.freshnessMs / 1000)}s old)`,
        telemetry: {
          poolTotal: dbCheck.pool.total,
          poolIdle: dbCheck.pool.idle,
          poolWaiting: dbCheck.pool.waiting,
          queryLatencyMs: dbCheck.latencyMs,
          activeConnections: dbCheck.pool.total - dbCheck.pool.idle,
        },
        freshness,
      };
    }

    if (!dbCheck.success) {
      return {
        id: "database",
        displayName: "PostgreSQL Database",
        status: "UNAVAILABLE",
        statusReason: "Database query probe failed (SELECT 1 connection error)",
        telemetry: {
          poolTotal: dbCheck.pool.total,
          poolIdle: dbCheck.pool.idle,
          poolWaiting: dbCheck.pool.waiting,
          queryLatencyMs: dbCheck.latencyMs,
          activeConnections: dbCheck.pool.total - dbCheck.pool.idle,
        },
        freshness,
      };
    }

    if (dbCheck.latencyMs > 2000 || dbCheck.pool.waiting > 10) {
      return {
        id: "database",
        displayName: "PostgreSQL Database",
        status: "DEGRADED",
        statusReason: `Elevated connection pressure (Latency: ${dbCheck.latencyMs}ms, Waiting: ${dbCheck.pool.waiting})`,
        telemetry: {
          poolTotal: dbCheck.pool.total,
          poolIdle: dbCheck.pool.idle,
          poolWaiting: dbCheck.pool.waiting,
          queryLatencyMs: dbCheck.latencyMs,
          activeConnections: dbCheck.pool.total - dbCheck.pool.idle,
        },
        freshness,
      };
    }

    return {
      id: "database",
      displayName: "PostgreSQL Database",
      status: "HEALTHY",
      statusReason: `Operational (Ping: ${dbCheck.latencyMs}ms, Pool: ${dbCheck.pool.total})`,
      telemetry: {
        poolTotal: dbCheck.pool.total,
        poolIdle: dbCheck.pool.idle,
        poolWaiting: dbCheck.pool.waiting,
        queryLatencyMs: dbCheck.latencyMs,
        activeConnections: dbCheck.pool.total - dbCheck.pool.idle,
      },
      freshness,
    };
  }

  /**
   * Evaluates PayMongo upstream health based on circuit breaker & telemetry window.
   */
  public static evaluatePayMongo(
    now: number,
    circuit: {
      state: "CLOSED" | "OPEN" | "HALF_OPEN";
      lastFailure?: number;
      lastSuccess?: number;
    } | null,
    attempts: { total: number; failed: number; p95Ms: number | null },
    observedAt: string,
  ): ComponentHealth<"paymongo"> {
    const freshness = HealthEvaluator.makeFreshness(
      now,
      observedAt,
      HealthEvaluator.TTL_PASSIVE_WINDOW_MS,
      "TELEMETRY_WINDOW",
    );

    if (!circuit || !freshness.isFresh) {
      return {
        id: "paymongo",
        displayName: "PayMongo Rail (QR Ph & Gateway)",
        status: "UNKNOWN",
        statusReason: "Provider telemetry missing or expired",
        telemetry: {
          circuitState: circuit?.state ?? "CLOSED",
          totalAttemptsWindow: 0,
          failedAttemptsWindow: 0,
          failureRate: 0,
          lastSuccessTimestamp: null,
          lastFailureTimestamp: null,
          p95ProviderRoundtripMs: null,
        },
        freshness,
      };
    }

    const failureRate = attempts.total > 0 ? (attempts.failed / attempts.total) * 100 : 0;
    const telemetry = {
      circuitState: circuit.state,
      totalAttemptsWindow: attempts.total,
      failedAttemptsWindow: attempts.failed,
      failureRate: Math.round(failureRate * 10) / 10,
      lastSuccessTimestamp: circuit.lastSuccess
        ? new Date(circuit.lastSuccess).toISOString()
        : null,
      lastFailureTimestamp: circuit.lastFailure
        ? new Date(circuit.lastFailure).toISOString()
        : null,
      p95ProviderRoundtripMs: attempts.p95Ms,
    };

    if (circuit.state === "OPEN") {
      return {
        id: "paymongo",
        displayName: "PayMongo Rail (QR Ph & Gateway)",
        status: "UNAVAILABLE",
        statusReason: "Circuit breaker is OPEN. Fast-failing outbound upstream requests.",
        telemetry,
        freshness,
      };
    }

    if (circuit.state === "HALF_OPEN") {
      return {
        id: "paymongo",
        displayName: "PayMongo Rail (QR Ph & Gateway)",
        status: "DEGRADED",
        statusReason: "Circuit breaker is HALF_OPEN (probing recovery).",
        telemetry,
        freshness,
      };
    }

    if (attempts.total >= 5 && failureRate >= 10) {
      return {
        id: "paymongo",
        displayName: "PayMongo Rail (QR Ph & Gateway)",
        status: "DEGRADED",
        statusReason: `High gateway error rate (${telemetry.failureRate}% of ${attempts.total} attempts failed)`,
        telemetry,
        freshness,
      };
    }

    if (attempts.total === 0 && !circuit.lastSuccess) {
      return {
        id: "paymongo",
        displayName: "PayMongo Rail (QR Ph & Gateway)",
        status: "UNKNOWN",
        statusReason: "No upstream payment traffic observed in active telemetry window",
        telemetry,
        freshness,
      };
    }

    return {
      id: "paymongo",
      displayName: "PayMongo Rail (QR Ph & Gateway)",
      status: "HEALTHY",
      statusReason: `Normal operational status (${attempts.total} attempts, ${telemetry.failureRate}% failure rate)`,
      telemetry,
      freshness,
    };
  }

  /**
   * Aggregates component states into authoritative system health.
   */
  public static aggregate(
    components: AggregatedSystemHealth["components"],
    metrics: AggregatedSystemHealth["metrics"],
    vantagePoint: "CLIENT_BROWSER" | "API_GATEWAY",
  ): AggregatedSystemHealth {
    const evaluatedAt = new Date().toISOString();
    const componentList = Object.values(components);

    const hasUnavailable = componentList.some((c) => c.status === "UNAVAILABLE");
    const hasDegraded = componentList.some((c) => c.status === "DEGRADED");
    const hasUnknown = componentList.some((c) => c.status === "UNKNOWN");

    let globalStatus: HealthStatus;
    if (components.api.status === "UNAVAILABLE" || components.database.status === "UNAVAILABLE") {
      globalStatus = "UNAVAILABLE";
    } else if (hasUnavailable || hasDegraded) {
      globalStatus = "DEGRADED";
    } else if (hasUnknown) {
      globalStatus = "DEGRADED";
    } else {
      globalStatus = "HEALTHY";
    }

    const banner = HealthEvaluator.computeTruthfulBanner(globalStatus, components, metrics);

    return {
      globalStatus,
      banner,
      evaluatedAt,
      vantagePoint,
      components,
      metrics,
    };
  }

  /**
   * Computes the strictly truthful operations banner.
   */
  private static computeTruthfulBanner(
    globalStatus: HealthStatus,
    components: AggregatedSystemHealth["components"],
    metrics: AggregatedSystemHealth["metrics"],
  ): AggregatedBanner {
    const list = Object.values(components);
    const unknownComponents = list.filter((c) => c.status === "UNKNOWN");
    const degradedComponents = list.filter((c) => c.status === "DEGRADED");
    const unavailableComponents = list.filter((c) => c.status === "UNAVAILABLE");

    if (globalStatus === "UNAVAILABLE" || unavailableComponents.length > 0) {
      const names = unavailableComponents.map((c) => c.displayName).join(", ");
      return {
        variant: "UNAVAILABLE",
        headline: "Service disruption detected",
        subtitle: `Core pipeline offline: ${names} is currently unavailable.`,
        details: unavailableComponents.map((c) => `${c.displayName}: ${c.statusReason}`),
      };
    }

    if (degradedComponents.length > 0) {
      const names = degradedComponents.map((c) => c.displayName).join(", ");
      return {
        variant: "DEGRADED",
        headline: "Payment pipeline degraded",
        subtitle: `Operational warnings detected across: ${names}.`,
        details: degradedComponents.map((c) => `${c.displayName}: ${c.statusReason}`),
      };
    }

    if (unknownComponents.length > 0) {
      const names = unknownComponents.map((c) => c.displayName).join(", ");
      return {
        variant: "VISIBILITY_DEGRADED",
        headline: "Operational visibility degraded",
        subtitle: `Some health checks are unavailable. Telemetry missing or silent for: ${names}.`,
        details: unknownComponents.map((c) => `${c.displayName}: ${c.statusReason}`),
      };
    }

    if (
      globalStatus === "HEALTHY" &&
      metrics.dlqUnresolvedCount === 0 &&
      metrics.unverifiedWebhooksCount === 0 &&
      metrics.ledgerBalanced
    ) {
      return {
        variant: "NOMINAL",
        headline: "All payment pipelines nominal · 0 invariant violations · 0 DLQ items",
        subtitle:
          "Double-entry ledger verified balanced. All 7 platform subsystems healthy with fresh telemetry.",
        details: [
          "Web, API, and PostgreSQL database connections verified responsive.",
          "PayMongo QR Ph circuit breaker CLOSED with normal transaction telemetry.",
          "Zero unverified webhook events and zero dead-letter queue records.",
        ],
      };
    }

    return {
      variant: "DEGRADED",
      headline: "Operational discrepancy detected",
      subtitle:
        "Component pings responded, but financial ledger invariants or queue metrics require inspection.",
      details: [
        metrics.dlqUnresolvedCount > 0
          ? `${metrics.dlqUnresolvedCount} DLQ items detected`
          : "DLQ empty",
        !metrics.ledgerBalanced
          ? "Ledger balance equation unbalanced (Debits != Credits)"
          : "Ledger balanced",
      ],
    };
  }

  private static makeFreshness(
    now: number,
    observedAt: string,
    maxTtlMs: number,
    source: ObservationSource,
  ): TelemetryFreshness {
    const obsTime = new Date(observedAt).getTime();
    const freshnessMs = Math.max(0, now - obsTime);
    return {
      observedAt,
      freshnessMs,
      maxTtlMs,
      isFresh: freshnessMs <= maxTtlMs,
      observationSource: source,
    };
  }
}
