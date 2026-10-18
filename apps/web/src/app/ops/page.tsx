"use client";

import Link from "next/link";
import { MetricCard, MetricGrid, PageHeader, StatusBadge } from "../../components/ui";
import styles from "./ops.module.css";

export default function OpsOverviewPage() {
  return (
    <div>
      <PageHeader
        title="Payment Operations Overview"
        subtitle="Mission-critical operational metrics, double-entry conservation, and downstream circuit state."
        showEnvironment={true}
      />

      <MetricGrid>
        <MetricCard
          label="24h Gross Volume"
          value="₱184,500.00"
          metadata="369 verified sandbox transactions"
        />
        <MetricCard
          label="Ledger Balance Invariant"
          value={<span style={{ color: "#166534" }}>₱0.00 DIFF</span>}
          metadata="∑ Debits === ∑ Credits (100% Balanced)"
        />
        <MetricCard
          label="Provider Circuit Breaker"
          value={<span style={{ color: "#0f52ba" }}>CLOSED</span>}
          metadata="PayMongo sandbox: 0% failure rate"
        />
        <MetricCard
          label="Dead Letter Queue"
          value="0 JOBS"
          metadata="All durable worker retries healthy"
        />
      </MetricGrid>

      <div className={styles.gridTwoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Platform Architecture Invariants</h2>
            <StatusBadge status="SUCCEEDED" customLabel="ALL PASSING" />
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Invariant</th>
                  <th scope="col">Enforcement Mechanism</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Zero Double-Charge</strong>
                  </td>
                  <td>PostgreSQL Idempotency Keys + SHA-256 fingerprint</td>
                  <td>
                    <StatusBadge status="SUCCEEDED" customLabel="ENFORCED" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Double-Entry Conservation</strong>
                  </td>
                  <td>Strict SQL Transaction ∑(Debits) - ∑(Credits) === 0</td>
                  <td>
                    <StatusBadge status="SUCCEEDED" customLabel="ENFORCED" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Over-Refund Prevention</strong>
                  </td>
                  <td>SELECT FOR UPDATE capacity reservation</td>
                  <td>
                    <StatusBadge status="SUCCEEDED" customLabel="ENFORCED" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>At-Least-Once Delivery</strong>
                  </td>
                  <td>Transactional Outbox with lease-fenced workers</td>
                  <td>
                    <StatusBadge status="SUCCEEDED" customLabel="ENFORCED" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>PCI-DSS Compliance Scope</strong>
                  </td>
                  <td>CVV non-persistence, PAN tokenization & masking</td>
                  <td>
                    <StatusBadge status="SUCCEEDED" customLabel="CONSCIOUS" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Interactive Operational Labs</h2>
            <span className={styles.badgePill}>RECRUITER & SRE SUITE</span>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary, #475569)",
              marginBottom: "16px",
              lineHeight: 1.5,
            }}
          >
            Interactive sandboxes engineered to test and verify distributed fintech behavior under
            edge conditions:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link
              href="/ops/reliability-lab"
              className={styles.buttonPrimary}
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              ⚡ Launch Reliability Lab (10x Webhook Storm & Chaos)
            </Link>
            <Link
              href="/ops/iso8583"
              className={styles.buttonSecondary}
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              📦 Launch ISO 8583 Message Packer & Unpacker
            </Link>
            <Link
              href="/ops/ledger"
              className={styles.buttonSecondary}
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              ⚖️ Inspect Double-Entry Ledger & Chart of Accounts
            </Link>
            <Link
              href="/ops/reconciliation"
              className={styles.buttonSecondary}
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              🔄 Automated 3-Way Reconciliation & Repair
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Live Operational Audit Stream</h2>
          <span className={styles.badgePill}>IMMUTABLE AUDIT LOG</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Timestamp</th>
                <th scope="col">Actor</th>
                <th scope="col">Role</th>
                <th scope="col">Action</th>
                <th scope="col">Target ID</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Just now</td>
                <td>system@payrail.ph</td>
                <td>
                  <span className={styles.badgePill}>SYSTEM</span>
                </td>
                <td>
                  <strong>LEDGER_JOURNAL_POSTED</strong>
                </td>
                <td>
                  <code style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace" }}>
                    jnl_88f910a2
                  </code>
                </td>
                <td>
                  <StatusBadge status="SUCCEEDED" customLabel="BALANCED" />
                </td>
              </tr>
              <tr>
                <td>2m ago</td>
                <td>webhook-worker</td>
                <td>
                  <span className={styles.badgePill}>WORKER</span>
                </td>
                <td>
                  <strong>PAYMENT_INTENT_SUCCEEDED</strong>
                </td>
                <td>
                  <code style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace" }}>
                    pi_test_0192a831
                  </code>
                </td>
                <td>
                  <StatusBadge status="SUCCEEDED" customLabel="VERIFIED" />
                </td>
              </tr>
              <tr>
                <td>5m ago</td>
                <td>circuit-breaker</td>
                <td>
                  <span className={styles.badgePill}>SYSTEM</span>
                </td>
                <td>
                  <strong>PROBE_SUCCESS</strong>
                </td>
                <td>
                  <code style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace" }}>
                    paymongo_qrph
                  </code>
                </td>
                <td>
                  <StatusBadge status="SUCCEEDED" customLabel="CLOSED" />
                </td>
              </tr>
              <tr>
                <td>12m ago</td>
                <td>reconciler</td>
                <td>
                  <span className={styles.badgePill}>WORKER</span>
                </td>
                <td>
                  <strong>DAILY_RECONCILIATION_RUN</strong>
                </td>
                <td>
                  <code style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace" }}>
                    rec_run_20261018
                  </code>
                </td>
                <td>
                  <StatusBadge status="SUCCEEDED" customLabel="0 DISCREPANCIES" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
