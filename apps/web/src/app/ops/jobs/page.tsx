"use client";

import { useEffect, useState } from "react";
import { MetricCard, MetricGrid, PageHeader, Skeleton, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface DurableJobRecord {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  state:
    | "PENDING"
    | "CLAIMED"
    | "PROCESSING"
    | "RETRY_SCHEDULED"
    | "COMPLETED"
    | "DEAD_LETTER"
    | string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lockedBy?: string;
  createdAt: string;
}

interface DeadLetterRecord {
  id: string;
  jobId: string;
  merchantId?: string;
  jobType: string;
  payload: Record<string, unknown>;
  failureReason: string;
  replayedAt?: string;
  replayedBy?: string;
  createdAt: string;
}

interface JobsResponse {
  data?: {
    jobs?: DurableJobRecord[];
    dlq?: DeadLetterRecord[];
  };
}

export default function DurableJobsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [replayNotice, setReplayNotice] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DurableJobRecord[]>([]);
  const [dlqRecords, setDlqRecords] = useState<DeadLetterRecord[]>([]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/ops/jobs");
      if (!res.ok) {
        throw new Error(`Jobs service returned HTTP ${res.status}`);
      }
      const json: JobsResponse = await res.json();
      setJobs(json.data?.jobs || []);
      setDlqRecords(json.data?.dlq || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load durable jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleReplayDlq = async (id: string) => {
    try {
      setReplayingId(id);
      setReplayNotice(null);
      setError(null);

      const res = await fetch("/api/ops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        throw new Error(`Replay failed with HTTP ${res.status}`);
      }

      const json = await res.json();
      setReplayNotice(
        `DLQ item ${id} successfully re-enqueued as job ${json.data?.newJobId || "new"}.`,
      );
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to replay dead letter item");
    } finally {
      setReplayingId(null);
    }
  };

  const pendingCount = jobs.filter((j) => j.state === "PENDING" || j.state === "PROCESSING").length;
  const activeDlqCount = dlqRecords.filter((d) => !d.replayedAt).length;

  return (
    <div>
      <PageHeader
        title="Background jobs"
        subtitle="Monitor asynchronous tasks, retry schedules, and failed jobs requiring review."
        actions={
          <StatusBadge
            status={activeDlqCount === 0 ? "SUCCEEDED" : "FAILED"}
            customLabel={
              activeDlqCount === 0
                ? "Jobs healthy · 0 failed"
                : `${activeDlqCount} failed jobs requiring review`
            }
          />
        }
      />

      {replayNotice && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          <strong>DLQ Action:</strong> {replayNotice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          <strong>Worker Subsystem Warning:</strong> {error}
        </div>
      )}

      <MetricGrid>
        <MetricCard
          label="Active Pending Jobs"
          value={loading ? <Skeleton height="28px" width="60px" /> : pendingCount}
          metadata="Leased or waiting in payrail_private.durable_jobs"
        />
        <MetricCard
          label="Quarantined in DLQ"
          value={
            loading ? (
              <Skeleton height="28px" width="60px" />
            ) : (
              <span style={{ color: activeDlqCount === 0 ? "#166534" : "#991b1b" }}>
                {activeDlqCount}
              </span>
            )
          }
          metadata="Max attempts exhausted"
        />
        <MetricCard
          label="Total Historical Jobs"
          value={loading ? <Skeleton height="28px" width="80px" /> : jobs.length}
          metadata="Across outbox and workers"
        />
        <MetricCard
          label="Worker Queue Health"
          value={
            loading ? (
              <Skeleton height="28px" width="100px" />
            ) : activeDlqCount === 0 ? (
              "HEALTHY"
            ) : (
              "NEEDS ATTENTION"
            )
          }
          metadata="Lease heartbeat active"
        />
      </MetricGrid>

      {/* Dead Letter Queue Section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Failed Jobs Requiring Review (DLQ)</h2>
          <span className={activeDlqCount === 0 ? styles.badgeSuccess : styles.badgeDanger}>
            {activeDlqCount === 0 ? "0 REQUIRING REVIEW" : `${activeDlqCount} REQUIRING REVIEW`}
          </span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">DLQ ID</th>
                <th scope="col">Job Type</th>
                <th scope="col">Failure Reason</th>
                <th scope="col">Quarantined At</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "20px" }}>
                    <Skeleton height="36px" />
                  </td>
                </tr>
              ) : dlqRecords.length > 0 ? (
                dlqRecords.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.id.substring(0, 16)}...</code>
                    </td>
                    <td>
                      <strong>{r.jobType}</strong>
                    </td>
                    <td style={{ maxWidth: "280px" }}>
                      <span style={{ color: "#991b1b", fontSize: "12px", fontFamily: "monospace" }}>
                        {r.failureReason}
                      </span>
                    </td>
                    <td>{new Date(r.createdAt).toLocaleString("en-PH")}</td>
                    <td>
                      {r.replayedAt ? (
                        <span className={styles.badgeSuccess}>REPLAYED</span>
                      ) : (
                        <span className={styles.badgeDanger}>UNRESOLVED</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.buttonSecondary}
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                        onClick={() => handleReplayDlq(r.id)}
                        disabled={Boolean(r.replayedAt) || replayingId === r.id}
                      >
                        {replayingId === r.id
                          ? "Replaying..."
                          : r.replayedAt
                            ? "Replayed"
                            : "Replay Job"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", padding: "32px", color: "#64748b" }}
                  >
                    No dead letter entries quarantined. All durable jobs executed cleanly or remain
                    in active retry backoff.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Durable Jobs Section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Durable Job Ledger (payrail_private.durable_jobs)</h2>
          <span className={styles.badgePill}>TRANSACTIONAL OUTBOX</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Job ID</th>
                <th scope="col">Type</th>
                <th scope="col">State</th>
                <th scope="col">Attempts</th>
                <th scope="col">Worker Lock</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "20px" }}>
                    <Skeleton height="36px" />
                  </td>
                </tr>
              ) : jobs.length > 0 ? (
                jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <code>{j.id.substring(0, 16)}...</code>
                    </td>
                    <td>{j.jobType}</td>
                    <td>
                      <StatusBadge
                        status={
                          j.state === "COMPLETED"
                            ? "SUCCEEDED"
                            : j.state === "FAILED"
                              ? "FAILED"
                              : "PROCESSING"
                        }
                        customLabel={j.state}
                      />
                    </td>
                    <td>{`${j.attemptCount} / ${j.maxAttempts}`}</td>
                    <td>
                      {j.lockedBy ? (
                        <code>{j.lockedBy}</code>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td>{new Date(j.createdAt).toLocaleTimeString("en-PH")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", padding: "32px", color: "#64748b" }}
                  >
                    No active durable jobs queued in PostgreSQL.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
