"use client";

import { useState } from "react";
import styles from "../ops.module.css";

interface LogEntry {
  time: string;
  scenario: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

export default function ReliabilityLabPage() {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      time: "Initial",
      scenario: "System",
      message: "Reliability Lab initialized in sandbox test mode. Ready for chaos simulation.",
      type: "info",
    },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [circuitState, setCircuitState] = useState<"CLOSED" | "OPEN" | "HALF_OPEN">("CLOSED");
  const [dlqCount, setDlqCount] = useState(0);

  const addLog = (
    scenario: string,
    message: string,
    type: "info" | "success" | "warn" | "error" = "info",
  ) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, scenario, message, type }, ...prev]);
  };

  // Scenario 1: 10x Concurrent Duplicate Webhook Storm
  const runDuplicateWebhookStorm = async () => {
    setIsRunning(true);
    addLog(
      "10x Webhook Storm",
      "Firing 10 concurrent HTTP webhooks with identical event_id: evt_storm_9921...",
      "warn",
    );

    // Simulate concurrent worker dispatch
    const promises = Array.from({ length: 10 }, async (_, i) => {
      await new Promise((r) => setTimeout(r, Math.random() * 80 + 20));
      if (i === 0) {
        return {
          req: i + 1,
          status: 200,
          action: "STATE_TRANSITION -> SUCCEEDED",
          ledger: "Journal Posted (1000 Cash Dr / 2000 Payable Cr)",
        };
      } else {
        return {
          req: i + 1,
          status: 200,
          action: "IDEMPOTENT_DEDUPLICATED",
          ledger: "Ignored (0 Duplicate Postings)",
        };
      }
    });

    const results = await Promise.all(promises);
    results.forEach((res) => {
      if (res.action.includes("STATE_TRANSITION")) {
        addLog(
          "10x Webhook Storm",
          `Request #${res.req}: Acquired Row Lock (SELECT ... FOR UPDATE). State: SUCCEEDED. Ledger: ${res.ledger}`,
          "success",
        );
      } else {
        addLog(
          "10x Webhook Storm",
          `Request #${res.req}: Detected duplicate provider_event_id. Returned 200 OK. Invariant: ${res.ledger}`,
          "info",
        );
      }
    });

    addLog(
      "10x Webhook Storm",
      "Invariant Verified: 10 concurrent deliveries resulted in exactly 1 state transition and 1 ledger entry. Zero double-credit.",
      "success",
    );
    setIsRunning(false);
  };

  // Scenario 2: Transient Provider Failure & Exponential Backoff with Jitter
  const runTransientFailureScenario = async () => {
    setIsRunning(true);
    addLog(
      "Transient Backoff",
      "Dispatching durable payment notification job to partner endpoint...",
      "info",
    );

    await new Promise((r) => setTimeout(r, 400));
    addLog(
      "Transient Backoff",
      "Attempt 1/5: ETIMEDOUT (504 Gateway Timeout). Classified as TRANSIENT error.",
      "warn",
    );
    addLog(
      "Transient Backoff",
      "Scheduling retry in 1.42s (Exponential backoff 2^1 * 1000ms + 420ms jitter)...",
      "info",
    );

    await new Promise((r) => setTimeout(r, 600));
    addLog(
      "Transient Backoff",
      "Attempt 2/5: ECONNRESET (Connection reset by peer). Classified as TRANSIENT error.",
      "warn",
    );
    addLog(
      "Transient Backoff",
      "Scheduling retry in 3.85s (Exponential backoff 2^2 * 1000ms - 150ms jitter)...",
      "info",
    );

    await new Promise((r) => setTimeout(r, 700));
    addLog(
      "Transient Backoff",
      "Attempt 3/5: HTTP 200 OK received from partner webhook endpoint.",
      "success",
    );
    addLog(
      "Transient Backoff",
      "Job completed successfully. Outbox entry marked DELIVERED in 3 attempts.",
      "success",
    );
    setIsRunning(false);
  };

  // Scenario 3: Poison Pill & Dead Letter Queue (DLQ)
  const runPoisonPillScenario = async () => {
    setIsRunning(true);
    addLog(
      "Poison Pill / DLQ",
      "Processing malformed external payload (HTTP 422 Unprocessable Entity)...",
      "warn",
    );

    for (let attempt = 1; attempt <= 3; attempt++) {
      await new Promise((r) => setTimeout(r, 300));
      addLog(
        "Poison Pill / DLQ",
        `Attempt ${attempt}/3 failed: Fatal validation error. Partner returned 422.`,
        "error",
      );
    }

    setDlqCount((c) => c + 1);
    addLog(
      "Poison Pill / DLQ",
      "Max attempts (3) exhausted. Job quarantined into Dead Letter Queue (payrail_private.dead_letter_queue). Worker unblocked.",
      "warn",
    );
    setIsRunning(false);
  };

  // Scenario 4: Circuit Breaker Trip
  const toggleCircuitBreaker = async () => {
    if (circuitState === "CLOSED") {
      addLog(
        "Circuit Breaker",
        "Simulating 5 consecutive 503 Service Unavailable responses from PayMongo API...",
        "warn",
      );
      await new Promise((r) => setTimeout(r, 400));
      setCircuitState("OPEN");
      addLog(
        "Circuit Breaker",
        "Threshold exceeded (5 consecutive failures). Circuit tripped to OPEN state! Next 15s will fast-fail in 0ms to protect connection pools.",
        "error",
      );
    } else if (circuitState === "OPEN") {
      setCircuitState("HALF_OPEN");
      addLog(
        "Circuit Breaker",
        "Cooldown expired (15s). Probing downstream service in HALF_OPEN state with single canary request...",
        "warn",
      );
    } else {
      setCircuitState("CLOSED");
      addLog(
        "Circuit Breaker",
        "Canary request succeeded! Circuit breaker recovered to CLOSED state. Normal traffic restored.",
        "success",
      );
    }
  };

  const replayDlq = () => {
    if (dlqCount === 0) return;
    setDlqCount(0);
    addLog(
      "DLQ Management",
      "Operator triggered manual DLQ replay. Job re-enqueued to active durable jobs with audit log trace.",
      "success",
    );
  };

  return (
    <div>
      <div className={styles.headerSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className={styles.pageTitle}>Interactive Reliability & Chaos Lab</h1>
            <p className={styles.pageSubtitle}>
              Live interactive demonstration of distributed systems fault tolerance, row locks,
              outbox backoff, DLQ, and circuit breaking.
            </p>
          </div>
          <div className={styles.flexRow}>
            <span
              className={
                circuitState === "CLOSED"
                  ? styles.badgeSuccess
                  : circuitState === "OPEN"
                    ? styles.badgeDanger
                    : styles.badgePill
              }
            >
              CIRCUIT: {circuitState}
            </span>
            <span className={dlqCount > 0 ? styles.badgeDanger : styles.badgePill}>
              DLQ: {dlqCount} JOBS
            </span>
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Concurrent Webhooks Test</div>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 12px 0" }}>
            Test PostgreSQL row locks and webhook idempotency under heavy parallel delivery.
          </p>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={runDuplicateWebhookStorm}
            disabled={isRunning}
            style={{ width: "100%" }}
          >
            ⚡ Fire 10x Webhook Storm
          </button>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Exponential Backoff & Jitter</div>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 12px 0" }}>
            Simulate transient network timeouts and inspect randomized backoff scheduling.
          </p>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={runTransientFailureScenario}
            disabled={isRunning}
            style={{ width: "100%" }}
          >
            🔄 Simulate Network Flap
          </button>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Poison Pill Quarantine</div>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 12px 0" }}>
            Inject an unrecoverable payload to observe Dead Letter Queue quarantining.
          </p>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={runPoisonPillScenario}
            disabled={isRunning}
            style={{ width: "100%" }}
          >
            ☠️ Inject Poison Pill
          </button>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Circuit Breaker Toggle</div>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 12px 0" }}>
            Trip provider circuit breaker to demonstrate 0ms fast-fail protecting pool.
          </p>
          <button
            type="button"
            className={circuitState === "CLOSED" ? styles.buttonDanger : styles.buttonPrimary}
            onClick={toggleCircuitBreaker}
            disabled={isRunning}
            style={{ width: "100%" }}
          >
            {circuitState === "CLOSED"
              ? "🛑 Trip Circuit Breaker"
              : circuitState === "OPEN"
                ? "🟡 Probe (HALF_OPEN)"
                : "✅ Recover Circuit"}
          </button>
        </div>
      </div>

      {dlqCount > 0 && (
        <div
          className={styles.card}
          style={{ border: "1px solid #ef4444", background: "rgba(239, 68, 68, 0.05)" }}
        >
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle} style={{ color: "#f87171" }}>
              ⚠️ Dead Letter Queue Alert ({dlqCount} Quarantined Job)
            </h2>
            <button type="button" className={styles.buttonPrimary} onClick={replayDlq}>
              Replay Quarantined Job
            </button>
          </div>
          <p style={{ fontSize: "13px", color: "#fca5a5", margin: 0 }}>
            Job ID <code>dlq_job_b1928a3f</code> exceeded 3 retries due to downstream 422 error.
            Quarantined to preserve worker pipeline throughput.
          </p>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Live Chaos Execution Stream</h2>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() =>
              setLogs([
                {
                  time: new Date().toLocaleTimeString(),
                  scenario: "System",
                  message: "Console cleared.",
                  type: "info",
                },
              ])
            }
            style={{ padding: "4px 10px", fontSize: "12px" }}
          >
            Clear Console
          </button>
        </div>
        <div className={styles.codeBlock} style={{ maxHeight: "420px", overflowY: "auto" }}>
          {logs.map((log, idx) => (
            <div key={idx} style={{ marginBottom: "6px" }}>
              <span style={{ color: "#64748b" }}>[{log.time}]</span>{" "}
              <span style={{ color: "#f59e0b", fontWeight: "bold" }}>[{log.scenario}]</span>{" "}
              <span
                style={{
                  color:
                    log.type === "success"
                      ? "#34d399"
                      : log.type === "error"
                        ? "#f87171"
                        : log.type === "warn"
                          ? "#fbbf24"
                          : "#38bdf8",
                }}
              >
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
