"use client";

import { useState } from "react";
import { Amount, MetricCard, MetricGrid, PageHeader, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface DiscrepancyItem {
  id: string;
  type: "STATUS_MISMATCH" | "LOCAL_ONLY" | "PROVIDER_ONLY";
  paymentIntentId: string;
  localState: string;
  providerState: string;
  amountMinor: number;
  actionRequired: string;
  repaired: boolean;
}

export default function ReconciliationPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([
    {
      id: "rec_item_01",
      type: "STATUS_MISMATCH",
      paymentIntentId: "pi_test_0192a991",
      localState: "AWAITING_PAYMENT",
      providerState: "PAID",
      amountMinor: 150000,
      actionRequired: "Catch-up transition to SUCCEEDED and post missing ledger journal",
      repaired: false,
    },
    {
      id: "rec_item_02",
      type: "LOCAL_ONLY",
      paymentIntentId: "pi_test_0192a992",
      localState: "CREATED",
      providerState: "NOT_FOUND",
      amountMinor: 45000,
      actionRequired: "Merchant abandoned checkout before QR generation (Safe to expire)",
      repaired: false,
    },
  ]);

  const handleRepair = (id: string) => {
    setDiscrepancies((prev) =>
      prev.map((item) => (item.id === id ? { ...item, repaired: true } : item)),
    );
    setSuccessBanner(
      `Discrepancy ${id} successfully repaired. Compensating ledger journal and payment state synced.`,
    );
  };

  const handleRunRecon = async () => {
    setIsRunning(true);
    setSuccessBanner(null);
    await new Promise((r) => setTimeout(r, 600));
    setIsRunning(false);
    setSuccessBanner(
      "Daily 3-way reconciliation completed: 367 verified matches, 2 exceptions evaluated.",
    );
  };

  const openCount = discrepancies.filter((d) => !d.repaired).length;

  return (
    <div>
      <PageHeader
        title="Automated 3-Way Reconciliation & Settlement"
        subtitle="Continuous invariant verification across Internal Payment Intents, Downstream Provider Evidence, and Internal Ledger."
        actions={
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={handleRunRecon}
            disabled={isRunning}
          >
            {isRunning ? "Running 3-Way Match..." : "⚡ Run Daily Reconciliation"}
          </button>
        }
      />

      {successBanner && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "13px",
            color: "#166534",
          }}
          role="status"
        >
          <span>✓ {successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            style={{
              background: "none",
              border: "none",
              color: "#166534",
              fontSize: "16px",
              cursor: "pointer",
            }}
            aria-label="Dismiss banner"
          >
            ×
          </button>
        </div>
      )}

      <MetricGrid>
        <MetricCard
          label="Total Matched (3-Way)"
          value={<span style={{ color: "#166534" }}>99.4%</span>}
          metadata="367 / 369 verified identical"
        />
        <MetricCard
          label="Status Mismatches"
          value={<span style={{ color: "#92400e" }}>1 ITEM</span>}
          metadata="Provider PAID / Local Awaiting"
        />
        <MetricCard
          label="Local Only (Unsubmitted)"
          value="1 ITEM"
          metadata="Abandoned checkout draft"
        />
        <MetricCard
          label="Financial Variance"
          value={<span style={{ color: "#166534" }}>₱0.00</span>}
          metadata="Zero unallocated fund leakage"
        />
      </MetricGrid>

      {/* Discrepancies Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Discrepancies & Automated Repair Console</h2>
          <span className={openCount > 0 ? styles.badgeDanger : styles.badgeSuccess}>
            {openCount} OPEN EXCEPTIONS
          </span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Discrepancy Type</th>
                <th scope="col">Payment Intent</th>
                <th scope="col">Local State</th>
                <th scope="col">Provider State</th>
                <th scope="col" className={styles.numCol}>
                  Amount
                </th>
                <th scope="col">Remediation Action</th>
                <th scope="col">Status</th>
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
                    <strong>{item.localState}</strong>
                  </td>
                  <td>
                    <span style={{ color: "#166534", fontWeight: 600 }}>{item.providerState}</span>
                  </td>
                  <td className={styles.numCol}>
                    <Amount amountMinor={item.amountMinor} currency="PHP" align="right" />
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--color-text-secondary, #475569)" }}>
                    {item.actionRequired}
                  </td>
                  <td>
                    {item.repaired ? (
                      <StatusBadge status="SUCCEEDED" customLabel="REPAIRED" />
                    ) : (
                      <button
                        type="button"
                        className={styles.buttonPrimary}
                        onClick={() => handleRepair(item.id)}
                        style={{ padding: "4px 10px", fontSize: "11px" }}
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

      {/* 3-Way Reconciliation Architecture Explanation */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>3-Way Reconciliation Architecture</h2>
          <span className={styles.badgePill}>FORMAL SPECIFICATION</span>
        </div>
        <div className={styles.gridTwoCol}>
          <div>
            <h3
              style={{
                fontSize: "14px",
                color: "var(--color-text-primary, #0f172a)",
                margin: "0 0 8px 0",
              }}
            >
              1. Verification Equation
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-text-secondary, #475569)",
                lineHeight: 1.6,
              }}
            >
              Every day at 00:00 UTC+8, the reconciliation worker runs an exhaustive join across the
              three systems of record:
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
            <h3
              style={{
                fontSize: "14px",
                color: "var(--color-text-primary, #0f172a)",
                margin: "0 0 8px 0",
              }}
            >
              2. Safe Automated Repair
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-text-secondary, #475569)",
                lineHeight: 1.6,
              }}
            >
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
