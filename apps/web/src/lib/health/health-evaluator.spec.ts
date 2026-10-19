import assert from "node:assert/strict";
import { test } from "node:test";
import { HealthEvaluator } from "./health-evaluator";
import type {
  AggregatedSystemHealth,
  ComponentHealth,
  ComponentId,
  ComponentTelemetryMap,
  HealthStatus,
} from "./types";

test("HealthEvaluator: buildApiDisconnectedState sets API UNAVAILABLE and downstream UNKNOWN", () => {
  const now = Date.now();
  const state = HealthEvaluator.buildApiDisconnectedState(now, "Connection refused");

  assert.strictEqual(state.globalStatus, "UNAVAILABLE");
  assert.strictEqual(state.components.api.status, "UNAVAILABLE");
  assert.strictEqual(state.components.database.status, "UNKNOWN");
  assert.strictEqual(state.components.paymongo.status, "UNKNOWN");
  assert.strictEqual(state.components.webhook_ingestion.status, "UNKNOWN");
  assert.strictEqual(state.components.worker.status, "UNKNOWN");
  assert.strictEqual(state.components.queue_jobs.status, "UNKNOWN");
  assert.strictEqual(state.banner.variant, "UNAVAILABLE");
  assert.match(state.banner.headline, /Service disruption detected/);
});

test("HealthEvaluator: evaluateDatabase handles missing and failed probes", () => {
  const now = Date.now();
  const missing = HealthEvaluator.evaluateDatabase(now, null, new Date(now).toISOString());
  assert.strictEqual(missing.status, "UNKNOWN");

  const failed = HealthEvaluator.evaluateDatabase(
    now,
    { success: false, latencyMs: 500, pool: { total: 5, idle: 2, waiting: 0 } },
    new Date(now).toISOString(),
  );
  assert.strictEqual(failed.status, "UNAVAILABLE");

  const ok = HealthEvaluator.evaluateDatabase(
    now,
    { success: true, latencyMs: 12, pool: { total: 5, idle: 4, waiting: 0 } },
    new Date(now).toISOString(),
  );
  assert.strictEqual(ok.status, "HEALTHY");
});

test("HealthEvaluator: evaluatePayMongo requires positive traffic to declare HEALTHY", () => {
  const now = Date.now();
  const unobserved = HealthEvaluator.evaluatePayMongo(
    now,
    { state: "CLOSED" },
    { total: 0, failed: 0, p95Ms: null },
    new Date(now).toISOString(),
  );
  assert.strictEqual(unobserved.status, "UNKNOWN");

  const tripped = HealthEvaluator.evaluatePayMongo(
    now,
    { state: "OPEN" },
    { total: 10, failed: 5, p95Ms: null },
    new Date(now).toISOString(),
  );
  assert.strictEqual(tripped.status, "UNAVAILABLE");

  const healthy = HealthEvaluator.evaluatePayMongo(
    now,
    { state: "CLOSED", lastSuccess: now - 5000 },
    { total: 10, failed: 0, p95Ms: 120 },
    new Date(now).toISOString(),
  );
  assert.strictEqual(healthy.status, "HEALTHY");
});

test("HealthEvaluator: nominal banner requires all 7 components HEALTHY and balanced ledger", () => {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const disconnected = HealthEvaluator.buildApiDisconnectedState(now, "probe");

  const makeComponent = <TId extends ComponentId>(
    id: TId,
    status: HealthStatus,
  ): ComponentHealth<TId> => ({
    id,
    displayName: id,
    status,
    statusReason: "ok",
    telemetry: disconnected.components[id].telemetry as ComponentTelemetryMap[TId],
    freshness: {
      observedAt: iso,
      freshnessMs: 0,
      maxTtlMs: 30000,
      isFresh: true,
      observationSource: "DIRECT_PROBE",
    },
  });

  const components: AggregatedSystemHealth["components"] = {
    web: makeComponent("web", "HEALTHY"),
    api: makeComponent("api", "HEALTHY"),
    database: makeComponent("database", "HEALTHY"),
    paymongo: makeComponent("paymongo", "HEALTHY"),
    webhook_ingestion: makeComponent("webhook_ingestion", "HEALTHY"),
    worker: makeComponent("worker", "HEALTHY"),
    queue_jobs: makeComponent("queue_jobs", "HEALTHY"),
  };

  const healthyState = HealthEvaluator.aggregate(
    components,
    {
      dlqUnresolvedCount: 0,
      unverifiedWebhooksCount: 0,
      ledgerBalanced: true,
      confirmationLatencyP95Ms: 250,
      confirmationLatencyP50Ms: 180,
    },
    "CLIENT_BROWSER",
  );
  assert.strictEqual(healthyState.globalStatus, "HEALTHY");
  assert.strictEqual(healthyState.banner.variant, "NOMINAL");

  // If one component is UNKNOWN, banner must be VISIBILITY_DEGRADED
  components.paymongo = makeComponent("paymongo", "UNKNOWN");
  const degradedState = HealthEvaluator.aggregate(
    components,
    {
      dlqUnresolvedCount: 0,
      unverifiedWebhooksCount: 0,
      ledgerBalanced: true,
      confirmationLatencyP95Ms: null,
      confirmationLatencyP50Ms: null,
    },
    "CLIENT_BROWSER",
  );
  assert.strictEqual(degradedState.globalStatus, "DEGRADED");
  assert.strictEqual(degradedState.banner.variant, "VISIBILITY_DEGRADED");
  assert.match(degradedState.banner.headline, /Operational visibility degraded/);
});
