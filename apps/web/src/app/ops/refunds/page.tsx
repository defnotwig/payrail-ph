"use client";

import { useState } from "react";
import { Amount, PageHeader, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface RefundRecord {
  id: string;
  paymentIntentId: string;
  amountMinor: number;
  reason: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
  compensatingJournalId: string;
  createdAt: string;
}

export default function RefundsPage() {
  const [targetIntent, setTargetIntent] = useState("pi_test_0192a831001");
  const [totalCapacity, _setTotalCapacity] = useState(500);
  const [alreadyRefunded, setAlreadyRefunded] = useState(150);
  const [refundAmount, setRefundAmount] = useState("100.00");
  const [reason, setReason] = useState("Customer requested cancellation");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [refunds, setRefunds] = useState<RefundRecord[]>([
    {
      id: "ref_test_0192a714",
      paymentIntentId: "pi_test_0192a831001",
      amountMinor: 15000,
      reason: "Partial item return",
      status: "SUCCEEDED",
      compensatingJournalId: "jnl_0192a714_refund",
      createdAt: "Today, 16:40:11",
    },
    {
      id: "ref_test_0192a502",
      paymentIntentId: "pi_test_0192a832002",
      amountMinor: 125000,
      reason: "Fraud alert quarantine",
      status: "SUCCEEDED",
      compensatingJournalId: "jnl_0192a502_refund",
      createdAt: "Yesterday, 14:12:00",
    },
  ]);

  const handleCreateRefund = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const amountNum = parseFloat(refundAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Refund amount must be a positive number.");
      return;
    }

    const remainingCapacity = totalCapacity - alreadyRefunded;
    if (amountNum > remainingCapacity) {
      setErrorMsg(
        `Invariant Violated: Requested ₱${amountNum.toFixed(2)} exceeds remaining refundable capacity (₱${remainingCapacity.toFixed(2)}). Total payment was ₱${totalCapacity.toFixed(2)}, already refunded ₱${alreadyRefunded.toFixed(2)}.`,
      );
      return;
    }

    const newId = `ref_test_${Date.now().toString(36)}`;
    const newRefund: RefundRecord = {
      id: newId,
      paymentIntentId: targetIntent,
      amountMinor: Math.round(amountNum * 100),
      reason,
      status: "SUCCEEDED",
      compensatingJournalId: `jnl_${newId}_refund`,
      createdAt: "Just now",
    };

    setRefunds([newRefund, ...refunds]);
    setAlreadyRefunded((prev) => prev + amountNum);
    setSuccessMsg(
      `Refund ${newId} succeeded! Compensating ledger journal ${newRefund.compensatingJournalId} posted (Dr 2000 Payable / Cr 1000 Cash).`,
    );
  };

  const remaining = totalCapacity - alreadyRefunded;

  return (
    <div>
      <PageHeader
        title="Refunds & Capacity Protection"
        subtitle="Strict capacity checking (SELECT FOR UPDATE) preventing over-refunds and posting compensating ledger journals."
        actions={<StatusBadge status="SUCCEEDED" customLabel="OVER-REFUND INVARIANT: ACTIVE" />}
      />

      <div className={styles.gridTwoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Issue Controlled Refund</h2>
            <span className={styles.badgePill}>CAPACITY GUARD</span>
          </div>

          <form
            onSubmit={handleCreateRefund}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label
                htmlFor="target-intent-input"
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary, #475569)",
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}
              >
                Target Payment Intent ID
              </label>
              <input
                id="target-intent-input"
                type="text"
                className={styles.inputField}
                value={targetIntent}
                onChange={(e) => setTargetIntent(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label
                  htmlFor="payment-total-input"
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-secondary, #475569)",
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Payment Total
                </label>
                <input
                  id="payment-total-input"
                  type="text"
                  disabled
                  className={styles.inputField}
                  value={`₱${totalCapacity.toFixed(2)}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                />
              </div>
              <div>
                <label
                  htmlFor="already-refunded-input"
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-secondary, #475569)",
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Already Refunded
                </label>
                <input
                  id="already-refunded-input"
                  type="text"
                  disabled
                  className={styles.inputField}
                  value={`₱${alreadyRefunded.toFixed(2)}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                />
              </div>
              <div>
                <label
                  htmlFor="remaining-capacity-input"
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-secondary, #475569)",
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Remaining Capacity
                </label>
                <input
                  id="remaining-capacity-input"
                  type="text"
                  disabled
                  className={styles.inputField}
                  value={`₱${remaining.toFixed(2)}`}
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    color: remaining > 0 ? "#166534" : "#dc2626",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="refund-amount-input"
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary, #475569)",
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}
              >
                Refund Amount (PHP)
              </label>
              <input
                id="refund-amount-input"
                type="number"
                step="0.01"
                className={styles.inputField}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
            </div>

            <div>
              <label
                htmlFor="refund-reason-input"
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary, #475569)",
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}
              >
                Reason for Refund
              </label>
              <input
                id="refund-reason-input"
                type="text"
                className={styles.inputField}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {errorMsg && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  color: "#991b1b",
                  fontSize: "12px",
                }}
                role="alert"
              >
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  color: "#166534",
                  fontSize: "12px",
                }}
                role="status"
              >
                {successMsg}
              </div>
            )}

            <button type="submit" className={styles.buttonPrimary}>
              Issue Refund with Row Lock
            </button>
          </form>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Compensating Accounting Architecture</h2>
            <span className={styles.badgePill}>DOUBLE-ENTRY RULE</span>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary, #475569)",
              lineHeight: 1.6,
            }}
          >
            Under GAAP and modern fintech engineering, payment records are{" "}
            <strong>immutable</strong>. A refund does not delete or overwrite the original payment.
          </p>
          <div className={styles.codeBlock} style={{ marginBottom: "14px" }}>
            {`-- Original Payment Success:
DR 1000 Cash at PayMongo         ₱500.00
CR 2000 Merchant Settlement      ₱485.00
CR 4000 Platform Fee Revenue     ₱ 15.00

-- Compensating Partial Refund (₱100.00):
DR 2000 Merchant Settlement      ₱100.00
CR 1000 Cash at PayMongo         ₱100.00`}
          </div>
          <p style={{ fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
            The ledger remains mathematically conserved: net balance is updated via forward
            additions only.
          </p>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Refund Records (payrail_private.refunds)</h2>
          <span className={styles.badgePill}>{refunds.length} REFUNDS</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Refund ID</th>
                <th scope="col">Payment Intent</th>
                <th scope="col" className={styles.numCol}>
                  Amount
                </th>
                <th scope="col">Reason</th>
                <th scope="col">Compensating Journal</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((ref) => (
                <tr key={ref.id}>
                  <td>
                    <code>{ref.id}</code>
                  </td>
                  <td>
                    <code>{ref.paymentIntentId}</code>
                  </td>
                  <td className={styles.numCol}>
                    <Amount amountMinor={ref.amountMinor} currency="PHP" align="right" />
                  </td>
                  <td>{ref.reason}</td>
                  <td>
                    <code>{ref.compensatingJournalId}</code>
                  </td>
                  <td>
                    <StatusBadge status={ref.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
