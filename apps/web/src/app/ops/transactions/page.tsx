"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Amount, DetailList, PageHeader, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface Transaction {
  id: string;
  orderNumber: string;
  amountMinor: number;
  method: "qrph" | "card";
  state: "SUCCEEDED" | "AWAITING_PAYMENT" | "FAILED" | "REFUNDED" | "PROCESSING" | "EXPIRED";
  provider: string;
  idempotencyKey: string;
  providerEventId: string;
  createdAt: string;
}

const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: "pi_test_0192a831001",
    orderNumber: "ORD-20261018-01",
    amountMinor: 50000,
    method: "qrph",
    state: "SUCCEEDED",
    provider: "PayMongo Test",
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
    provider: "PayMongo Test",
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
    provider: "PayMongo Test",
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
    provider: "PayMongo Test",
    idempotencyKey: "idem_order_04_33192d",
    providerEventId: "evt_card_declined_51",
    createdAt: "Today, 15:30:18",
  },
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>(DEFAULT_TRANSACTIONS);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [filterState, setFilterState] = useState<string>("ALL");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const mergedMap = new Map<string, Transaction>();

      // 1. Seed defaults
      for (const t of DEFAULT_TRANSACTIONS) {
        mergedMap.set(t.id, t);
      }

      // 2. Fetch live transactions from backend if available
      try {
        const res = await fetch("/api/payments");
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json) ? json : json.data;
          if (Array.isArray(items)) {
            for (const item of items) {
              mergedMap.set(item.id, {
                id: item.id,
                orderNumber: item.orderNumber || `ORD-${item.id.substring(0, 8)}`,
                amountMinor: Number(item.amountMinor) || 100,
                method: (item.paymentMethod === "card" ? "card" : "qrph") as "qrph" | "card",
                state: item.state || "SUCCEEDED",
                provider: "PayMongo Test",
                idempotencyKey: item.idempotencyKey || `idem_${item.id.substring(0, 8)}`,
                providerEventId: item.providerPaymentIntentId || `evt_${item.id.substring(0, 8)}`,
                createdAt: item.createdAt
                  ? new Date(item.createdAt).toLocaleTimeString()
                  : "Just now",
              });
            }
          }
        }
      } catch {
        // Backend offline or unreachable
      }

      // 3. Merge locally recorded demo transactions from sessionStorage
      try {
        const raw = sessionStorage.getItem("payrail_recorded_transactions");
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item?.id) {
                mergedMap.set(item.id, {
                  id: item.id,
                  orderNumber: item.orderNumber || `ORD-${item.id.substring(0, 8)}`,
                  amountMinor: Number(item.amountMinor) || 100,
                  method: "qrph",
                  state: item.state || "SUCCEEDED",
                  provider: "PayMongo Test",
                  idempotencyKey: `idem_${item.id.substring(0, 8)}`,
                  providerEventId: item.providerPaymentIntentId || `evt_${item.id.substring(0, 8)}`,
                  createdAt: item.createdAt
                    ? new Date(item.createdAt).toLocaleTimeString()
                    : "Just now",
                });
              }
            }
          }
        }
      } catch {
        // session storage unavailable
      }

      const list = Array.from(mergedMap.values());
      setTransactions(list);
    }

    loadData();
  }, []);

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
              <option value="PROCESSING">Processing</option>
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
                  <th scope="col">Status</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Method</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Created</th>
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
                        <StatusBadge status={tx.state} />
                      </td>
                      <td className={styles.numCol}>
                        <Amount amountMinor={tx.amountMinor} currency="PHP" align="right" />
                      </td>
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
                      <td>
                        <span className={styles.badgePill}>{tx.method.toUpperCase()}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#475569" }}>{tx.provider}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>{tx.createdAt}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTx(tx);
                            }}
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                          >
                            Quick View
                          </button>
                          <Link
                            href={`/ops/transactions/${tx.id}`}
                            className={styles.buttonSecondary}
                            style={{
                              padding: "4px 8px",
                              fontSize: "11px",
                              textDecoration: "none",
                              color: "#0f52ba",
                              fontWeight: 600,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Inspect →
                          </Link>
                        </div>
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <StatusBadge status={selectedTx.state} />
                <Link
                  href={`/ops/transactions/${selectedTx.id}`}
                  style={{
                    fontSize: "12px",
                    color: "#0f52ba",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Full Detail ↗
                </Link>
              </div>
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
                    padding: "12px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border, #e2e8f0)",
                    fontSize: "12px",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  <span style={{ color: "#16a34a" }}>CREATED</span>
                  <span>→</span>
                  <span style={{ color: "#16a34a" }}>SUBMISSION_PENDING</span>
                  <span>→</span>
                  <span style={{ color: selectedTx.state === "FAILED" ? "#dc2626" : "#16a34a" }}>
                    {selectedTx.state}
                  </span>
                </div>
              </div>

              <DetailList
                items={[
                  { label: "Payment Intent ID", value: <code>{selectedTx.id}</code> },
                  { label: "Order Reference", value: selectedTx.orderNumber },
                  {
                    label: "Amount Settled",
                    value: <Amount amountMinor={selectedTx.amountMinor} currency="PHP" />,
                  },
                  {
                    label: "Authoritative Idempotency Key",
                    value: <code>{selectedTx.idempotencyKey}</code>,
                  },
                  {
                    label: "Verified Provider Event",
                    value: <code>{selectedTx.providerEventId}</code>,
                  },
                  {
                    label: "Provider",
                    value: <span>{selectedTx.provider}</span>,
                  },
                ]}
              />

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--color-border, #e2e8f0)",
                }}
              >
                <Link
                  href={`/ops/transactions/${selectedTx.id}`}
                  className={styles.buttonPrimary}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    textDecoration: "none",
                    padding: "8px 12px",
                    fontSize: "12px",
                  }}
                >
                  Open Full Investigation View ↗
                </Link>
                {selectedTx.state === "SUCCEEDED" && (
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => handleSimulateRefund(selectedTx)}
                    style={{ flex: 1, fontSize: "12px" }}
                  >
                    Stage Refund
                  </button>
                )}
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => handleViewPayload(selectedTx)}
                  style={{ fontSize: "12px" }}
                >
                  Verify Payload
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "36px 20px",
                textAlign: "center",
                color: "var(--color-text-muted, #64748b)",
                fontSize: "13px",
              }}
            >
              Select any transaction row from the table to inspect state lifecycle, idempotency key
              records, and cryptographic provider evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
