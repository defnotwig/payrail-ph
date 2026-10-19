"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog, EnvironmentBadge, StatusBadge } from "./ui";
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
  providerPaymentIntentId?: string | undefined;
  qrCodeUrl?: string | undefined;
  testUrl?: string | undefined;
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
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
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
          setIsDialogOpen(true);
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  // Persist payment state updates to session
  useEffect(() => {
    try {
      if (payment) {
        sessionStorage.setItem("payrail_demo_payment", JSON.stringify(payment));
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
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

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
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Payment initialization failed with status ${res.status}`,
        );
      }

      const created: PaymentStateData = await res.json();
      setPayment(created);
      setIsDialogOpen(true);
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

  // Poll for webhook confirmation
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

  const handleReset = () => {
    try {
      sessionStorage.removeItem("payrail_demo_payment");
    } catch {}
    setPayment(null);
    setIsDialogOpen(false);
    setOrderNumber(`PRL-${Math.floor(100000 + Math.random() * 900000)}`);
    setIdempotencyKey(`idem_${Math.random().toString(36).substring(2, 14)}`);
    setShowPhoneSimulator(false);
  };

  return (
    <div>
      {/* 1. Landing Card (Stripe-Simple Checkout Entry) */}
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "32px",
          boxShadow: "0 1px 3px 0 rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Pay with QR Ph
          </span>
          <EnvironmentBadge />
        </div>

        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "#0f172a",
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "-0.02em",
              marginBottom: "6px",
            }}
          >
            ₱1.00
          </div>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
            Generate a PayMongo QR Ph test payment. No live PayRail funds are processed.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "8px",
              padding: "12px 14px",
              marginBottom: "20px",
              fontSize: "13px",
              color: "#be123c",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        {payment && !isDialogOpen && (
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Payment in progress</div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0f172a",
                  fontFamily: "monospace",
                }}
              >
                {payment.orderNumber}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              style={{
                background: "#0f52ba",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reopen Dialog →
            </button>
          </div>
        )}

        <form onSubmit={initiatePayment}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              background: isSubmitting ? "#94a3b8" : "#0f52ba",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "14px 20px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "background 150ms ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isSubmitting ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: "14px",
                    height: "14px",
                    border: "2px solid #ffffff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Generating secure QR…
              </>
            ) : (
              "Generate QR Ph"
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
            color: "#94a3b8",
          }}
        >
          <span>Provider: PayMongo Test Mode</span>
          <span>Method: Dynamic QR Ph</span>
        </div>
      </div>

      {/* 2. Accessible Payment Dialog (Modal on Desktop / Sheet on Mobile) */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Pay with QR Ph"
        description="Scan with the sandbox simulator to complete this test transaction."
        maxWidth={520}
      >
        {payment && (
          <div>
            {payment.state === "SUCCEEDED" ? (
              /* Success State (Peak-End Rule: Calm, Authoritative) */
              <div style={{ textAlign: "center", padding: "12px 0 8px 0" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px auto",
                    color: "#047857",
                    fontSize: "22px",
                    fontWeight: "bold",
                  }}
                  aria-hidden="true"
                >
                  ✓
                </div>

                <h3
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Payment successful
                </h3>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "#0f172a",
                    fontFamily: "var(--font-mono, monospace)",
                    marginBottom: "16px",
                  }}
                >
                  ₱1.00
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "16px",
                    textAlign: "left",
                    marginBottom: "24px",
                    fontSize: "13px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>Order Reference</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace", color: "#0f172a" }}>
                      {payment.orderNumber}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>Provider</span>
                    <span style={{ fontWeight: 500, color: "#0f172a" }}>PayMongo Test Mode</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>Paid At</span>
                    <span style={{ fontFamily: "monospace", color: "#0f172a" }}>
                      {new Date(payment.updatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Status</span>
                    <StatusBadge status="SUCCEEDED" />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <Link
                    href={`/ops/transactions/${payment.id}`}
                    style={{
                      display: "block",
                      background: "#0f172a",
                      color: "#ffffff",
                      textDecoration: "none",
                      padding: "12px 16px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    Inspect in Operator Dashboard →
                  </Link>
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      background: "#ffffff",
                      color: "#0f172a",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "10px 16px",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Make another test payment
                  </button>
                </div>
              </div>
            ) : payment.state === "FAILED" ? (
              /* Failed State */
              <div style={{ textAlign: "center", padding: "12px 0 8px 0" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px auto",
                    color: "#dc2626",
                    fontSize: "22px",
                    fontWeight: "bold",
                  }}
                  aria-hidden="true"
                >
                  ✕
                </div>
                <h3
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Transfer was not completed
                </h3>
                <p
                  style={{
                    margin: "0 0 20px 0",
                    fontSize: "14px",
                    color: "#64748b",
                    lineHeight: 1.5,
                  }}
                >
                  Your banking app or e-wallet declined the transaction. No money was received by
                  PayRail. Please verify your account balance or try another payment method.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      background: "#0f52ba",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "12px 16px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Try again
                  </button>
                  <Link
                    href={`/ops/transactions/${payment.id}`}
                    style={{
                      display: "block",
                      background: "#ffffff",
                      color: "#0f172a",
                      border: "1px solid #cbd5e1",
                      textDecoration: "none",
                      padding: "10px 16px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    Inspect in Operator Dashboard →
                  </Link>
                </div>
              </div>
            ) : payment.state === "EXPIRED" ? (
              /* Expired State */
              <div style={{ textAlign: "center", padding: "12px 0 8px 0" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px auto",
                    color: "#b45309",
                    fontSize: "22px",
                    fontWeight: "bold",
                  }}
                  aria-hidden="true"
                >
                  ⏱
                </div>
                <h3
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  QR code expired
                </h3>
                <p
                  style={{
                    margin: "0 0 20px 0",
                    fontSize: "14px",
                    color: "#64748b",
                    lineHeight: 1.5,
                  }}
                >
                  For your security, dynamic QR Ph codes are valid for 30 minutes. If you already
                  completed the transfer in your bank app, our automated system will reconcile it
                  shortly.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      background: "#0f52ba",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "12px 16px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Generate new QR code
                  </button>
                  <Link
                    href={`/ops/transactions/${payment.id}`}
                    style={{
                      display: "block",
                      background: "#ffffff",
                      color: "#0f172a",
                      border: "1px solid #cbd5e1",
                      textDecoration: "none",
                      padding: "10px 16px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    Inspect in Operator Dashboard →
                  </Link>
                </div>
              </div>
            ) : payment.state === "UNKNOWN_REQUIRES_RECONCILIATION" ? (
              /* Reconciling State */
              <div style={{ textAlign: "center", padding: "12px 0 8px 0" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px auto",
                    color: "#1d4ed8",
                    fontSize: "22px",
                    fontWeight: "bold",
                  }}
                  aria-hidden="true"
                >
                  ℹ
                </div>
                <h3
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Verifying payment with bank
                </h3>
                <p
                  style={{
                    margin: "0 0 20px 0",
                    fontSize: "14px",
                    color: "#64748b",
                    lineHeight: 1.5,
                  }}
                >
                  We detected a brief connection interruption while confirming your payment. Your
                  funds are protected. We are verifying the bank confirmation registry now.
                  Reference:{" "}
                  <strong style={{ fontFamily: "monospace" }}>{payment.orderNumber}</strong>.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <Link
                    href={`/ops/transactions/${payment.id}`}
                    style={{
                      display: "block",
                      background: "#0f172a",
                      color: "#ffffff",
                      textDecoration: "none",
                      padding: "12px 16px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    Inspect in Operator Dashboard →
                  </Link>
                </div>
              </div>
            ) : (
              /* Awaiting Payment State */
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>Amount Due</span>
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono, monospace)",
                        color: "#0f172a",
                      }}
                    >
                      ₱1.00
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>Expires In</span>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        fontFamily: "monospace",
                        color: secondsRemaining < 300 ? "#be123c" : "#b45309",
                      }}
                    >
                      {formatTimer(secondsRemaining)}
                    </div>
                  </div>
                </div>

                {/* Primary Unaltered Provider QR Ph Rendering */}
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  {payment.qrCodeUrl ? (
                    <img
                      src={payment.qrCodeUrl}
                      alt={`PayMongo QR Ph payment QR code for order ${payment.orderNumber}`}
                      style={{
                        width: "220px",
                        height: "220px",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "220px",
                        height: "220px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f8fafc",
                        color: "#64748b",
                        fontSize: "13px",
                      }}
                    >
                      Loading QR...
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: "12px",
                      fontSize: "12px",
                      color: "#64748b",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#b45309",
                        animation: "pulse 1.5s infinite",
                      }}
                    />
                    Waiting for payment confirmation…
                  </div>
                </div>

                {/* Prominent Sandbox Safety Warning */}
                <div
                  role="note"
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "16px",
                    fontSize: "12px",
                    color: "#92400e",
                    lineHeight: 1.4,
                  }}
                >
                  <strong>TEST MODE:</strong> Do not scan or pay this test QR using a real banking
                  or e-wallet application (GCash, Maya, ShopeePay, bank apps). Use the official
                  PayMongo sandbox payment simulator button below.
                </div>

                {/* Primary Simulator Action Button */}
                {payment.testUrl && (
                  <div style={{ marginBottom: "16px" }}>
                    <a
                      href={payment.testUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        textAlign: "center",
                        background: "#0f52ba",
                        color: "#ffffff",
                        textDecoration: "none",
                        padding: "12px 16px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: 600,
                        transition: "background 120ms ease",
                      }}
                    >
                      Simulate ₱1 payment ↗
                    </a>
                  </div>
                )}

                {/* Collapsible Phone Scanner Experience */}
                {payment.testUrl && (
                  <div
                    style={{
                      borderTop: "1px solid #f1f5f9",
                      paddingTop: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowPhoneSimulator(!showPhoneSimulator)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0f52ba",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      aria-expanded={showPhoneSimulator}
                    >
                      {showPhoneSimulator
                        ? "▾ Hide phone simulator QR"
                        : "▸ Test on another phone →"}
                    </button>

                    {showPhoneSimulator && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "14px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            color: "#475569",
                            marginBottom: "8px",
                          }}
                        >
                          TEST SIMULATOR QR
                        </div>
                        <div
                          style={{
                            display: "inline-block",
                            background: "#ffffff",
                            padding: "8px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          <QrCodeSvg value={payment.testUrl} size={150} />
                        </div>
                        <p
                          style={{
                            margin: "8px 0 0 0",
                            fontSize: "12px",
                            color: "#64748b",
                            lineHeight: 1.4,
                          }}
                        >
                          Scan with your phone camera to open the PayMongo sandbox simulator in your
                          mobile browser. (This is a simulator shortcut, not a QR Ph payment QR).
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Reference Details */}
                <div
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: "12px",
                  }}
                >
                  <span>Order: {payment.orderNumber}</span>
                  <Link
                    href={`/ops/transactions/${payment.id}`}
                    style={{ color: "#0f52ba", textDecoration: "none" }}
                  >
                    Inspect transaction ↗
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
