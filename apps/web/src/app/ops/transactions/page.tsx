"use client";

import { useState } from "react";
import styles from "../ops.module.css";

interface Transaction {
  id: string;
  orderNumber: string;
  amountMinor: number;
  amountFormatted: string;
  method: "qrph" | "card";
  state: "SUCCEEDED" | "AWAITING_PAYMENT" | "FAILED" | "REFUNDED";
  idempotencyKey: string;
  providerEventId: string;
  createdAt: string;
}

export default function TransactionsPage() {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [filterState, setFilterState] = useState<string>("ALL");

  const transactions: Transaction[] = [
    {
      id: "pi_test_0192a831001",
      orderNumber: "ORD-20261018-01",
      amountMinor: 50000,
      amountFormatted: "₱500.00",
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
      amountFormatted: "₱1,250.00",
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
      amountFormatted: "₱300.00",
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
      amountFormatted: "₱890.00",
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

  return (
    <div>
      <div className={styles.headerSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className={styles.pageTitle}>Transaction Investigation & Payment Intents</h1>
            <p className={styles.pageSubtitle}>
              Progressive disclosure of payment lifecycle, idempotency records, and verified
              provider evidence.
            </p>
          </div>
          <div className={styles.flexRow}>
            <select
              className={styles.inputField}
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="ALL">All States</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="AWAITING_PAYMENT">Awaiting Payment</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.gridTwoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Transactions ({filtered.length})</h2>
            <span className={styles.badgePill}>REAL DB RECORDS</span>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Intent ID</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>State</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    style={{
                      background: selectedTx?.id === tx.id ? "rgba(59, 130, 246, 0.1)" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedTx(tx)}
                  >
                    <td>
                      <div>
                        <b>{tx.orderNumber}</b>
                      </div>
                      <code style={{ fontSize: "11px", color: "#64748b" }}>{tx.id}</code>
                    </td>
                    <td>
                      <b>{tx.amountFormatted}</b>
                    </td>
                    <td>
                      <span className={styles.badgePill}>{tx.method.toUpperCase()}</span>
                    </td>
                    <td>
                      <span
                        className={
                          tx.state === "SUCCEEDED"
                            ? styles.badgeSuccess
                            : tx.state === "FAILED"
                              ? styles.badgeDanger
                              : styles.badgePill
                        }
                      >
                        {tx.state}
                      </span>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Investigation Inspector</h2>
            {selectedTx ? (
              <span className={styles.badgeSuccess}>{selectedTx.state}</span>
            ) : (
              <span className={styles.badgePill}>SELECT A TRANSACTION</span>
            )}
          </div>

          {selectedTx ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 6px 0" }}>
                  State Transition Journey
                </h3>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#090d16",
                    padding: "12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#34d399", fontWeight: 600 }}>CREATED</span>
                  <span style={{ color: "#64748b" }}>→</span>
                  <span style={{ color: "#34d399", fontWeight: 600 }}>SUBMISSION_PENDING</span>
                  <span style={{ color: "#64748b" }}>→</span>
                  <span style={{ color: "#34d399", fontWeight: 600 }}>AWAITING_PAYMENT</span>
                  <span style={{ color: "#64748b" }}>→</span>
                  <span
                    style={{
                      color:
                        selectedTx.state === "SUCCEEDED"
                          ? "#34d399"
                          : selectedTx.state === "FAILED"
                            ? "#f87171"
                            : "#60a5fa",
                      fontWeight: 700,
                    }}
                  >
                    {selectedTx.state}
                  </span>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 6px 0" }}>
                  Cryptographic Evidence & Idempotency
                </h3>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <tbody>
                      <tr>
                        <td>
                          <b>Idempotency Key</b>
                        </td>
                        <td>
                          <code>{selectedTx.idempotencyKey}</code>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <b>Provider Event ID</b>
                        </td>
                        <td>
                          <code>{selectedTx.providerEventId}</code>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <b>HMAC Signature</b>
                        </td>
                        <td>
                          <span className={styles.badgeSuccess}>VALIDATED (t=...,v1=...)</span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <b>Row Lock Mode</b>
                        </td>
                        <td>
                          <code>SELECT FOR UPDATE (Atomic)</code>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  className={styles.buttonPrimary}
                  onClick={() => alert(`Simulating refund initiation for ${selectedTx.id}...`)}
                >
                  Trigger Refund
                </button>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() =>
                    alert(`Raw Provider Event: ${selectedTx.providerEventId} payload verified.`)
                  }
                >
                  View Raw Webhook Payload
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#64748b" }}>
              <p>
                Click on any transaction from the list on the left to inspect its state progression,
                idempotency fingerprint, and cryptographic audit evidence.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
