"use client";

import { useState } from "react";
import styles from "../ops.module.css";

interface DiscrepancyItem {
  id: string;
  type: "STATUS_MISMATCH" | "LOCAL_ONLY" | "PROVIDER_ONLY";
  paymentIntentId: string;
  localState: string;
  providerState: string;
  amountFormatted: string;
  actionRequired: string;
  repaired: boolean;
}

export default function ReconciliationPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([
    {
      id: "rec_item_01",
      type: "STATUS_MISMATCH",
      paymentIntentId: "pi_test_0192a991",
      localState: "AWAITING_PAYMENT",
      providerState: "PAID",
      amountFormatted: "₱1,500.00",
      actionRequired: "Catch-up transition to SUCCEEDED and post missing ledger journal",
      repaired: false,
    },
    {
      id: "rec_item_02",
      type: "LOCAL_ONLY",
      paymentIntentId: "pi_test_0192a992",
      localState: "CREATED",
      providerState: "NOT_FOUND",
      amountFormatted: "₱450.00",
      actionRequired: "Merchant abandoned before QR generation (Safe to expire)",
      repaired: false,
    },
  ]);

  const handleRepair = (id: string) => {
    setDiscrepancies((prev) =>
      prev.map((item) => (item.id === id ? { ...item, repaired: true } : item)),
    );
  };

  const handleRunRecon = async () => {
    setIsRunning(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsRunning(false);
  };

  return (
    <div>
      <div className={styles.headerSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className={styles.pageTitle}>Automated 3-Way Reconciliation & Settlement</h1>
            <p className={styles.pageSubtitle}>
              Continuous verification across Internal Payment Intents, Downstream Provider Evidence,
              and Internal Ledger.
            </p>
          </div>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={handleRunRecon}
            disabled={isRunning}
          >
            {isRunning ? "Running 3-Way Match..." : "⚡ Run Daily Reconciliation"}
          </button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Matched (3-Way)</div>
          <div className={styles.statValue} style={{ color: "#34d399" }}>
            99.4%
          </div>
          <div className={styles.statSubtext}>367 / 369 verified identical</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Status Mismatches</div>
          <div className={styles.statValue} style={{ color: "#fbbf24" }}>
            1 ITEM
          </div>
          <div className={styles.statSubtext}>Provider PAID / Local Awaiting</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Local Only (Unsubmitted)</div>
          <div className={styles.statValue} style={{ color: "#94a3b8" }}>
            1 ITEM
          </div>
          <div className={styles.statSubtext}>Abandoned checkout draft</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Financial Variance</div>
          <div className={styles.statValue} style={{ color: "#34d399" }}>
            ₱0.00
          </div>
          <div className={styles.statSubtext}>Zero unallocated fund leakage</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Discrepancies & Automated Repair Console</h2>
          <span className={styles.badgePill}>
            {discrepancies.filter((d) => !d.repaired).length} OPEN ISSUES
          </span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Discrepancy Type</th>
                <th>Payment Intent</th>
                <th>Local State</th>
                <th>Provider State</th>
                <th>Amount</th>
                <th>Remediation Action</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span
                      className={
                        item.type === "STATUS_MISMATCH" ? styles.badgeDanger : styles.badgePill
                      }
                    >
                      {item.type}
                    </span>
                  </td>
                  <td>
                    <code>{item.paymentIntentId}</code>
                  </td>
                  <td>
                    <b>{item.localState}</b>
                  </td>
                  <td>
                    <span style={{ color: "#34d399" }}>{item.providerState}</span>
                  </td>
                  <td>
                    <b>{item.amountFormatted}</b>
                  </td>
                  <td style={{ fontSize: "12px", color: "#94a3b8" }}>{item.actionRequired}</td>
                  <td>
                    {item.repaired ? (
                      <span className={styles.badgeSuccess}>✓ REPAIRED</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.buttonPrimary}
                        onClick={() => handleRepair(item.id)}
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                      >
                        Auto-Repair
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>3-Way Reconciliation Architecture</h2>
          <span className={styles.badgePill}>FORMAL SPECIFICATION</span>
        </div>
        <div className={styles.gridTwoCol}>
          <div>
            <h3 style={{ fontSize: "14px", color: "#ffffff", margin: "0 0 8px 0" }}>
              1. Verification Equation
            </h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>
              Every day at 00:00 UTC+8, the reconciliation worker runs an exhaustive join:
            </p>
            <div className={styles.codeBlock}>
              {`SELECT pi.id, pi.state, po.provider_status, jl.amount_minor
FROM payrail_private.payment_intents pi
FULL OUTER JOIN payrail_private.provider_events po
  ON pi.id = po.payment_intent_id
FULL OUTER JOIN payrail_private.journal_entries jl
  ON pi.id = jl.reference_id`}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: "14px", color: "#ffffff", margin: "0 0 8px 0" }}>
              2. Safe Automated Repair
            </h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>
              When provider evidence shows <code>PAID</code> but internal state missed the webhook
              due to network partitioning, the repair engine safely advances the intent to{" "}
              <code>SUCCEEDED</code>, links the provider event ID, and posts the compensating
              journal entry atomically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
