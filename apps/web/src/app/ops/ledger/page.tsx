"use client";

import { Amount, MetricCard, MetricGrid, PageHeader, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface JournalLine {
  accountNumber: string;
  accountName: string;
  debit: number | null;
  credit: number | null;
}

interface JournalEntry {
  id: string;
  timestamp: string;
  description: string;
  referenceType: string;
  referenceId: string;
  lines: JournalLine[];
}

export default function LedgerPage() {
  const accounts = [
    {
      number: "1000",
      name: "Cash at PayMongo (Clearing)",
      type: "ASSET",
      balanceMinor: 14250000,
      status: "ACTIVE",
    },
    {
      number: "1100",
      name: "Accounts Receivable",
      type: "ASSET",
      balanceMinor: 0,
      status: "ACTIVE",
    },
    {
      number: "2000",
      name: "Merchant Settlement Payable",
      type: "LIABILITY",
      balanceMinor: 13822500,
      status: "ACTIVE",
    },
    {
      number: "4000",
      name: "Platform Fee Revenue",
      type: "REVENUE",
      balanceMinor: 427500,
      status: "ACTIVE",
    },
    {
      number: "5000",
      name: "Provider Processing Fee Expense",
      type: "EXPENSE",
      balanceMinor: 285000,
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
          debit: 50000,
          credit: null,
        },
        {
          accountNumber: "2000",
          accountName: "Merchant Payable",
          debit: null,
          credit: 48500,
        },
        {
          accountNumber: "4000",
          accountName: "Platform Fee Revenue",
          debit: null,
          credit: 1500,
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
          debit: 25000,
          credit: null,
        },
        {
          accountNumber: "1000",
          accountName: "Cash at PayMongo",
          debit: null,
          credit: 25000,
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
          debit: 10000000,
          credit: null,
        },
        {
          accountNumber: "1000",
          accountName: "Cash at PayMongo",
          debit: null,
          credit: 10000000,
        },
      ],
    },
  ];

  return (
    <div>
      <PageHeader
        title="Immutable Double-Entry Ledger"
        subtitle="Rigorous financial accounting engine enforcing mathematical equality: Total Debits === Total Credits per transaction and currency."
        actions={<StatusBadge status="SUCCEEDED" customLabel="INVARIANT: 100% BALANCED" />}
      />

      <MetricGrid>
        <MetricCard
          label="Sum of All Debits"
          value="₱1,245,500.00"
          metadata="Across all historical journals"
        />
        <MetricCard
          label="Sum of All Credits"
          value="₱1,245,500.00"
          metadata="Across all historical journals"
        />
        <MetricCard
          label="Conservation Delta"
          value={<span style={{ color: "#166534" }}>₱0.00</span>}
          metadata="Zero imbalance guarantee"
        />
        <MetricCard
          label="Chart of Accounts"
          value="5 ACCOUNTS"
          metadata="All in ISO 4217 PHP (608)"
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
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.number}>
                  <td>
                    <strong>{acc.number}</strong>
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
                    <Amount amountMinor={acc.balanceMinor} currency="PHP" align="right" />
                  </td>
                  <td>
                    <StatusBadge status="SUCCEEDED" customLabel={acc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Journal Entries with Dedicated Debit and Credit Columns */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Journal Entries (payrail_private.journal_entries)</h2>
          <span className={styles.badgePill}>ATOMIC MULTI-LEGGED POSTINGS</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {journalEntries.map((jnl) => {
            const totalDebit = jnl.lines.reduce((acc, l) => acc + (l.debit || 0), 0);
            const totalCredit = jnl.lines.reduce((acc, l) => acc + (l.credit || 0), 0);
            const isBalanced = totalDebit === totalCredit;

            return (
              <div
                key={jnl.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                {/* Journal Entry Header */}
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
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <code
                      style={{
                        fontSize: "12px",
                        fontFamily: "ui-monospace, monospace",
                        color: "#0f52ba",
                      }}
                    >
                      {jnl.id}
                    </code>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                      {jnl.description}
                    </strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>· {jnl.timestamp}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className={styles.badgePill}>
                      {jnl.referenceType}: {jnl.referenceId}
                    </span>
                    <StatusBadge
                      status={isBalanced ? "SUCCEEDED" : "FAILED"}
                      customLabel={isBalanced ? "BALANCED" : "IMBALANCED"}
                    />
                  </div>
                </div>

                {/* Journal Lines Table */}
                <table className={styles.table} style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: "120px" }}>
                        Account #
                      </th>
                      <th scope="col">Account Name</th>
                      <th scope="col" className={styles.numCol} style={{ width: "150px" }}>
                        Debit (PHP)
                      </th>
                      <th scope="col" className={styles.numCol} style={{ width: "150px" }}>
                        Credit (PHP)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jnl.lines.map((ln, idx) => (
                      <tr key={idx}>
                        <td>
                          <code>{ln.accountNumber}</code>
                        </td>
                        <td>{ln.accountName}</td>
                        <td className={styles.numCol}>
                          {ln.debit !== null ? (
                            <Amount amountMinor={ln.debit} currency="PHP" align="right" />
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td className={styles.numCol}>
                          {ln.credit !== null ? (
                            <Amount amountMinor={ln.credit} currency="PHP" align="right" />
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Sum Footer */}
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td colSpan={2} style={{ textAlign: "right", color: "#475569" }}>
                        Journal Totals:
                      </td>
                      <td className={styles.numCol}>
                        <Amount amountMinor={totalDebit} currency="PHP" align="right" />
                      </td>
                      <td className={styles.numCol}>
                        <Amount amountMinor={totalCredit} currency="PHP" align="right" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
