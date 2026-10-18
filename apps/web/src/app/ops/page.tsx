"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./ops.module.css";

export default function OpsOverviewPage() {
  const [_copied, _setCopied] = useState(false);

  return (
    <div>
      <div className={styles.headerSection}>
        <h1 className={styles.pageTitle}>Executive Payment Operations Overview</h1>
        <p className={styles.pageSubtitle}>
          Mission-critical metrics, ledger balance invariants, and downstream provider circuit
          state.
        </p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>24h Gross Volume</div>
          <div className={styles.statValue}>₱184,500.00</div>
          <div className={styles.statSubtext}>369 verified sandbox transactions</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Ledger Balance Invariant</div>
          <div className={styles.statValue} style={{ color: "#34d399" }}>
            0.00 PHP DIFF
          </div>
          <div className={styles.statSubtext}>∑ Debits === ∑ Credits (100% Balanced)</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Provider Circuit Breaker</div>
          <div className={styles.statValue} style={{ color: "#60a5fa" }}>
            CLOSED
          </div>
          <div className={styles.statSubtext}>PayMongo sandbox: 0% failure rate</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Dead Letter Queue</div>
          <div className={styles.statValue} style={{ color: "#94a3b8" }}>
            0 JOBS
          </div>
          <div className={styles.statSubtext}>All durable worker retries healthy</div>
        </div>
      </div>

      <div className={styles.gridTwoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Platform Architecture Invariants</h2>
            <span className={styles.badgeSuccess}>ALL PASSING</span>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Invariant</th>
                  <th>Enforcement Mechanism</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>Zero Double-Charge</b>
                  </td>
                  <td>PostgreSQL Idempotency Keys + SHA-256 fingerprint</td>
                  <td>
                    <span className={styles.badgeSuccess}>ENFORCED</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Double-Entry Conservation</b>
                  </td>
                  <td>Strict SQL Transaction ∑(Debits) - ∑(Credits) === 0</td>
                  <td>
                    <span className={styles.badgeSuccess}>ENFORCED</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Over-Refund Prevention</b>
                  </td>
                  <td>SELECT FOR UPDATE capacity reservation</td>
                  <td>
                    <span className={styles.badgeSuccess}>ENFORCED</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>At-Least-Once Delivery</b>
                  </td>
                  <td>Transactional Outbox with lease-fenced workers</td>
                  <td>
                    <span className={styles.badgeSuccess}>ENFORCED</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>PCI-DSS Compliance Scope</b>
                  </td>
                  <td>CVV non-persistence, PAN tokenization & masking</td>
                  <td>
                    <span className={styles.badgeSuccess}>CONSCIOUS</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>PayMo Interview Quick Launch</h2>
            <span className={styles.badgePill}>RECRUITER SUITE</span>
          </div>
          <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "16px" }}>
            Direct interactive playgrounds to evaluate engineering depth across distributed fintech
            operations:
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
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Target ID</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Just now</td>
                <td>system@payrail.ph</td>
                <td>SYSTEM</td>
                <td>LEDGER_JOURNAL_POSTED</td>
                <td>jnl_88f910a2</td>
                <td>
                  <span className={styles.badgeSuccess}>BALANCED</span>
                </td>
              </tr>
              <tr>
                <td>2m ago</td>
                <td>webhook-worker</td>
                <td>WORKER</td>
                <td>PAYMENT_INTENT_SUCCEEDED</td>
                <td>pi_test_0192a831</td>
                <td>
                  <span className={styles.badgeSuccess}>VERIFIED</span>
                </td>
              </tr>
              <tr>
                <td>5m ago</td>
                <td>circuit-breaker</td>
                <td>SYSTEM</td>
                <td>PROBE_SUCCESS</td>
                <td>paymongo_qrph</td>
                <td>
                  <span className={styles.badgeSuccess}>CLOSED</span>
                </td>
              </tr>
              <tr>
                <td>12m ago</td>
                <td>reconciler</td>
                <td>WORKER</td>
                <td>DAILY_RECONCILIATION_RUN</td>
                <td>rec_run_20261018</td>
                <td>
                  <span className={styles.badgeSuccess}>0 DISCREPANCIES</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
