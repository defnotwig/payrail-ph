"use client";

import { useState } from "react";
import { PageHeader, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

export default function CardsOpsPage() {
  const [pan, setPan] = useState("4111111111111111");
  const [expMonth, setExpMonth] = useState("12");
  const [expYear, setExpYear] = useState("28");
  const [cvv, setCvv] = useState("123");
  const [amount, setAmount] = useState("1500.00");
  const [_requires3ds, setRequires3ds] = useState(true);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const [lifecycleState, setLifecycleState] = useState<
    "IDLE" | "AUTHORIZED" | "CAPTURED" | "VOIDED"
  >("IDLE");

  const maskedPan =
    pan.length >= 10 ? `${pan.substring(0, 6)}******${pan.substring(pan.length - 4)}` : pan;

  const handleAuthorize = () => {
    const amtNum = parseFloat(amount);
    if (amtNum >= 1000) {
      setRequires3ds(true);
      setChallengeUrl(
        `https://payrail-ph-web-main.vercel.app/mock-3ds?acs_trans_id=3ds_${Date.now()}&amount=${amount}`,
      );
    } else {
      setRequires3ds(false);
      setChallengeUrl(null);
    }
    setLifecycleState("AUTHORIZED");
  };

  const handleCapture = () => {
    setLifecycleState("CAPTURED");
  };

  const handleVoid = () => {
    setLifecycleState("VOIDED");
  };

  return (
    <div>
      <PageHeader
        title="Cards & 3-D Secure Educational Simulator"
        subtitle="PCI DSS-conscious architecture demonstrating tokenization, PAN masking, 3DS challenges, and the Auth/Capture/Void lifecycle."
        actions={<StatusBadge status="SUCCEEDED" customLabel="PCI SCOPE: LEVEL 1 CONSCIOUS" />}
      />

      <div className={styles.gridTwoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Test Card Sandbox Checkout</h2>
            <span className={styles.badgePill}>PCI SAFE</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label
                htmlFor="pan-input"
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary, #475569)",
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}
              >
                Primary Account Number (PAN)
              </label>
              <input
                id="pan-input"
                type="text"
                className={styles.inputField}
                value={pan}
                onChange={(e) => setPan(e.target.value)}
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-muted, #64748b)",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                Masked storage preview: <code>{maskedPan}</code>
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div>
                <label
                  htmlFor="exp-month-input"
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-secondary, #475569)",
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Exp Month
                </label>
                <input
                  id="exp-month-input"
                  type="text"
                  className={styles.inputField}
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value)}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                />
              </div>
              <div>
                <label
                  htmlFor="exp-year-input"
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-secondary, #475569)",
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Exp Year
                </label>
                <input
                  id="exp-year-input"
                  type="text"
                  className={styles.inputField}
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value)}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                />
              </div>
              <div>
                <label
                  htmlFor="cvv-input"
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-secondary, #475569)",
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  CVV (Non-stored)
                </label>
                <input
                  id="cvv-input"
                  type="password"
                  className={styles.inputField}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="amount-input"
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary, #475569)",
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}
              >
                Amount (PHP)
              </label>
              <input
                id="amount-input"
                type="text"
                className={styles.inputField}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-muted, #64748b)",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                Amounts ≥ ₱1,000.00 trigger mandatory 3-D Secure Strong Customer Authentication
                (SCA).
              </span>
            </div>

            <button type="button" className={styles.buttonPrimary} onClick={handleAuthorize}>
              Step 1: Authorize Card Payment
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Auth / Capture / Void Lifecycle State</h2>
            <StatusBadge
              status={
                lifecycleState === "CAPTURED"
                  ? "SUCCEEDED"
                  : lifecycleState === "AUTHORIZED"
                    ? "PROCESSING"
                    : lifecycleState === "VOIDED"
                      ? "FAILED"
                      : "AWAITING_PAYMENT"
              }
              customLabel={`STATE: ${lifecycleState}`}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-text-secondary, #475569)",
                lineHeight: 1.6,
              }}
            >
              In modern card acquiring, <strong>Authorization</strong> reserves credit on the
              cardholder&apos;s issuing bank. <strong>Capture</strong> executes the settlement. If
              an order is cancelled before fulfillment, a <strong>Void</strong> releases the hold
              without interchange fees.
            </p>

            {lifecycleState === "AUTHORIZED" && (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <h3
                  style={{
                    fontSize: "13px",
                    color: "#1e40af",
                    margin: "0 0 6px 0",
                    fontWeight: 700,
                  }}
                >
                  ✓ Card Authorized Successfully
                </h3>
                {challengeUrl && (
                  <p style={{ fontSize: "12px", color: "#1e3a8a", marginBottom: "12px" }}>
                    3DS Challenge URL: <code style={{ color: "#0f52ba" }}>{challengeUrl}</code>
                  </p>
                )}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" className={styles.buttonPrimary} onClick={handleCapture}>
                    Capture Authorization (Settle)
                  </button>
                  <button type="button" className={styles.buttonDanger} onClick={handleVoid}>
                    Void Authorization (Release)
                  </button>
                </div>
              </div>
            )}

            {lifecycleState === "CAPTURED" && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "14px",
                  color: "#166534",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                ✓ Transaction Captured & Settled. Balanced ledger journal posted to{" "}
                <code>payrail_private.journal_entries</code>.
              </div>
            )}

            {lifecycleState === "VOIDED" && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "14px",
                  color: "#991b1b",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                ✓ Authorization Voided. Credit hold released back to cardholder with zero processing
                fee.
              </div>
            )}

            <div className={styles.codeBlock} style={{ fontSize: "11px" }}>
              {`PCI Compliance Rule:
1. PAN: Stored ONLY as hash / token and masked display (4111 11** **** 1111)
2. CVV / CVC: NEVER persisted in PostgreSQL, disk, or logs under any circumstance
3. Key Management: Sensitive payload tokens encrypted via AES-256-GCM / KMS`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
