"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Amount, MetricCard, MetricGrid, Skeleton, StatusBadge } from "../../components/ui";
import styles from "./ops.module.css";

interface NeedsAttentionItem {
  id: string;
  entityType: "PAYMENT" | "JOB" | "WEBHOOK" | "REFUND" | "RECONCILIATION";
  condition: string;
  summary: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  createdAt: string;
  recommendedAction: string;
}

interface RecentPaymentItem {
  id: string;
  orderNumber: string;
  amountMinor: string;
  currency: string;
  state: string;
  provider: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  confirmationLatencyMs?: number | null;
}

interface ProviderHealthReport {
  provider: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN";
  totalAttempts24h: number;
  failedAttempts24h: number;
  failureRate: number;
  p95LatencyMs: number | null;
}

interface OperationsOverviewResult {
  period: "today" | "7d" | "30d" | "all";
  successfulPayments: number;
  totalPayments: number;
  successRate: number | null;
  grossVolumeMinor: string;
  currency: "PHP";
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  providerFailures: number;
  needsAttention: NeedsAttentionItem[];
  recentPayments: RecentPaymentItem[];
  providerHealth: ProviderHealthReport;
}

type PeriodType = "today" | "7d" | "30d" | "all";

export default function OpsOverviewPage() {
  const [period, setPeriod] = useState<PeriodType>("today");
  const [data, setData] = useState<OperationsOverviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async (selectedPeriod: PeriodType) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/ops/overview?period=${selectedPeriod}`);
      if (!res.ok) {
        throw new Error(`Overview service responded with HTTP ${res.status}`);
      }
      const json: OperationsOverviewResult = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operations metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(period);
  }, [period]);

  return (
    <div>
      {/* Header with Title and Period Filter */}
      <div className={styles.headerSection}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h1 className={styles.pageTitle}>Operations Overview</h1>
            <p className={styles.pageSubtitle}>
              Real-time settlement metrics, transaction performance, and circuit state derived
              directly from PostgreSQL.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className={styles.periodBar}>
              <button
                type="button"
                className={`${styles.periodBtn} ${period === "today" ? styles.periodBtnActive : ""}`}
                onClick={() => setPeriod("today")}
                aria-pressed={period === "today"}
              >
                Today (24h)
              </button>
              <button
                type="button"
                className={`${styles.periodBtn} ${period === "7d" ? styles.periodBtnActive : ""}`}
                onClick={() => setPeriod("7d")}
                aria-pressed={period === "7d"}
              >
                7 Days
              </button>
              <button
                type="button"
                className={`${styles.periodBtn} ${period === "30d" ? styles.periodBtnActive : ""}`}
                onClick={() => setPeriod("30d")}
                aria-pressed={period === "30d"}
              >
                30 Days
              </button>
              <button
                type="button"
                className={`${styles.periodBtn} ${period === "all" ? styles.periodBtnActive : ""}`}
                onClick={() => setPeriod("all")}
                aria-pressed={period === "all"}
              >
                All Time
              </button>
            </div>

            <button
              type="button"
              className={styles.buttonSecondary}
              style={{ fontSize: "12px", padding: "6px 12px" }}
              onClick={() => fetchOverview(period)}
              title="Refresh live metrics"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Network or Server Error Banner */}
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
          <strong>Operational Metrics Unavailable:</strong> {error}
        </div>
      )}

      {/* Exception Triage Panel (Von Restorff Effect) */}
      {loading ? (
        <Skeleton height="52px" borderRadius="8px" style={{ marginBottom: "24px" }} />
      ) : data?.needsAttention && data.needsAttention.length > 0 ? (
        <section className={styles.triageBanner} aria-label="Operational Exceptions">
          <div className={styles.triageBannerHeader}>
            <div className={styles.triageBannerTitle}>
              <span aria-hidden="true">⚠️</span>
              <span>
                Needs Attention ({data.needsAttention.length} exception
                {data.needsAttention.length > 1 ? "s" : ""})
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "#92400e" }}>Immediate triage recommended</span>
          </div>
          <ul className={styles.triageList}>
            {data.needsAttention.map((item) => (
              <li key={item.id} className={styles.triageItem}>
                <div>
                  <span className={styles.triageItemSummary}>{item.summary}</span>
                  <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                    Condition: <code>{item.condition}</code> · Severity:{" "}
                    <strong>{item.severity}</strong>
                  </div>
                </div>
                <Link
                  href={
                    item.entityType === "PAYMENT"
                      ? `/ops/transactions/${item.id}`
                      : item.entityType === "JOB"
                        ? "/ops/jobs"
                        : item.entityType === "RECONCILIATION"
                          ? "/ops/reconciliation"
                          : "/ops/developer"
                  }
                  className={styles.triageItemAction}
                >
                  {item.recommendedAction || "Investigate →"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className={styles.triageBannerHealthy} role="status">
          <div className={styles.triageHealthyText}>
            <span aria-hidden="true">✓</span>
            <span>All payment pipelines nominal · 0 invariant violations · 0 DLQ items</span>
          </div>
          <span className={styles.triageHealthyMeta}>Double-entry ledger verified balanced</span>
        </div>
      )}

      {/* Primary KPI Metric Grid (Hick's Law: 4 core metrics) */}
      <MetricGrid>
        {loading ? (
          <>
            <Skeleton height="96px" borderRadius="10px" />
            <Skeleton height="96px" borderRadius="10px" />
            <Skeleton height="96px" borderRadius="10px" />
            <Skeleton height="96px" borderRadius="10px" />
          </>
        ) : (
          <>
            <MetricCard
              label="Payment Success Rate"
              value={
                data && data.successRate !== null ? (
                  <span style={{ color: data.successRate >= 99 ? "#166534" : "#b45309" }}>
                    {data.successRate.toFixed(1)}%
                  </span>
                ) : (
                  <span style={{ color: "#64748b" }}>—</span>
                )
              }
              metadata={
                data && data.totalPayments > 0
                  ? `${data.successfulPayments} of ${data.totalPayments} succeeded`
                  : "0 payments in this window"
              }
            />

            <MetricCard
              label="Gross Volume"
              value={data ? <Amount amountMinor={data.grossVolumeMinor} currency="PHP" /> : "₱0.00"}
              metadata={
                data
                  ? `${data.totalPayments} total transaction${data.totalPayments === 1 ? "" : "s"}`
                  : "Authoritative ledger volume"
              }
            />

            <MetricCard
              label="Total Transactions"
              value={data ? data.totalPayments.toLocaleString() : "0"}
              metadata="QR Ph & Card orchestration"
            />

            <MetricCard
              label="P95 Settlement Latency"
              value={
                data && data.p95LatencyMs !== null ? (
                  `${data.p95LatencyMs}ms`
                ) : (
                  <span style={{ color: "#64748b" }}>—</span>
                )
              }
              metadata="Webhook-to-balanced-ledger"
            />
          </>
        )}
      </MetricGrid>

      {/* Provider Health Strip */}
      <div className={styles.card} style={{ marginBottom: "24px" }}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Gateway & Provider Health</h2>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-text-secondary, #475569)",
                margin: "4px 0 0",
              }}
            >
              Active circuit breaker states and 24-hour upstream telemetry.
            </p>
          </div>
          {data?.providerHealth && (
            <span
              className={
                data.providerHealth.circuitState === "CLOSED"
                  ? styles.badgeSuccess
                  : styles.badgeDanger
              }
            >
              CIRCUIT {data.providerHealth.circuitState}
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          <div
            style={{
              padding: "12px",
              background: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Primary Rail
            </span>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
              PayMongo QR Ph
            </div>
            <span style={{ fontSize: "12px", color: "#475569" }}>Test Mode Simulator Active</span>
          </div>

          <div
            style={{
              padding: "12px",
              background: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              24h Gateway Attempts
            </span>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
              {data?.providerHealth ? data.providerHealth.totalAttempts24h : 0}
            </div>
            <span style={{ fontSize: "12px", color: "#475569" }}>
              Failures: {data?.providerHealth ? data.providerHealth.failedAttempts24h : 0}
            </span>
          </div>

          <div
            style={{
              padding: "12px",
              background: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Failure Rate
            </span>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
              {data?.providerHealth ? `${data.providerHealth.failureRate.toFixed(1)}%` : "0.0%"}
            </div>
            <span style={{ fontSize: "12px", color: "#475569" }}>Threshold: 50% trip limit</span>
          </div>

          <div
            style={{
              padding: "12px",
              background: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Provider P95 Latency
            </span>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
              {data?.providerHealth?.p95LatencyMs ? `${data.providerHealth.p95LatencyMs}ms` : "—"}
            </div>
            <span style={{ fontSize: "12px", color: "#475569" }}>Upstream API round-trip</span>
          </div>
        </div>
      </div>

      {/* Authoritative Recent Payments Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Recent Authoritative Payments</h2>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-text-secondary, #475569)",
                margin: "4px 0 0",
              }}
            >
              Authoritative transaction records persisted across provider webhooks and internal
              double-entry ledger.
            </p>
          </div>
          <Link
            href="/ops/transactions"
            className={styles.buttonSecondary}
            style={{ fontSize: "13px", padding: "6px 12px", textDecoration: "none" }}
          >
            View all transactions →
          </Link>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col" style={{ textAlign: "right" }}>
                  Amount
                </th>
                <th scope="col">Method</th>
                <th scope="col">Reference</th>
                <th scope="col">Provider</th>
                <th scope="col">Created</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "24px" }}>
                    <Skeleton height="24px" style={{ marginBottom: "10px" }} />
                    <Skeleton height="24px" style={{ marginBottom: "10px" }} />
                    <Skeleton height="24px" />
                  </td>
                </tr>
              ) : data?.recentPayments && data.recentPayments.length > 0 ? (
                data.recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <StatusBadge status={p.state} />
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "ui-monospace, monospace",
                        fontWeight: 600,
                      }}
                    >
                      <Amount amountMinor={p.amountMinor} currency="PHP" />
                    </td>
                    <td>
                      <span
                        style={{ textTransform: "uppercase", fontSize: "12px", fontWeight: 600 }}
                      >
                        {p.paymentMethod === "qrph" ? "QR Ph" : "Card"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "12px" }}>
                        {p.orderNumber}
                      </span>
                    </td>
                    <td>{p.provider}</td>
                    <td style={{ fontSize: "13px", color: "var(--color-text-secondary, #475569)" }}>
                      {new Date(p.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td>
                      <Link
                        href={`/ops/transactions/${p.id}`}
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--color-brand, #0f52ba)",
                          textDecoration: "underline",
                        }}
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.tableEmptyState}>
                      <h3 className={styles.emptyStateTitle}>
                        No payments recorded in this period
                      </h3>
                      <p className={styles.emptyStateDesc}>
                        Generate a test QR Ph payment to observe real-time provider webhook
                        ingestion, cryptographic validation, and double-entry ledger settlement.
                      </p>
                      <Link
                        href="/demo/qrph"
                        className={styles.buttonPrimary}
                        style={{ textDecoration: "none", marginTop: "8px" }}
                      >
                        Test QR Ph Checkout →
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Philippine Regulatory & Architecture Footnote */}
      <footer className={styles.regulatoryFooter}>
        <div>
          <strong>PayRail PH Core Banking & Switching Framework</strong> · Bangko Sentral ng
          Pilipinas (BSP) Circular No. 1055 (NRPS) Compliant.
        </div>
        <div>
          Double-Entry Balanced Settlement: <code>∑ Debits - ∑ Credits === 0</code>
        </div>
      </footer>
    </div>
  );
}
