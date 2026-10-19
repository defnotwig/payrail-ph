"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Amount,
  MetricCard,
  MetricGrid,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "../../../components/ui";
import styles from "../ops.module.css";

interface AccountBalanceRecord {
  accountId: string;
  accountNumber: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  currency: string;
  debitTotalMinor: string;
  creditTotalMinor: string;
  netBalanceMinor: string;
}

interface JournalEntryLine {
  id: string;
  accountNumber: string;
  accountName: string;
  direction: "DEBIT" | "CREDIT";
  amountMinor: string;
  currency: string;
}

interface JournalEntryRecord {
  id: string;
  entryNumber: string;
  referenceType: string;
  referenceId: string;
  description: string;
  postedAt: string;
  lines: JournalEntryLine[];
}

interface LedgerResponse {
  data?: {
    accounts?: AccountBalanceRecord[];
    entries?: JournalEntryRecord[];
  };
}

export default function LedgerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountBalanceRecord[]>([]);
  const [entries, setEntries] = useState<JournalEntryRecord[]>([]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/ops/ledger");
      if (!res.ok) {
        throw new Error(`Ledger service returned HTTP ${res.status}`);
      }
      const json: LedgerResponse = await res.json();
      setAccounts(json.data?.accounts || []);
      setEntries(json.data?.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ledger records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  // Compute actual aggregated ledger debits and credits from real journal entries
  let totalDebitsMinor = 0;
  let totalCreditsMinor = 0;

  for (const entry of entries) {
    for (const line of entry.lines) {
      const amt = Number(line.amountMinor) || 0;
      if (line.direction === "DEBIT") {
        totalDebitsMinor += amt;
      } else if (line.direction === "CREDIT") {
        totalCreditsMinor += amt;
      }
    }
  }

  const deltaMinor = totalDebitsMinor - totalCreditsMinor;
  const isBalanced = deltaMinor === 0;

  return (
    <div>
      <PageHeader
        title="Immutable Double-Entry Ledger"
        subtitle="Mathematical equality engine enforcing fundamental conservation: Total Debits === Total Credits per transaction (ISO 4217 PHP)."
        actions={
          <StatusBadge
            status={isBalanced ? "SUCCEEDED" : "FAILED"}
            customLabel={isBalanced ? "INVARIANT: 100% BALANCED" : "IMBALANCE DETECTED"}
          />
        }
      />

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          <strong>Ledger Operational Warning:</strong> {error}
        </div>
      )}

      <MetricGrid>
        <MetricCard
          label="Sum of All Debits"
          value={
            loading ? (
              <Skeleton height="28px" width="120px" />
            ) : entries.length > 0 ? (
              `₱${(totalDebitsMinor / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
            ) : (
              "—"
            )
          }
          metadata={
            entries.length > 0
              ? "Summed across all historical journal lines"
              : "No journal entries posted yet"
          }
        />
        <MetricCard
          label="Sum of All Credits"
          value={
            loading ? (
              <Skeleton height="28px" width="120px" />
            ) : entries.length > 0 ? (
              `₱${(totalCreditsMinor / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
            ) : (
              "—"
            )
          }
          metadata={
            entries.length > 0
              ? "Summed across all historical journal lines"
              : "No journal entries posted yet"
          }
        />
        <MetricCard
          label="Conservation Delta"
          value={
            loading ? (
              <Skeleton height="28px" width="80px" />
            ) : (
              <span style={{ color: isBalanced ? "#166534" : "#991b1b" }}>
                ₱{(deltaMinor / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </span>
            )
          }
          metadata="Zero imbalance guarantee"
        />
        <MetricCard
          label="Chart of Accounts"
          value={loading ? <Skeleton height="28px" width="100px" /> : `${accounts.length} ACCOUNTS`}
          metadata="All mapped in PostgreSQL"
        />
      </MetricGrid>

      {/* Chart of Accounts */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Chart of Accounts (payrail_private.accounts)</h2>
          <span className={styles.badgePill}>POSTGRESQL CONSTRAINTS</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Account #</th>
                <th scope="col">Account Name</th>
                <th scope="col">Type</th>
                <th scope="col" className={styles.numCol}>
                  Current Balance
                </th>
                <th scope="col">Currency</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: "20px" }}>
                    <Skeleton height="32px" />
                  </td>
                </tr>
              ) : accounts.length > 0 ? (
                accounts.map((acc) => (
                  <tr key={acc.accountId}>
                    <td>
                      <code>{acc.accountNumber}</code>
                    </td>
                    <td>{acc.name}</td>
                    <td>
                      <span
                        className={
                          acc.type === "ASSET"
                            ? styles.badgePill
                            : acc.type === "LIABILITY"
                              ? styles.badgeDanger
                              : styles.badgeSuccess
                        }
                      >
                        {acc.type}
                      </span>
                    </td>
                    <td className={styles.numCol}>
                      <Amount
                        amountMinor={Number(acc.netBalanceMinor) || 0}
                        currency="PHP"
                        align="right"
                      />
                    </td>
                    <td>{acc.currency}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: "center", padding: "32px", color: "#64748b" }}
                  >
                    No accounts registered in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Journal Entries */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Journal Entries (payrail_private.journal_entries)</h2>
          <span className={styles.badgePill}>ATOMIC MULTI-LEGGED POSTINGS</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px" }}>
            <Skeleton height="80px" borderRadius="8px" />
            <Skeleton height="80px" borderRadius="8px" />
          </div>
        ) : entries.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {entries.map((jnl) => {
              const entryDebits = jnl.lines
                .filter((l) => l.direction === "DEBIT")
                .reduce((sum, l) => sum + (Number(l.amountMinor) || 0), 0);
              const entryCredits = jnl.lines
                .filter((l) => l.direction === "CREDIT")
                .reduce((sum, l) => sum + (Number(l.amountMinor) || 0), 0);
              const entryBalanced = entryDebits === entryCredits;

              return (
                <div
                  key={jnl.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid #e2e8f0",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                        {jnl.entryNumber || jnl.id}
                      </span>
                      <span style={{ color: "#64748b", fontSize: "12px", marginLeft: "10px" }}>
                        {new Date(jnl.postedAt).toLocaleString("en-PH")}
                      </span>
                      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#475569" }}>
                        {jnl.description} · Ref: <code>{jnl.referenceId}</code> ({jnl.referenceType}
                        )
                      </p>
                    </div>

                    <StatusBadge
                      status={entryBalanced ? "SUCCEEDED" : "FAILED"}
                      customLabel={entryBalanced ? "BALANCED" : "IMBALANCE"}
                    />
                  </div>

                  <table className={styles.table} style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th scope="col">Account #</th>
                        <th scope="col">Account Name</th>
                        <th scope="col" className={styles.numCol}>
                          Debit (PHP)
                        </th>
                        <th scope="col" className={styles.numCol}>
                          Credit (PHP)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {jnl.lines.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <code>{l.accountNumber}</code>
                          </td>
                          <td>{l.accountName}</td>
                          <td className={styles.numCol}>
                            {l.direction === "DEBIT" ? (
                              <Amount
                                amountMinor={Number(l.amountMinor) || 0}
                                currency="PHP"
                                align="right"
                              />
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                          <td className={styles.numCol}>
                            {l.direction === "CREDIT" ? (
                              <Amount
                                amountMinor={Number(l.amountMinor) || 0}
                                currency="PHP"
                                align="right"
                              />
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📖</div>
            <h3
              style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}
            >
              No Journal Entries Recorded Yet
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "#64748b",
                maxWidth: "480px",
                margin: "0 auto 16px",
              }}
            >
              Double-entry journal records are posted automatically upon webhook settlement
              confirmation or refund execution.
            </p>
            <Link
              href="/demo/qrph"
              className={styles.buttonPrimary}
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              Generate QR Ph Sandbox Payment →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
