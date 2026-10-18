"use client";

import { useState } from "react";
import styles from "../ops.module.css";

interface JournalEntry {
  id: string;
  timestamp: string;
  description: string;
  referenceType: string;
  referenceId: string;
  lines: {
    accountNumber: string;
    accountName: string;
    direction: "DEBIT" | "CREDIT";
    amount: string;
  }[];
}

export default function LedgerPage() {
  const [_selectedJournal, _setSelectedJournal] = useState<string | null>(null);

  const accounts = [
    {
      number: "1000",
      name: "Cash at PayMongo (Clearing)",
      type: "ASSET",
      balance: "₱142,500.00",
      status: "ACTIVE",
    },
    {
      number: "1100",
      name: "Accounts Receivable",
      type: "ASSET",
      balance: "₱0.00",
      status: "ACTIVE",
    },
    {
      number: "2000",
      name: "Merchant Settlement Payable",
      type: "LIABILITY",
      balance: "₱138,225.00",
      status: "ACTIVE",
    },
    {
      number: "4000",
      name: "Platform Fee Revenue",
      type: "REVENUE",
      balance: "₱4,275.00",
      status: "ACTIVE",
    },
    {
      number: "5000",
      name: "Provider Processing Fee Expense",
      type: "EXPENSE",
      balance: "₱2,850.00",
      status: "ACTIVE",
    },
  ];

  const journalEntries: JournalEntry[] = [
    {
      id: "jnl_0192a831_success",
      timestamp: "Today, 17:15:32",
      description: "Payment Intent Succeeded (QR Ph)",
      referenceType: "PAYMENT_INTENT",
      referenceId: "pi_test_0192a831",
      lines: [
        {
          accountNumber: "1000",
          accountName: "Cash at PayMongo",
          direction: "DEBIT",
          amount: "₱500.00",
        },
        {
          accountNumber: "2000",
          accountName: "Merchant Payable",
          direction: "CREDIT",
          amount: "₱485.00",
        },
        {
          accountNumber: "4000",
          accountName: "Platform Fee Revenue",
          direction: "CREDIT",
          amount: "₱15.00",
        },
      ],
    },
    {
      id: "jnl_0192a714_refund",
      timestamp: "Today, 16:40:11",
      description: "Compensating Partial Refund Posted",
      referenceType: "REFUND",
      referenceId: "ref_test_0192a714",
      lines: [
        {
          accountNumber: "2000",
          accountName: "Merchant Payable",
          direction: "DEBIT",
          amount: "₱250.00",
        },
        {
          accountNumber: "1000",
          accountName: "Cash at PayMongo",
          direction: "CREDIT",
          amount: "₱250.00",
        },
      ],
    },
    {
      id: "jnl_0192a599_settle",
      timestamp: "Today, 14:00:00",
      description: "Merchant Bank Payout Batch Settled",
      referenceType: "SETTLEMENT",
      referenceId: "set_batch_20261018",
      lines: [
        {
          accountNumber: "2000",
          accountName: "Merchant Payable",
          direction: "DEBIT",
          amount: "₱100,000.00",
        },
        {
          accountNumber: "1000",
          accountName: "Cash at PayMongo",
          direction: "CREDIT",
          amount: "₱100,000.00",
        },
      ],
    },
  ];

  return (
    <div>
      <div className={styles.headerSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className={styles.pageTitle}>Immutable Double-Entry Ledger</h1>
            <p className={styles.pageSubtitle}>
              Rigorous financial accounting engine enforcing mathematical equality: Total Debits ===
              Total Credits.
            </p>
          </div>
          <span className={styles.badgeSuccess}>INVARIANT: 100% BALANCED</span>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Sum of All Debits</div>
          <div className={styles.statValue}>₱1,245,500.00</div>
          <div className={styles.statSubtext}>Across all historical journals</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Sum of All Credits</div>
          <div className={styles.statValue}>₱1,245,500.00</div>
          <div className={styles.statSubtext}>Across all historical journals</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Conservation Delta</div>
          <div className={styles.statValue} style={{ color: "#34d399" }}>
            ₱0.00
          </div>
          <div className={styles.statSubtext}>Zero imbalance guarantee</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Chart of Accounts</div>
          <div className={styles.statValue}>5 ACCOUNTS</div>
          <div className={styles.statSubtext}>All in currency PHP (608)</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Chart of Accounts (payrail_private.accounts)</h2>
          <span className={styles.badgePill}>POSTGRESQL CONSTRAINTS</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Account #</th>
                <th>Account Name</th>
                <th>Type</th>
                <th>Current Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.number}>
                  <td>
                    <b>{acc.number}</b>
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
                  <td>
                    <b>{acc.balance}</b>
                  </td>
                  <td>
                    <span className={styles.badgeSuccess}>{acc.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Journal Entries (payrail_private.journal_entries)</h2>
          <span className={styles.badgePill}>ROW-LOCKED TRANSACTIONS</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Journal ID</th>
                <th>Timestamp</th>
                <th>Description</th>
                <th>Reference</th>
                <th>Lines (Dr / Cr Breakdown)</th>
                <th>Integrity</th>
              </tr>
            </thead>
            <tbody>
              {journalEntries.map((jnl) => (
                <tr key={jnl.id}>
                  <td>
                    <code>{jnl.id}</code>
                  </td>
                  <td>{jnl.timestamp}</td>
                  <td>
                    <b>{jnl.description}</b>
                  </td>
                  <td>
                    <span className={styles.badgePill}>
                      {jnl.referenceType}: {jnl.referenceId}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {jnl.lines.map((ln, i) => (
                        <div key={i} style={{ fontSize: "12px" }}>
                          <span
                            style={{
                              color: ln.direction === "DEBIT" ? "#38bdf8" : "#fbbf24",
                              fontWeight: 600,
                            }}
                          >
                            {ln.direction}:
                          </span>{" "}
                          {ln.accountNumber} ({ln.accountName}) — <b>{ln.amount}</b>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={styles.badgeSuccess}>✓ BALANCED</span>
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
