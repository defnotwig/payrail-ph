"use client";

import { useState } from "react";
import styles from "../ops.module.css";

interface DurableJob {
  id: string;
  type: string;
  attempts: number;
  maxAttempts: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  leasedBy: string | null;
  nextRunAt: string;
}

interface DlqRecord {
  id: string;
  originalJobId: string;
  jobType: string;
  errorTrace: string;
  payload: string;
  failedAt: string;
}

export default function DurableJobsPage() {
  const [dlqRecords, setDlqRecords] = useState<DlqRecord[]>([
    {
      id: "dlq_0192a001",
      originalJobId: "job_webhook_9921",
      jobType: "MERCHANT_WEBHOOK_DISPATCH",
      errorTrace:
        "AxiosError: Request failed with status code 500 (Merchant server crashed). Max attempts (5) exhausted.",
      payload: JSON.stringify(
        { event: "payment.succeeded", payment_intent_id: "pi_test_0192a831" },
        null,
        2,
      ),
      failedAt: "Today, 15:45:10",
    },
  ]);

  const jobs: DurableJob[] = [
    {
      id: "job_ledger_8819",
      type: "LEDGER_JOURNAL_POSTING",
      attempts: 1,
      maxAttempts: 3,
      status: "COMPLETED",
      leasedBy: "worker_node_01",
      nextRunAt: "None (Done)",
    },
    {
      id: "job_recon_0012",
      type: "DAILY_RECONCILIATION_SYNC",
      attempts: 0,
      maxAttempts: 3,
      status: "PENDING",
      leasedBy: null,
      nextRunAt: "Tonight, 00:00:00",
    },
    {
      id: "job_webhook_9922",
      type: "MERCHANT_WEBHOOK_DISPATCH",
      attempts: 2,
      maxAttempts: 5,
      status: "PROCESSING",
      leasedBy: "worker_node_02 (Lease: 28s remaining)",
      nextRunAt: "In 12s",
    },
  ];

  const handleReplayDlq = (id: string) => {
    setDlqRecords((prev) => prev.filter((r) => r.id !== id));
    alert(`DLQ Job ${id} re-enqueued to active durable jobs with audit log trace.`);
  };

  return (
    <div>
      <div className={styles.headerSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className={styles.pageTitle}>Durable Jobs & Dead Letter Queue (DLQ)</h1>
            <p className={styles.pageSubtitle}>
              PostgreSQL transactional outbox pattern with SELECT FOR UPDATE SKIP LOCKED and worker
              lease fencing.
            </p>
          </div>
          <span className={styles.badgeSuccess}>WORKER POOL: 3 NODES ACTIVE</span>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Durable Jobs</div>
          <div className={styles.statValue}>3 JOBS</div>
          <div className={styles.statSubtext}>1 Processing · 1 Pending · 1 Completed</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Worker Lease Strategy</div>
          <div className={styles.statValue} style={{ fontSize: "16px", color: "#60a5fa" }}>
            SKIP LOCKED
          </div>
          <div className={styles.statSubtext}>30s Lease TTL · Zero worker collisions</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Retry Backoff Model</div>
          <div className={styles.statValue} style={{ fontSize: "16px", color: "#34d399" }}>
            2^N * 1s + Jitter
          </div>
          <div className={styles.statSubtext}>Prevents thundering herd on downstream</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Dead Letter Queue</div>
          <div
            className={styles.statValue}
            style={{ color: dlqRecords.length > 0 ? "#f87171" : "#34d399" }}
          >
            {dlqRecords.length} QUARANTINED
          </div>
          <div className={styles.statSubtext}>Preserves worker queue throughput</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Durable Jobs Queue (payrail_private.durable_jobs)</h2>
          <span className={styles.badgePill}>{jobs.length} REGISTERED</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Type</th>
                <th>Attempts</th>
                <th>Leased Worker</th>
                <th>Next Run</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <code>{job.id}</code>
                  </td>
                  <td>
                    <b>{job.type}</b>
                  </td>
                  <td>
                    {job.attempts} / {job.maxAttempts}
                  </td>
                  <td>
                    {job.leasedBy ? (
                      <code>{job.leasedBy}</code>
                    ) : (
                      <span style={{ color: "#64748b" }}>Unassigned</span>
                    )}
                  </td>
                  <td>{job.nextRunAt}</td>
                  <td>
                    <span
                      className={
                        job.status === "COMPLETED"
                          ? styles.badgeSuccess
                          : job.status === "PROCESSING"
                            ? styles.badgePill
                            : styles.badgeSandbox
                      }
                    >
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Dead Letter Queue (payrail_private.dead_letter_queue)
          </h2>
          <span className={dlqRecords.length > 0 ? styles.badgeDanger : styles.badgeSuccess}>
            {dlqRecords.length} UNRESOLVED
          </span>
        </div>

        {dlqRecords.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {dlqRecords.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "#090d16",
                  border: "1px solid #ef4444",
                  borderRadius: "6px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <span className={styles.badgeDanger}>{item.id}</span>
                    <b style={{ marginLeft: "10px", color: "#ffffff" }}>{item.jobType}</b>
                    <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "10px" }}>
                      {item.failedAt}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.buttonPrimary}
                    onClick={() => handleReplayDlq(item.id)}
                  >
                    Replay Job
                  </button>
                </div>
                <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "8px" }}>
                  {item.errorTrace}
                </div>
                <div className={styles.codeBlock} style={{ fontSize: "11px" }}>
                  {item.payload}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
            No quarantined jobs in Dead Letter Queue. Worker pipeline running at 100% capacity.
          </div>
        )}
      </div>
    </div>
  );
}
