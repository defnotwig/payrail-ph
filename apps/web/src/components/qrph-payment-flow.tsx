"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Amount, EnvironmentBadge, StatusBadge } from "./ui";
import { QrCodeSvg } from "./qr-code-svg";

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
  const amount = 1; // ₱1.00 standard PayMongo test amount
  const [orderNumber, setOrderNumber] = useState<string>(
    () => `PRL-${Math.floor(100000 + Math.random() * 900000)}`,
  );
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => `idem_${Math.random().toString(36).substring(2, 14)}`,
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [payment, setPayment] = useState<PaymentStateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(1800); // 30 min dynamic QR Ph
  const [showPhoneSimulator, setShowPhoneSimulator] = useState<boolean>(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL
    ? process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "")
    : "";
  const paymentsEndpoint = apiBase ? `${apiBase}/payments` : "/api/payments";
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef<number>(0);

  // Restore payment state from session on refresh
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("payrail_demo_payment");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.id) {
          setPayment(parsed);
        }
      }
    } catch {
      // sessionStorage unavailable in non-browser or privacy mode
    }
  }, []);

  // Persist payment state updates to session
  useEffect(() => {
    try {
      if (payment) {
        sessionStorage.setItem("payrail_demo_payment", JSON.stringify(payment));
        // Also add to recorded demo payments list for operator transactions view
        const listStr = sessionStorage.getItem("payrail_recorded_transactions");
        const list: PaymentStateData[] = listStr ? JSON.parse(listStr) : [];
        const existingIdx = list.findIndex((item) => item.id === payment.id);
        if (existingIdx >= 0) {
          list[existingIdx] = payment;
        } else {
          list.unshift(payment);
        }
        sessionStorage.setItem("payrail_recorded_transactions", JSON.stringify(list.slice(0, 50)));
      } else {
        sessionStorage.removeItem("payrail_demo_payment");
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [payment]);

  // 30-minute authoritative countdown timer
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

    // Minor units (100 minor units = ₱1.00)
    const validAmount = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;
    const amountMinor = (BigInt(validAmount) * BigInt(100)).toString();

    try {
      const res = await fetch(paymentsEndpoint, {
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
        const data = await res.json().catch(() => ({}));
        const message = data.message || data.error || `Payment creation failed (${res.status})`;
        throw new Error(message);
      }

      const data: PaymentStateData = await res.json();
      setPayment(data);
      setSecondsRemaining(1800);
      pollCountRef.current = 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Failed to communicate") ||
        msg.includes("Load failed")
      ) {
        setError(
          "We couldn't reach the sandbox payment service. No new payment was submitted. Try again in a moment.",
        );
      } else {
        setError(msg || "Failed to create payment intent");
      }
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
    const paymentPollUrl = apiBase
      ? `${apiBase}/payments/${payment.id}`
      : `/api/payments/${payment.id}`;

    pollingRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      try {
        const res = await fetch(paymentPollUrl);
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

  const handleReset = () => {
    try {
      sessionStorage.removeItem("payrail_demo_payment");
    } catch {}
    setPayment(null);
    setOrderNumber(`PRL-${Math.floor(100000 + Math.random() * 900000)}`);
    setIdempotencyKey(`idem_${Math.random().toString(36).substring(2, 14)}`);
    setShowPhoneSimulator(false);
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "32px",
        boxShadow:
          "0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03)",
      }}
    >
      {/* Sandbox Header Strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: "18px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "#0f52ba",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "14px",
            }}
          >
            ₱
          </div>
          <div>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Pay with QR Ph
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>PayRail Sandbox Checkout</span>
          </div>
        </div>
        <EnvironmentBadge mode="test" label="TEST MODE" />
      </div>

      {!payment ? (
        /* ================= 1. SIMPLE STRIPE-LIKE CUSTOMER CHECKOUT ================= */
        <form onSubmit={initiatePayment}>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "block",
                marginBottom: "8px",
              }}
            >
              Payment Amount
            </span>
            <div
              style={{
                fontSize: "44px",
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: "8px",
              }}
            >
              ₱1.00
            </div>
            <div
              style={{
                display: "inline-block",
                background: "#e0f2fe",
                color: "#0369a1",
                fontSize: "12px",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: "12px",
              }}
            >
              Sandbox test payment
            </div>
          </div>

          <p
            style={{
              fontSize: "13px",
              color: "#64748b",
              textAlign: "center",
              lineHeight: 1.5,
              margin: "0 0 24px 0",
            }}
          >
            Generate a PayMongo QR Ph test payment.
            <br />
            No live PayRail funds are processed.
          </p>

          {error && (
            <div
              role="alert"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#991b1b",
                fontSize: "13px",
                marginBottom: "20px",
                textAlign: "left",
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
              padding: "14px 20px",
              background: isSubmitting ? "#94a3b8" : "#0f52ba",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 2px 4px rgba(15, 82, 186, 0.2)",
            }}
          >
            {isSubmitting ? "Generating QR Ph..." : "Generate QR Ph"}
          </button>
        </form>
      ) : (
        <div aria-live="polite">
          {payment.state === "SUCCEEDED" ? (
            /* ================= 2. CALM DIGNIFIED SUCCESS CONFIRMATION ================= */
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "12px",
                  padding: "20px",
                  marginBottom: "24px",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "#16a34a",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "22px",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#166534",
                      margin: "0 0 2px 0",
                    }}
                  >
                    Payment successful
                  </h3>
                  <p style={{ fontSize: "13px", color: "#15803d", margin: 0 }}>
                    Provider evidence verified via HMAC-SHA256 signature and posted to double-entry
                    ledger.
                  </p>
                </div>
              </div>

              {/* Receipt Summary Card */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "20px",
                  marginBottom: "24px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    background: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fcd34d",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "4px",
                    letterSpacing: "0.04em",
                    marginBottom: "16px",
                  }}
                >
                  SANDBOX RECEIPT · NO REAL MONEY PROCESSED
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "14px",
                    marginBottom: "14px",
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
                    Amount Paid
                  </span>
                  <Amount amountMinor={payment.amountMinor} currency="PHP" />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
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
                    <span style={{ color: "#64748b", display: "block" }}>Payment Intent ID</span>
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
                    <strong style={{ color: "#0f172a" }}>QR Ph Dynamic</strong>
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
                <Link
                  href={`/ops/transactions/${payment.id}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "12px 18px",
                    background: "#0f52ba",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#ffffff",
                    textDecoration: "none",
                  }}
                >
                  View transaction ↗
                </Link>
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  style={{
                    padding: "12px 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  📄 Print receipt
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    width: "100%",
                    padding: "11px 18px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#475569",
                    cursor: "pointer",
                    marginTop: "4px",
                  }}
                >
                  Make another test payment
                </button>
              </div>
            </div>
          ) : (
            /* ================= 3. QR PH WAITING & SIMULATE INTERFACE ================= */
            <div>
              {/* Sandbox Safety Notice */}
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1 }} aria-hidden="true">
                  ⚠️
                </span>
                <div style={{ fontSize: "12px", color: "#92400e", lineHeight: 1.5 }}>
                  <strong style={{ display: "block", marginBottom: "2px" }}>TEST MODE</strong>
                  Do not pay this test QR using a real banking or e-wallet application (GCash, Maya,
                  etc.). Use the official sandbox payment simulator instead.
                </div>
              </div>

              {/* Order Info & Timer Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
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
                    Order: {payment.orderNumber}
                  </span>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>₱1.00</div>
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
                    Expires In
                  </span>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: secondsRemaining < 180 ? "#dc2626" : "#0f172a",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ⏱ {formatTimer(secondsRemaining)}
                  </div>
                </div>
              </div>

              {/* Official Provider-Returned QR Ph Image */}
              <div
                style={{
                  textAlign: "center",
                  padding: "24px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#0f172a",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    QR Ph
                  </span>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    Provider: PayMongo Test Mode
                  </div>
                </div>

                {payment.qrCodeUrl ? (
                  <div
                    style={{
                      display: "inline-block",
                      padding: "16px",
                      background: "#ffffff",
                      borderRadius: "10px",
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
                ) : (
                  <div
                    style={{
                      display: "inline-block",
                      padding: "40px 20px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      color: "#64748b",
                      fontSize: "13px",
                      width: "220px",
                    }}
                  >
                    Retrieving QR code from PayMongo...
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginTop: "16px",
                    fontSize: "13px",
                    color: "#475569",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: payment.state === "PROCESSING" ? "#f59e0b" : "#3b82f6",
                      animation: "pulse 1.5s infinite",
                    }}
                    aria-hidden="true"
                  />
                  <span>
                    {payment.state === "PROCESSING"
                      ? "Confirming payment with PayMongo webhook..."
                      : "Waiting for payment..."}
                  </span>
                </div>
              </div>

              {/* Primary Action Button: Simulate Payment */}
              {payment.testUrl && (
                <div style={{ marginBottom: "18px" }}>
                  <a
                    href={payment.testUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      textAlign: "center",
                      background: "#0f52ba",
                      color: "#ffffff",
                      padding: "14px 20px",
                      borderRadius: "10px",
                      fontSize: "15px",
                      fontWeight: 600,
                      textDecoration: "none",
                      boxShadow: "0 2px 4px rgba(15, 82, 186, 0.25)",
                    }}
                  >
                    Simulate ₱1 payment ↗
                  </a>
                </div>
              )}

              {/* Optional Phone-Scan Sandbox Experience */}
              {payment.testUrl && (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    marginBottom: "20px",
                    background: "#f8fafc",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowPhoneSimulator((prev) => !prev)}
                    style={{
                      background: "none",
                      border: "none",
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      padding: 0,
                      color: "#0f172a",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    <span>📱 Test on phone camera (Sandbox Simulator Shortcut)</span>
                    <span style={{ fontSize: "16px", color: "#64748b" }}>
                      {showPhoneSimulator ? "−" : "+"}
                    </span>
                  </button>

                  {showPhoneSimulator && (
                    <div
                      style={{
                        marginTop: "14px",
                        paddingTop: "14px",
                        borderTop: "1px solid #e2e8f0",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: "4px",
                        }}
                      >
                        TEST SIMULATOR QR
                      </div>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#475569",
                          margin: "0 0 12px 0",
                          lineHeight: 1.4,
                        }}
                      >
                        Scan with your phone camera to open the PayMongo sandbox simulator.
                        <br />
                        <span style={{ color: "#92400e" }}>
                          (This is a simulator shortcut, not a QR Ph payment QR.)
                        </span>
                      </p>
                      <div
                        style={{
                          display: "inline-block",
                          padding: "12px",
                          background: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        <QrCodeSvg
                          value={payment.testUrl}
                          size={180}
                          ariaLabel="PayMongo sandbox simulator shortcut QR code"
                          title="PayMongo sandbox simulator shortcut"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reset / Cancel Action */}
              <div style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={handleReset}
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
