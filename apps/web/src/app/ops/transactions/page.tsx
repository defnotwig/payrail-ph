"use client";

import { useState } from "react";
import { Amount, DetailList, PageHeader, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface Transaction {
  id: string;
  orderNumber: string;
  amountMinor: number;
  method: "qrph" | "card";
  state: "SUCCEEDED" | "AWAITING_PAYMENT" | "FAILED" | "REFUNDED";
  idempotencyKey: string;
  providerEventId: string;
  createdAt: string;
}

export default function TransactionsPage() {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [filterState, setFilterState] = useState<string>("ALL");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const transactions: Transaction[] = [
    {
      id: "pi_test_0192a831001",
      orderNumber: "ORD-20261018-01",
      amountMinor: 50000,
      method: "qrph",
      state: "SUCCEEDED",
      idempotencyKey: "idem_order_01_99182a",
      providerEventId: "evt_paymongo_0192a831",
      createdAt: "Today, 17:15:20",
    },
    {
      id: "pi_test_0192a832002",
      orderNumber: "ORD-20261018-02",
      amountMinor: 125000,
      method: "card",
      state: "SUCCEEDED",
      idempotencyKey: "idem_order_02_44192b",
      providerEventId: "evt_paymongo_0192a832",
      createdAt: "Today, 16:50:11",
    },
    {
      id: "pi_test_0192a833003",
      orderNumber: "ORD-20261018-03",
      amountMinor: 30000,
      method: "qrph",
      state: "AWAITING_PAYMENT",
      idempotencyKey: "idem_order_03_77182c",
      providerEventId: "evt_pending_qr_scan",
      createdAt: "Today, 16:42:00",
    },
    {
      id: "pi_test_0192a834004",
      orderNumber: "ORD-20261018-04",
      amountMinor: 89000,
      method: "card",
      state: "FAILED",
      idempotencyKey: "idem_order_04_33192d",
      providerEventId: "evt_card_declined_51",
      createdAt: "Today, 15:30:18",
    },
  ];

  const filtered = transactions.filter((t) =>
    filterState === "ALL" ? true : t.state === filterState,
  );

  const handleSimulateRefund = (tx: Transaction) => {
    setActionNotice(
      `Compensating refund draft staged for ${tx.id}. Capacity available: ₱${(tx.amountMinor / 100).toFixed(2)}. Open Refunds tab to execute under SELECT FOR UPDATE lock.`,
    );
  };

  const handleViewPayload = (tx: Transaction) => {
    setActionNotice(
      `Verified Payload for Event ${tx.providerEventId}: HMAC-SHA256 verified signature (t=1729242920, te=verified_test_sig). Idempotency fingerprint matched.`,
    );
  };

  return (
    <div>
      <PageHeader
        title="Transaction Investigation & Payment Intents"
        subtitle="Progressive disclosure of payment lifecycle, idempotency records, and verified provider evidence."
        actions={
          <div className={styles.flexRow}>
            <label
              htmlFor="filter-state-select"
              style={{
                fontSize: "12px",
                color: "var(--color-text-secondary, #475569)",
                fontWeight: 600,
              }}
            >
              Filter by State:
            </label>
            <select
              id="filter-state-select"
              className={styles.inputField}
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="ALL">All States ({transactions.length})</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="AWAITING_PAYMENT">Awaiting Payment</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        }
      />

      {actionNotice && (
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
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            style={{
              background: "none",
              border: "none",
              color: "#1e40af",
              fontSize: "16px",
              cursor: "pointer",
              padding: "0 4px",
            }}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.gridTwoCol}>
        {/* Transaction Table */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Transactions ({filtered.length})</h2>
            <span className={styles.badgePill}>POSTGRESQL AUDIT</span>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Intent & Order</th>
                  <th scope="col" className={styles.numCol}>
                    Amount
                  </th>
                  <th scope="col">Method</th>
                  <th scope="col">State</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const isSelected = selectedTx?.id === tx.id;
                  return (
                    <tr
                      key={tx.id}
                      style={{
                        background: isSelected ? "#eff6ff" : undefined,
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td>
                        <div
                          style={{ fontWeight: 600, color: "var(--color-text-primary, #0f172a)" }}
                        >
                          {tx.orderNumber}
                        </div>
                        <code
                          style={{ fontSize: "11px", color: "var(--color-text-muted, #64748b)" }}
                        >
                          {tx.id}
                        </code>
                      </td>
                      <td className={styles.numCol}>
                        <Amount amountMinor={tx.amountMinor} currency="PHP" align="right" />
                      </td>
                      <td>
                        <span className={styles.badgePill}>{tx.method.toUpperCase()}</span>
                      </td>
                      <td>
                        <StatusBadge status={tx.state} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.buttonSecondary}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTx(tx);
                          }}
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                        >
                          Inspect →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Investigation Inspector Drawer */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Investigation Inspector</h2>
            {selectedTx ? (
              <StatusBadge status={selectedTx.state} />
            ) : (
              <span className={styles.badgePill}>SELECT A TRANSACTION</span>
            )}
          </div>

          {selectedTx ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h3
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-muted, #64748b)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    margin: "0 0 8px 0",
                  }}
                >
                  State Transition Journey
                </h3>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    overflowX: "auto",
                  }}
                >
                  <span style={{ color: "#166534", fontWeight: 600 }}>CREATED</span>
                  <span style={{ color: "#94a3b8" }}>→</span>
                  <span style={{ color: "#166534", fontWeight: 600 }}>SUBMISSION_PENDING</span>
                  <span style={{ color: "#94a3b8" }}>→</span>
                  <span style={{ color: "#166534", fontWeight: 600 }}>AWAITING_PAYMENT</span>
                  <span style={{ color: "#94a3b8" }}>→</span>
                  <span
                    style={{
                      color:
                        selectedTx.state === "SUCCEEDED"
                          ? "#166534"
                          : selectedTx.state === "FAILED"
                            ? "#991b1b"
                            : "#0f52ba",
                      fontWeight: 700,
                    }}
                  >
                    {selectedTx.state}
                  </span>
                </div>
              </div>

              <div>
                <h3
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-muted, #64748b)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    margin: "0 0 8px 0",
                  }}
                >
                  Cryptographic Evidence & Audit Details
                </h3>
                <DetailList
                  items={[
                    {
                      label: "Payment Intent ID",
                      value: selectedTx.id,
                      copyableText: selectedTx.id,
                    },
                    {
                      label: "Order Reference",
                      value: selectedTx.orderNumber,
                      copyableText: selectedTx.orderNumber,
                    },
                    {
                      label: "Idempotency Key",
                      value: selectedTx.idempotencyKey,
                      copyableText: selectedTx.idempotencyKey,
                    },
                    {
                      label: "Provider Event ID",
                      value: selectedTx.providerEventId,
                      copyableText: selectedTx.providerEventId,
                    },
                    { label: "Row Lock Strategy", value: "SELECT FOR UPDATE (Atomic)" },
                    { label: "Created Timestamp", value: selectedTx.createdAt },
                  ]}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  className={styles.buttonPrimary}
                  onClick={() => handleSimulateRefund(selectedTx)}
                >
                  Stage Compensating Refund
                </button>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => handleViewPayload(selectedTx)}
                >
                  Verify Raw Webhook
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "var(--color-text-muted, #64748b)",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px" }}>
                Select a transaction from the table to inspect its full state lifecycle, idempotency
                fingerprint, and HMAC webhook audit record.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
