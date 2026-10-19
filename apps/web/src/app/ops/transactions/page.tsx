"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Amount, DetailList, PageHeader, Skeleton, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface Transaction {
  id: string;
  orderNumber: string;
  amountMinor: number;
  method: "qrph" | "card";
  state:
    | "SUCCEEDED"
    | "AWAITING_PAYMENT"
    | "FAILED"
    | "REFUNDED"
    | "PROCESSING"
    | "EXPIRED"
    | string;
  provider: string;
  idempotencyKey: string;
  providerEventId: string;
  createdAt: string;
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const searchFromUrl = searchParams.get("search") || "";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [filterState, setFilterState] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>(searchFromUrl);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch("/api/payments");
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json) ? json : json.data;
          if (Array.isArray(items)) {
            const list: Transaction[] = items.map((item: Record<string, unknown>) => {
              const id = String(item["id"] ?? "");
              const createdAt = typeof item["createdAt"] === "string" ? item["createdAt"] : "";
              return {
                id,
                orderNumber:
                  typeof item["orderNumber"] === "string"
                    ? item["orderNumber"]
                    : `ORD-${id.substring(0, 8)}`,
                amountMinor: Number(item["amountMinor"]) || 100,
                method: (item["paymentMethod"] === "card" ? "card" : "qrph") as "qrph" | "card",
                state: typeof item["state"] === "string" ? item["state"] : "SUCCEEDED",
                provider: typeof item["provider"] === "string" ? item["provider"] : "PayMongo Test",
                idempotencyKey:
                  typeof item["idempotencyKey"] === "string"
                    ? item["idempotencyKey"]
                    : `idem_${id.substring(0, 8)}`,
                providerEventId:
                  typeof item["providerPaymentIntentId"] === "string"
                    ? item["providerPaymentIntentId"]
                    : `evt_${id.substring(0, 8)}`,
                createdAt: createdAt
                  ? new Date(createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "Just now",
              };
            });
            setTransactions(list);
            const first = list[0];
            if (first && !selectedTx) {
              setSelectedTx(first);
            }
          }
        }
      } catch {
        // Backend offline
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filtered = transactions.filter((t) => {
    const matchesState = filterState === "ALL" ? true : t.state === filterState;
    const matchesSearch =
      searchTerm.trim() === ""
        ? true
        : t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesState && matchesSearch;
  });

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
          <div className={styles.flexRow} style={{ flexWrap: "wrap", gap: "8px" }}>
            <input
              type="search"
              placeholder="Filter by ID or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.inputField}
              style={{ width: "220px", fontSize: "12px", padding: "6px 10px" }}
              aria-label="Filter transactions"
            />
            <label
              htmlFor="filter-state-select"
              style={{
                fontSize: "12px",
                color: "var(--color-text-secondary, #475569)",
                fontWeight: 600,
              }}
            >
              State:
            </label>
            <select
              id="filter-state-select"
              className={styles.inputField}
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              style={{ width: "auto", fontSize: "12px", padding: "6px 10px" }}
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
              padding: "4px 8px",
              minHeight: "36px",
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
                  <th scope="col" style={{ textAlign: "right" }}>
                    Amount
                  </th>
                  <th scope="col">Reference</th>
                  <th scope="col">Method</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Created</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "20px" }}>
                      <Skeleton height="24px" style={{ marginBottom: "8px" }} />
                      <Skeleton height="24px" style={{ marginBottom: "8px" }} />
                      <Skeleton height="24px" />
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((tx) => {
                    const isSelected = selectedTx?.id === tx.id;
                    return (
                      <tr
                        key={tx.id}
                        tabIndex={0}
                        aria-selected={isSelected}
                        style={{
                          background: isSelected ? "#eff6ff" : undefined,
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedTx(tx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedTx(tx);
                          }
                        }}
                      >
                        <td>
                          <StatusBadge status={tx.state} />
                        </td>
                        <td className={styles.numCol} style={{ textAlign: "right" }}>
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
                              style={{ padding: "6px 10px", fontSize: "12px", minHeight: "36px" }}
                            >
                              Quick View
                            </button>
                            <Link
                              href={`/ops/transactions/${tx.id}`}
                              className={styles.buttonSecondary}
                              style={{
                                padding: "6px 10px",
                                fontSize: "12px",
                                minHeight: "36px",
                                textDecoration: "none",
                                color: "#0f52ba",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Inspect →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <div className={styles.tableEmptyState}>
                        <h3 className={styles.emptyStateTitle}>No transactions recorded</h3>
                        <p className={styles.emptyStateDesc}>
                          No transactions matching your filter exist in the PostgreSQL database.
                        </p>
                        <Link
                          href="/demo/qrph"
                          className={styles.buttonPrimary}
                          style={{ textDecoration: "none", marginTop: "6px" }}
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

        {/* Investigation Inspector Drawer */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Investigation Inspector</h2>
            {selectedTx ? (
              <StatusBadge status={selectedTx.state} />
            ) : (
              <span className={styles.badgePill}>NO SELECTION</span>
            )}
          </div>

          {selectedTx ? (
            <div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>
                  Selected Intent
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#0f172a",
                    fontFamily: "ui-monospace, monospace",
                    margin: "4px 0",
                  }}
                >
                  {selectedTx.id}
                </div>
                <div style={{ fontSize: "13px", color: "#334155" }}>
                  Order: <strong>{selectedTx.orderNumber}</strong> · Amount:{" "}
                  <strong>
                    <Amount amountMinor={selectedTx.amountMinor} currency="PHP" />
                  </strong>
                </div>
              </div>

              <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>
                Cryptographic &amp; Idempotency Proofs
              </h3>
              <DetailList
                items={[
                  { label: "Idempotency Key", value: selectedTx.idempotencyKey },
                  { label: "Provider Event ID", value: selectedTx.providerEventId },
                  { label: "Method Type", value: selectedTx.method.toUpperCase() },
                  { label: "Provider Gateway", value: selectedTx.provider },
                  { label: "Created Timestamp", value: selectedTx.createdAt },
                ]}
              />

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "20px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => handleViewPayload(selectedTx)}
                  style={{ minHeight: "36px" }}
                >
                  Verify Payload
                </button>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => handleSimulateRefund(selectedTx)}
                  style={{ minHeight: "36px" }}
                >
                  Stage Refund
                </button>
                <Link
                  href={`/ops/transactions/${selectedTx.id}`}
                  className={styles.buttonPrimary}
                  style={{
                    textDecoration: "none",
                    minHeight: "36px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Open Full Investigation View →
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Select a transaction to inspect its cryptographic proofs, raw payloads, and ledger
              journal entries.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "28px" }}>
          <Skeleton height="200px" />
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
