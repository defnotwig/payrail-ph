/**
 * PayRail PH — Operations Experience V4 Truthful Health Model Types
 */

export type HealthStatus = "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";

export type ComponentId =
  | "web"
  | "api"
  | "database"
  | "paymongo"
  | "webhook_ingestion"
  | "worker"
  | "queue_jobs";

export type ObservationSource =
  | "DIRECT_PROBE"
  | "TELEMETRY_WINDOW"
  | "HEARTBEAT"
  | "DEPENDENT_UNKNOWN"
  | "UNINITIALIZED";

export interface TelemetryFreshness {
  observedAt: string;
  freshnessMs: number;
  maxTtlMs: number;
  isFresh: boolean;
  observationSource: ObservationSource;
}

export interface WebTelemetry {
  routeLatencyMs: number;
  browserOnline: boolean;
  edgeRegion?: string;
}

export interface ApiTelemetry {
  gatewayLatencyMs: number;
  uptimeSeconds: number;
  activeRequests: number;
  memoryUsageBytes: number;
}

export interface DatabaseTelemetry {
  queryLatencyMs: number;
  poolTotal: number;
  poolIdle: number;
  poolWaiting: number;
  activeConnections: number;
}

export interface PayMongoTelemetry {
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN";
  totalAttemptsWindow: number;
  failedAttemptsWindow: number;
  failureRate: number;
  lastSuccessTimestamp: string | null;
  lastFailureTimestamp: string | null;
  p95ProviderRoundtripMs: number | null;
}

export interface WebhookIngestionTelemetry {
  windowSeconds: number;
  totalReceived: number;
  unverifiedSignatures: number;
  processingFailures: number;
  lastWebhookReceivedAt: string | null;
}

export interface WorkerTelemetry {
  activeWorkers: number;
  lastHeartbeatAt: string | null;
  heartbeatAgeMs: number | null;
  runningJobCount: number;
}

export interface QueueJobsTelemetry {
  pendingJobs: number;
  claimedJobs: number;
  overdueJobs: number;
  dlqUnresolvedCount: number;
  oldestPendingJobAgeSeconds: number | null;
}

export type ComponentTelemetryMap = {
  web: WebTelemetry;
  api: ApiTelemetry;
  database: DatabaseTelemetry;
  paymongo: PayMongoTelemetry;
  webhook_ingestion: WebhookIngestionTelemetry;
  worker: WorkerTelemetry;
  queue_jobs: QueueJobsTelemetry;
};

export interface ComponentHealth<TId extends ComponentId = ComponentId> {
  id: TId;
  displayName: string;
  status: HealthStatus;
  statusReason: string;
  telemetry: ComponentTelemetryMap[TId];
  freshness: TelemetryFreshness;
}

export type BannerVariant = "NOMINAL" | "VISIBILITY_DEGRADED" | "DEGRADED" | "UNAVAILABLE";

export interface AggregatedBanner {
  variant: BannerVariant;
  headline: string;
  subtitle: string;
  details: string[];
}

export interface AggregatedSystemHealth {
  globalStatus: HealthStatus;
  banner: AggregatedBanner;
  evaluatedAt: string;
  vantagePoint: "CLIENT_BROWSER" | "API_GATEWAY";
  components: {
    web: ComponentHealth<"web">;
    api: ComponentHealth<"api">;
    database: ComponentHealth<"database">;
    paymongo: ComponentHealth<"paymongo">;
    webhook_ingestion: ComponentHealth<"webhook_ingestion">;
    worker: ComponentHealth<"worker">;
    queue_jobs: ComponentHealth<"queue_jobs">;
  };
  metrics: {
    dlqUnresolvedCount: number;
    unverifiedWebhooksCount: number;
    ledgerBalanced: boolean;
    confirmationLatencyP95Ms: number | null;
    confirmationLatencyP50Ms: number | null;
  };
}
