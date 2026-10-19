"use client";

import { useEffect, useState } from "react";
import { MetricCard, MetricGrid, PageHeader, Skeleton, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface ReconciliationRunRecord {
  id: string;
  merchantId: string;
  startedAt: string;
  completedAt?: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  totalRecords: number;
  matchedRecords: number;
  discrepancyRecords: number;
  summary: Record<string, unknown>;
}

interface ReconciliationResponse {
  data?: {
    runs?: ReconciliationRunRecord[];
  };
}

export default function ReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [runs, setRuns] = useState<ReconciliationRunRecord[]>([]);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/ops/reconciliation");
      if (!res.ok) {
        throw new Error(`Reconciliation service returned HTTP ${res.status}`);
      }
      const json: ReconciliationResponse = await res.json();
      setRuns(json.data?.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reconciliation runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleRunRecon = async () => {
    try {
      setIsRunning(true);
      setSuccessBanner(null);
      setError(null);

      const res = await fetch("/api/ops/reconciliation", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Reconciliation failed with HTTP ${res.status}`);
      }

      await fetchRuns();
      setSuccessBanner(
        "Automated 3-way reconciliation completed successfully against current PostgreSQL records.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute reconciliation");
    } finally {
      setIsRunning(false);
    }
  };

  const latestRun = runs[0];
  const totalDiscrepancies = runs.reduce((sum, r) => sum + (r.discrepancyRecords || 0), 0);
  const totalMatched = runs.reduce((sum, r) => sum + (r.matchedRecords || 0), 0);

  return (
    <div>
      <PageHeader
        title="Reconciliation"
        subtitle="Compare provider activity with PayRail records and investigate differences."
        actions={
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={handleRunRecon}
            disabled={isRunning || loading}
            style={{ minHeight: "40px" }}
          >
            {isRunning ? "Running reconciliation…" : "Run reconciliation"}
          </button>
        }
      />

      {successBanner && (
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
          <strong>Reconciliation Result:</strong> {successBanner}
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
          <strong>Operational Error:</strong> {error}
        </div>
      )}

      <MetricGrid>
        <MetricCard
          label="Total Matches"
          value={
            loading ? <Skeleton height="28px" width="80px" /> : runs.length > 0 ? totalMatched : "—"
          }
          metadata={
            runs.length > 0
              ? "Verified invariant equality across 3 sources"
              : "No runs executed yet"
          }
        />
        <MetricCard
          label="Open Discrepancies"
          value={
            loading ? (
              <Skeleton height="28px" width="60px" />
            ) : (
              <span style={{ color: totalDiscrepancies === 0 ? "#166534" : "#991b1b" }}>
                {runs.length > 0 ? totalDiscrepancies : "—"}
              </span>
            )
          }
          metadata={
            totalDiscrepancies === 0 ? "Zero discrepancies detected" : "Requires investigation"
          }
        />
        <MetricCard
          label="Latest Run Status"
          value={
            loading ? <Skeleton height="28px" width="100px" /> : latestRun ? latestRun.status : "—"
          }
          metadata={
            latestRun?.completedAt
              ? `Finished ${new Date(latestRun.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "No prior runs"
          }
        />
        <MetricCard
          label="Historical Runs"
          value={loading ? <Skeleton height="28px" width="60px" /> : `${runs.length} RUNS`}
          metadata="Recorded in payrail_private"
        />
      </MetricGrid>

      {/* Historical Reconciliation Runs Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Reconciliation Audit History (payrail_private.reconciliation_runs)
          </h2>
          <span className={styles.badgePill}>3-WAY INVARIANT AUDIT</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Run ID</th>
                <th scope="col">Status</th>
                <th scope="col" className={styles.numCol}>
                  Total Records
                </th>
                <th scope="col" className={styles.numCol}>
                  Matched
                </th>
                <th scope="col" className={styles.numCol}>
                  Discrepancies
                </th>
                <th scope="col">Started At</th>
                <th scope="col">Completed At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "24px" }}>
                    <Skeleton height="36px" />
                  </td>
                </tr>
              ) : runs.length > 0 ? (
                runs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.id.substring(0, 16)}...</code>
                    </td>
                    <td>
                      <StatusBadge
                        status={
                          r.status === "COMPLETED"
                            ? "SUCCEEDED"
                            : r.status === "FAILED"
                              ? "FAILED"
                              : "PROCESSING"
                        }
                        customLabel={r.status}
                      />
                    </td>
                    <td className={styles.numCol}>{r.totalRecords}</td>
                    <td className={styles.numCol}>
                      <span style={{ color: "#166534", fontWeight: 600 }}>{r.matchedRecords}</span>
                    </td>
                    <td className={styles.numCol}>
                      <span
                        style={{
                          color: r.discrepancyRecords > 0 ? "#991b1b" : "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        {r.discrepancyRecords}
                      </span>
                    </td>
                    <td>{new Date(r.startedAt).toLocaleString("en-PH")}</td>
                    <td>
                      {r.completedAt
                        ? new Date(r.completedAt).toLocaleString("en-PH")
                        : "In progress"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "48px 24px", color: "#64748b" }}
                  >
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>⚖️</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                      No 3-Way Reconciliation Runs Recorded
                    </div>
                    <p style={{ margin: "0 0 16px", fontSize: "13px" }}>
                      Run automated reconciliation to verify parity across internal payment intents,
                      PayMongo provider evidence, and ledger journals.
                    </p>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={handleRunRecon}
                      disabled={isRunning}
                    >
                      {isRunning ? "Running..." : "Run First Reconciliation"}
                    </button>
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
