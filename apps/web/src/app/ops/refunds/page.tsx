"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Amount, Dialog, PageHeader, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface RefundRecord {
  id: string;
  paymentIntentId: string;
  amountMinor: string;
  currency: string;
  reason: string;
  state: "SUCCEEDED" | "PENDING" | "FAILED" | "UNKNOWN";
  createdAt: string;
}

interface PaymentOption {
  id: string;
  orderNumber: string;
  amountMinor: string;
  currency: string;
  state: string;
}

export default function RefundsPage() {
  const [targetIntent, setTargetIntent] = useState("");
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [alreadyRefunded, setAlreadyRefunded] = useState(0);
  const [refundAmount, setRefundAmount] = useState("1.00");
  const [reason, setReason] = useState("Customer requested cancellation");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [succeededPayments, setSucceededPayments] = useState<PaymentOption[]>([]);

  const fetchRefundsAndPayments = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Fetch refunds
      const refRes = await fetch("/api/ops/refunds");
      if (refRes.ok) {
        const refJson = await refRes.json();
        setRefunds(refJson.data || []);
      }

      // Fetch payments to populate selectable target intents
      const payRes = await fetch("/api/payments");
      if (payRes.ok) {
        const payJson = await payRes.json();
        const paymentsList: PaymentOption[] = payJson.data || [];
        const eligible = paymentsList.filter((p) => p.state === "SUCCEEDED");
        setSucceededPayments(eligible);

        if (eligible.length > 0 && !targetIntent) {
          const first = eligible[0];
          if (first) {
            setTargetIntent(first.id);
            const totalMinor = Number(first.amountMinor) || 0;
            setTotalCapacity(totalMinor / 100);
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error connecting to refunds service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefundsAndPayments();
  }, []);

  // Update capacity calculation when selected payment changes
  useEffect(() => {
    if (!targetIntent) return;
    const selected = succeededPayments.find((p) => p.id === targetIntent);
    if (selected) {
      const totalMinor = Number(selected.amountMinor) || 0;
      const totalPesos = totalMinor / 100;
      setTotalCapacity(totalPesos);

      // Calculate existing refunds for this intent
      const intentRefunds = refunds.filter(
        (r) => r.paymentIntentId === targetIntent && r.state !== "FAILED",
      );
      const refundedMinor = intentRefunds.reduce((sum, r) => sum + (Number(r.amountMinor) || 0), 0);
      setAlreadyRefunded(refundedMinor / 100);
    }
  }, [targetIntent, succeededPayments, refunds]);

  const handleRequestConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!targetIntent) {
      setErrorMsg("Please select or enter a valid Target Payment Intent.");
      return;
    }

    const amountNum = parseFloat(refundAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Refund amount must be a positive number.");
      return;
    }

    const remainingCapacity = totalCapacity - alreadyRefunded;
    if (totalCapacity > 0 && amountNum > remainingCapacity) {
      setErrorMsg(
        `Invariant Violated: Requested ₱${amountNum.toFixed(2)} exceeds remaining refundable capacity (₱${remainingCapacity.toFixed(2)}). Total payment was ₱${totalCapacity.toFixed(2)}, already refunded ₱${alreadyRefunded.toFixed(2)}.`,
      );
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleExecuteRefund = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const amountNum = parseFloat(refundAmount);
      const amountMinor = Math.round(amountNum * 100).toString();

      const res = await fetch("/api/ops/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `ref_${crypto.randomUUID().replace(/-/g, "")}`,
        },
        body: JSON.stringify({
          paymentIntentId: targetIntent,
          amountMinor,
          reason,
          currency: "PHP",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.detail || `Refund rejected: HTTP ${res.status}`);
      }

      setIsConfirmOpen(false);
      setSuccessMsg(
        `Refund ${json.data?.id || "submitted"} executed! Compensating double-entry ledger journal posted.`,
      );
      await fetchRefundsAndPayments();
    } catch (err) {
      setIsConfirmOpen(false);
      setErrorMsg(err instanceof Error ? err.message : "Failed to execute refund.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const remaining = Math.max(0, totalCapacity - alreadyRefunded);

  return (
    <div>
      <PageHeader title="Refunds" subtitle="Review and issue refunds for successful payments." />

      <div className={styles.gridTwoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Issue Refund</h2>
          </div>

          <form
            onSubmit={handleRequestConfirmation}
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
              {succeededPayments.length > 0 ? (
                <select
                  id="target-intent-input"
                  className={styles.inputField}
                  value={targetIntent}
                  onChange={(e) => setTargetIntent(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", fontFamily: "monospace" }}
                >
                  {succeededPayments.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} ({p.orderNumber} · ₱{(Number(p.amountMinor) / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="target-intent-input"
                  type="text"
                  className={styles.inputField}
                  value={targetIntent}
                  placeholder="pi_..."
                  onChange={(e) => setTargetIntent(e.target.value)}
                />
              )}
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
                  Original payment
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
                  Already refunded
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
                  Available to refund
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
                min="0.01"
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

            <button
              type="submit"
              disabled={isSubmitting || totalCapacity <= 0}
              className={styles.buttonPrimary}
              style={{ minHeight: "44px", width: "100%", opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? "Processing…" : "Review refund"}
            </button>
          </form>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Refund Safeguards</h2>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary, #475569)",
              lineHeight: 1.6,
              marginBottom: "16px",
            }}
          >
            Refunds are cryptographically validated against original payment records. The backend
            enforces strict transactional capacity checks to prevent over-refunding and posts
            balanced compensating ledger entries.
          </p>
          <details
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              padding: "12px",
              fontSize: "13px",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 600,
                color: "var(--color-brand, #0f52ba)",
                outline: "none",
              }}
            >
              How refund protection works ▾
            </summary>
            <div style={{ marginTop: "12px" }}>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary, #475569)",
                  lineHeight: 1.5,
                  marginBottom: "8px",
                }}
              >
                Under GAAP, payment records are immutable. A refund creates a forward compensating
                journal:
              </p>
              <div className={styles.codeBlock} style={{ marginBottom: "10px", fontSize: "11px" }}>
                {`-- Compensating Refund Journal:
DR 2000 Merchant Settlement      ₱1.00
CR 1000 Cash at PayMongo         ₱1.00`}
              </div>
              <p style={{ fontSize: "11.5px", color: "#64748b", margin: 0 }}>
                Transactional row locking guarantees that parallel refund requests cannot exceed the
                original authorized amount.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Refund Records (payrail_private.refunds)</h2>
          <span className={styles.badgePill}>{refunds.length} REFUNDS</span>
        </div>
        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
            Loading refund history…
          </div>
        ) : refunds.length > 0 ? (
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
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
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
                      <Amount
                        amountMinor={Number(ref.amountMinor) || 0}
                        currency="PHP"
                        align="right"
                      />
                    </td>
                    <td>{ref.reason}</td>
                    <td>
                      <StatusBadge status={ref.state} />
                    </td>
                    <td style={{ color: "#64748b", fontSize: "12px" }}>
                      {new Date(ref.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🛡️</div>
            <h3
              style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}
            >
              No Refunds Issued Yet
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "#64748b",
                maxWidth: "480px",
                margin: "0 auto 16px",
              }}
            >
              Completed payments can be partially or fully refunded up to their confirmed capacity.
              Each refund posts a balanced compensating journal entry to the general ledger.
            </p>
            <Link
              href="/demo/qrph"
              className={styles.buttonPrimary}
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              Make a Test Payment to Refund →
            </Link>
          </div>
        )}
      </div>

      {/* Two-Step Confirmation Dialog (Fitts's Law & Financial Guardrails) */}
      <Dialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Confirm Compensating Refund"
        description="Verify financial amounts and ledger impact before executing this irreversible monetary operation."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "8px",
              padding: "14px",
              color: "#991b1b",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            <strong>Warning: High-Friction Operational Action</strong>
            <p style={{ margin: "4px 0 0" }}>
              This will issue an irreversible compensating double-entry journal entry to the general
              ledger and decrement the merchant settlement reserve.
            </p>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              padding: "14px",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>Target Payment Intent:</span>
              <code>{targetIntent}</code>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>Refund Amount:</span>
              <strong style={{ color: "#0f172a" }}>
                ₱{parseFloat(refundAmount || "0").toFixed(2)} PHP
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>Reason:</span>
              <span>{reason}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Ledger Effect:</span>
              <span style={{ fontSize: "12px", fontFamily: "ui-monospace, monospace" }}>
                DR 2000 / CR 1000
              </span>
            </div>
          </div>

          <div
            style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}
          >
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => setIsConfirmOpen(false)}
              style={{ minHeight: "44px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              className={styles.buttonDanger}
              onClick={handleExecuteRefund}
              style={{ minHeight: "44px" }}
            >
              {isSubmitting
                ? "Posting…"
                : `Confirm ₱${parseFloat(refundAmount || "0").toFixed(2)} refund`}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
