"use client";

import { useState } from "react";
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
      <div className={styles.headerSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className={styles.pageTitle}>Cards & 3-D Secure Educational Simulator</h1>
            <p className={styles.pageSubtitle}>
              PCI DSS-conscious architecture demonstrating tokenization, PAN masking, 3DS
              challenges, and the Auth/Capture/Void lifecycle.
            </p>
          </div>
          <span className={styles.badgeSuccess}>PCI SCOPE: LEVEL 1 CONSCIOUS</span>
        </div>
      </div>

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
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: "6px",
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
              />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Masked storage preview: <code>{maskedPan}</code>
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div>
                <label
                  htmlFor="exp-month-input"
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    display: "block",
                    marginBottom: "6px",
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
                />
              </div>
              <div>
                <label
                  htmlFor="exp-year-input"
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    display: "block",
                    marginBottom: "6px",
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
                />
              </div>
              <div>
                <label
                  htmlFor="cvv-input"
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    display: "block",
                    marginBottom: "6px",
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
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: "6px",
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
              />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
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
            <span
              className={
                lifecycleState === "CAPTURED"
                  ? styles.badgeSuccess
                  : lifecycleState === "AUTHORIZED"
                    ? styles.badgePill
                    : lifecycleState === "VOIDED"
                      ? styles.badgeDanger
                      : styles.badgeSandbox
              }
            >
              STATE: {lifecycleState}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>
              In modern card acquiring, <b>Authorization</b> reserves credit on the
              cardholder&apos;s issuing bank. <b>Capture</b> executes the settlement. If an order is
              cancelled before fulfillment, a <b>Void</b> releases the hold without interchange
              fees.
            </p>

            {lifecycleState === "AUTHORIZED" && (
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.1)",
                  border: "1px solid #3b82f6",
                  borderRadius: "6px",
                  padding: "14px",
                }}
              >
                <h3 style={{ fontSize: "13px", color: "#60a5fa", margin: "0 0 6px 0" }}>
                  ✓ Card Authorized Successfully
                </h3>
                {challengeUrl && (
                  <p style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "10px" }}>
                    3DS Challenge URL: <code style={{ color: "#38bdf8" }}>{challengeUrl}</code>
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
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid #10b981",
                  borderRadius: "6px",
                  padding: "14px",
                  color: "#34d399",
                  fontSize: "13px",
                }}
              >
                ✓ Transaction Captured & Settled. Balanced ledger journal posted to{" "}
                <code>payrail_private.journal_entries</code>.
              </div>
            )}

            {lifecycleState === "VOIDED" && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid #ef4444",
                  borderRadius: "6px",
                  padding: "14px",
                  color: "#f87171",
                  fontSize: "13px",
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
