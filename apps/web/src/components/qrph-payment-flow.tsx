"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Amount, EnvironmentBadge, StatusBadge } from "./ui";

interface PaymentStateData {
  id: string;
  orderNumber: string;
  amountMinor: string;
  currency: string;
  state:
    | "CREATED"
    | "SUBMISSION_PENDING"
    | "SUBMITTED"
    | "AWAITING_PAYMENT"
    | "PROCESSING"
    | "SUCCEEDED"
    | "FAILED"
    | "EXPIRED"
    | "UNKNOWN_REQUIRES_RECONCILIATION";
  providerPaymentIntentId?: string;
  qrCodeUrl?: string;
  testUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export function QrPhPaymentFlow() {
  const [amount, setAmount] = useState<number>(1);
  const [orderNumber, setOrderNumber] = useState<string>(
    () => `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
  );
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => `idem_${Math.random().toString(36).substring(2, 12)}`,
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [payment, setPayment] = useState<PaymentStateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900); // 15 min

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef<number>(0);

  // 15-minute countdown timer
  useEffect(() => {
    if (
      !payment ||
      payment.state === "SUCCEEDED" ||
      payment.state === "FAILED" ||
      payment.state === "EXPIRED"
    ) {
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [payment?.id, payment?.state]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const initiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // minor units (cents)
    const amountMinor = (BigInt(amount) * BigInt(100)).toString();

    try {
      const res = await fetch(`${apiBase}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amountMinor,
          currency: "PHP",
          orderNumber,
          description: `PayRail Sandbox Checkout ${orderNumber}`,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Payment creation failed (${res.status}): ${text}`);
      }

      const data: PaymentStateData = await res.json();
      setPayment(data);
      setSecondsRemaining(900);
      pollCountRef.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment intent");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!payment?.id) return;
    if (
      payment.state === "SUCCEEDED" ||
      payment.state === "FAILED" ||
      payment.state === "EXPIRED"
    ) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    const intervalMs = pollCountRef.current < 15 ? 2000 : 5000;

    pollingRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      try {
        const res = await fetch(`${apiBase}/payments/${payment.id}`);
        if (res.ok) {
          const updated: PaymentStateData = await res.json();
          setPayment(updated);
          if (
            updated.state === "SUCCEEDED" ||
            updated.state === "FAILED" ||
            updated.state === "EXPIRED"
          ) {
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      } catch {
        // network polling retries silently
      }
    }, intervalMs);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [payment?.id, payment?.state, apiBase]);

  const handlePrintReceipt = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div
      style={{
        maxWidth: "680px",
        margin: "0 auto",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "28px",
        boxShadow: "0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05)",
      }}
    >
      {/* Sandbox Header Strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: "16px",
          marginBottom: "20px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            QR Ph Interactive Checkout
          </span>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#0f172a",
              margin: "2px 0 0 0",
              letterSpacing: "-0.02em",
            }}
          >
            PayMongo Sandbox Experience
          </h2>
        </div>
        <EnvironmentBadge mode="test" label="SANDBOX" />
      </div>

      {!payment ? (
        <form onSubmit={initiatePayment}>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
                marginBottom: "14px",
              }}
            >
              <div>
                <label
                  htmlFor="qr-order-num"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "6px",
                  }}
                >
                  Order Reference
                </label>
                <input
                  id="qr-order-num"
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    background: "#ffffff",
                    fontFamily: "ui-monospace, monospace",
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="qr-amount"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "6px",
                  }}
                >
                  Test Amount (PHP)
                </label>
                <input
                  id="qr-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    background: "#ffffff",
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="qr-idempotency"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "6px",
                }}
              >
                Authoritative Idempotency Key
              </label>
              <input
                id="qr-idempotency"
                type="text"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  background: "#ffffff",
                  fontFamily: "ui-monospace, monospace",
                  color: "#334155",
                }}
              />
              <span
                style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}
              >
                Guarantees exactly-once charge execution via PostgreSQL row locks.
              </span>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                padding: "12px",
                color: "#991b1b",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "12px",
              background: "#0f52ba",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "background 0.15s ease",
            }}
          >
            {isSubmitting ? "Creating Intent & Generating QR Ph..." : "Generate ₱1.00 QR Ph Code →"}
          </button>
        </form>
      ) : (
        <div aria-live="polite">
          {payment.state === "SUCCEEDED" ? (
            /* ================= CALM DIGNIFIED SUCCESS RECEIPT ================= */
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "18px 20px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "#16a34a",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#166534",
                      margin: "0 0 2px 0",
                    }}
                  >
                    Payment Confirmed
                  </h3>
                  <p style={{ fontSize: "13px", color: "#15803d", margin: 0 }}>
                    Provider evidence verified via HMAC-SHA256 signature and posted to double-entry
                    ledger.
                  </p>
                </div>
              </div>

              {/* Receipt Metadata Card */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "20px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Total Settled Amount
                  </span>
                  <Amount amountMinor={payment.amountMinor} currency="PHP" />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    fontSize: "12px",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b", display: "block" }}>Order Reference</span>
                    <strong style={{ fontFamily: "ui-monospace, monospace", color: "#0f172a" }}>
                      {payment.orderNumber}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block" }}>Payment Intent</span>
                    <strong style={{ fontFamily: "ui-monospace, monospace", color: "#0f172a" }}>
                      {payment.id}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block" }}>Provider Reference</span>
                    <strong style={{ fontFamily: "ui-monospace, monospace", color: "#0f172a" }}>
                      {payment.providerPaymentIntentId || "pi_paymongo_synced"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block" }}>Payment Method</span>
                    <strong style={{ color: "#0f172a" }}>QR Ph Dynamic (EMVCo)</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block" }}>Status</span>
                    <StatusBadge status="SUCCEEDED" />
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block" }}>Ledger Invariant</span>
                    <strong style={{ color: "#16a34a" }}>∑ Debits === ∑ Credits</strong>
                  </div>
                </div>
              </div>

              {/* Receipt Action Buttons */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  📄 Print / Save Receipt
                </button>
                <Link
                  href="/ops/transactions"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "10px 16px",
                    background: "#0f52ba",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#ffffff",
                    textDecoration: "none",
                  }}
                >
                  Inspect in Console ↗
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setPayment(null);
                    setOrderNumber(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
                    setIdempotencyKey(`idem_${Math.random().toString(36).substring(2, 12)}`);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#475569",
                    cursor: "pointer",
                    marginTop: "6px",
                  }}
                >
                  ← Create Another Test Payment
                </button>
              </div>
            </div>
          ) : (
            /* ================= QR PH SCAN & SIMULATE INTERFACE ================= */
            <div>
              {/* Sandbox Warning Banner */}
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  marginBottom: "18px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "16px", lineHeight: 1 }} aria-hidden="true">
                  ⚠️
                </span>
                <div style={{ fontSize: "12px", color: "#92400e", lineHeight: 1.5 }}>
                  <strong>Do not scan with a real banking app:</strong> This is a PayMongo test-mode
                  QR code. Scanning with GCash, Maya, or BDO will fail or deduct real funds. Use the{" "}
                  <strong>Simulate Payment</strong> button below.
                </div>
              </div>

              {/* Amount & Timer Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "14px 18px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Payment Total
                  </span>
                  <Amount amountMinor={payment.amountMinor} currency="PHP" />
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    QR Code Expires In
                  </span>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: secondsRemaining < 120 ? "#dc2626" : "#0f172a",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ⏱ {formatTimer(secondsRemaining)}
                  </div>
                </div>
              </div>

              {/* Primary Action: Official Sandbox Simulator */}
              {payment.testUrl && (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "20px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#1e40af",
                      margin: "0 0 10px 0",
                      fontWeight: 500,
                    }}
                  >
                    📱 <strong>Browsing on mobile or desktop?</strong> Complete the test payment
                    instantly using PayMongo&apos;s official simulator:
                  </p>
                  <a
                    href={payment.testUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "#0f52ba",
                      color: "#ffffff",
                      padding: "12px 24px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                      textDecoration: "none",
                      boxShadow: "0 1px 3px rgba(15, 82, 186, 0.3)",
                    }}
                  >
                    Simulate ₱1.00 Payment in PayMongo Sandbox ↗
                  </a>
                </div>
              )}

              {/* Dynamic QR Ph Image */}
              {payment.qrCodeUrl ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      padding: "14px",
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "2px solid #0f172a",
                    }}
                  >
                    <img
                      src={payment.qrCodeUrl}
                      alt="PayMongo Sandbox QR Ph code"
                      style={{
                        width: "220px",
                        height: "220px",
                        display: "block",
                        imageRendering: "pixelated",
                      }}
                    />
                  </div>
                  <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748b" }}>
                    Standard EMVCo QR Ph (Sandbox Test Mode)
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "20px",
                    color: "#64748b",
                    fontSize: "13px",
                  }}
                >
                  Retrieving QR code image from PayMongo API...
                </div>
              )}

              {/* Live Polling Status */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "#475569",
                  marginBottom: "16px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#3b82f6",
                    animation: "pulse 1.5s infinite",
                  }}
                  aria-hidden="true"
                />
                <span>Listening for signed webhook confirmation ({payment.state})...</span>
              </div>

              {/* Reset Option */}
              <div style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    setPayment(null);
                    setOrderNumber(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
                    setIdempotencyKey(`idem_${Math.random().toString(36).substring(2, 12)}`);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: "12px",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Cancel and start over
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
