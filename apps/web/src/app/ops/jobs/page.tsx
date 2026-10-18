"use client";

import { useState } from "react";
import { MetricCard, MetricGrid, PageHeader, StatusBadge } from "../../../components/ui";
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
  const [replayNotice, setReplayNotice] = useState<string | null>(null);
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
    setReplayNotice(
      `DLQ Job ${id} safely re-enqueued to active durable jobs with audit log trace.`,
    );
  };

  return (
    <div>
      <PageHeader
        title="Durable Jobs & Dead Letter Queue (DLQ)"
        subtitle="PostgreSQL transactional outbox pattern with SELECT FOR UPDATE SKIP LOCKED and worker lease fencing."
        actions={<StatusBadge status="SUCCEEDED" customLabel="WORKER POOL: 3 NODES ACTIVE" />}
      />

      {replayNotice && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "13px",
            color: "#1e40af",
          }}
          role="status"
        >
          <span>✓ {replayNotice}</span>
          <button
            type="button"
            onClick={() => setReplayNotice(null)}
            style={{
              background: "none",
              border: "none",
              color: "#1e40af",
              fontSize: "16px",
              cursor: "pointer",
            }}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}

      <MetricGrid>
        <MetricCard
          label="Active Durable Jobs"
          value="3 JOBS"
          metadata="1 Processing · 1 Pending · 1 Completed"
        />
        <MetricCard
          label="Worker Lease Strategy"
          value={<span style={{ color: "#0f52ba" }}>SKIP LOCKED</span>}
          metadata="30s Lease TTL · Zero worker collisions"
        />
        <MetricCard
          label="Retry Backoff Model"
          value={<span style={{ color: "#166534" }}>2^N * 1s + Jitter</span>}
          metadata="Prevents thundering herd on downstream"
        />
        <MetricCard
          label="Dead Letter Queue"
          value={
            <span style={{ color: dlqRecords.length > 0 ? "#dc2626" : "#166534" }}>
              {dlqRecords.length} QUARANTINED
            </span>
          }
          metadata="Preserves worker queue throughput"
        />
      </MetricGrid>

      {/* Active Jobs Queue */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Durable Jobs Queue (payrail_private.durable_jobs)</h2>
          <span className={styles.badgePill}>{jobs.length} REGISTERED</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Job ID</th>
                <th scope="col">Type</th>
                <th scope="col">Attempts</th>
                <th scope="col">Leased Worker</th>
                <th scope="col">Next Run</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <code>{job.id}</code>
                  </td>
                  <td>
                    <strong>{job.type}</strong>
                  </td>
                  <td>
                    {job.attempts} / {job.maxAttempts}
                  </td>
                  <td>
                    {job.leasedBy ? (
                      <code>{job.leasedBy}</code>
                    ) : (
                      <span style={{ color: "var(--color-text-muted, #64748b)" }}>Unassigned</span>
                    )}
                  </td>
                  <td>{job.nextRunAt}</td>
                  <td>
                    <StatusBadge
                      status={
                        job.status === "COMPLETED"
                          ? "SUCCEEDED"
                          : job.status === "PROCESSING"
                            ? "PROCESSING"
                            : "AWAITING_PAYMENT"
                      }
                      customLabel={job.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dead Letter Queue */}
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
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div>
                    <span className={styles.badgeDanger}>{item.id}</span>
                    <strong style={{ marginLeft: "10px", color: "#991b1b" }}>{item.jobType}</strong>
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
                <div
                  style={{
                    color: "#991b1b",
                    fontSize: "13px",
                    marginBottom: "8px",
                    fontWeight: 500,
                  }}
                >
                  {item.errorTrace}
                </div>
                <div className={styles.codeBlock} style={{ fontSize: "11px" }}>
                  {item.payload}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "32px",
              color: "var(--color-text-muted, #64748b)",
            }}
          >
            No quarantined jobs in Dead Letter Queue. Worker pipeline running at 100% capacity.
          </div>
        )}
      </div>
    </div>
  );
}
