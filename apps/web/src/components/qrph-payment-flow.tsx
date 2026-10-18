"use client";

import { useEffect, useRef, useState } from "react";

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
  const [amount, setAmount] = useState<number>(100);
  const [orderNumber, setOrderNumber] = useState<string>(
    () => `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
  );
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => `idem_${Math.random().toString(36).substring(2, 12)}`,
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [payment, setPayment] = useState<PaymentStateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef<number>(0);

  const initiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

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
      pollCountRef.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment");
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

  return (
    <div className="operator-panel">
      <div className="panel-header">
        <div className="panel-badge-group">
          <span className="panel-badge panel-badge-sandbox">SANDBOX PROOF</span>
          <span className="panel-badge panel-badge-provider">DYNAMIC QR PH</span>
        </div>
        <h3 className="panel-title">Interactive Payment Lifecycle</h3>
        <p className="panel-description">
          Create an authoritative test order, receive a genuine PayMongo QR Ph resource, and observe
          verified state transitions via signed webhooks.
        </p>
      </div>

      {!payment ? (
        <form onSubmit={initiatePayment} className="operator-form">
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="order-num">Order Reference</label>
              <input
                id="order-num"
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="amount">Amount (PHP)</label>
              <input
                id="amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
            </div>
            <div className="form-field full-width">
              <label htmlFor="idempotency">Idempotency Key</label>
              <input
                id="idempotency"
                type="text"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" disabled={isSubmitting} className="action-button">
            {isSubmitting ? "Persisting Operation..." : "Initiate QR Ph Payment →"}
          </button>
        </form>
      ) : (
        <div className="lifecycle-display">
          <div className="status-banner">
            <div className="status-indicator">
              {payment.state === "SUCCEEDED" && (
                <span className="state-pill state-success">✓ PAYMENT SUCCESSFUL</span>
              )}
              {payment.state === "AWAITING_PAYMENT" && (
                <span className="state-pill state-waiting">⏳ WAITING FOR PAYMENT</span>
              )}
              {payment.state === "PROCESSING" && (
                <span className="state-pill state-processing">⚙️ CONFIRMING PAYMENT</span>
              )}
              {payment.state === "FAILED" && (
                <span className="state-pill state-failed">✗ PAYMENT FAILED</span>
              )}
            </div>
            <p className="status-note">
              {payment.state === "AWAITING_PAYMENT" &&
                "PayRail is polling for verified provider webhook signatures."}
              {payment.state === "PROCESSING" &&
                "Confirmation is currently processing. Do not resubmit."}
              {payment.state === "SUCCEEDED" &&
                "Webhook signature verified and recorded in PostgreSQL system of record."}
            </p>
          </div>

          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Payment Intent</span>
              <code className="detail-value">{payment.id}</code>
            </div>
            <div className="detail-item">
              <span className="detail-label">Order Reference</span>
              <code className="detail-value">{payment.orderNumber}</code>
            </div>
            <div className="detail-item">
              <span className="detail-label">Authoritative Amount</span>
              <span className="detail-value font-bold">
                ₱{(Number(payment.amountMinor) / 100).toFixed(2)} PHP
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Provider Reference</span>
              <code className="detail-value">
                {payment.providerPaymentIntentId || "Attaching..."}
              </code>
            </div>
          </div>

          {payment.state !== "SUCCEEDED" && payment.testUrl && (
            <div className="test-action-callout">
              <div className="callout-header">
                <span className="callout-title">PayMongo Sandbox Simulator Action</span>
                <p className="callout-description">
                  Do NOT scan test QR codes with real banking apps. Use PayMongo's official test
                  simulator to simulate payment capture:
                </p>
              </div>
              <a
                href={payment.testUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="simulator-button"
              >
                Open Official PayMongo Simulator ↗
              </a>
            </div>
          )}

          {payment.qrCodeUrl && (
            <div className="qr-container">
              <img src={payment.qrCodeUrl} alt="PayMongo Sandbox QR Ph Code" className="qr-image" />
              <span className="qr-subtext">PayMongo Dynamic Sandbox QR Ph (Test Mode)</span>
            </div>
          )}

          <div className="panel-actions">
            <button
              type="button"
              onClick={() => {
                setPayment(null);
                setOrderNumber(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
                setIdempotencyKey(`idem_${Math.random().toString(36).substring(2, 12)}`);
              }}
              className="reset-button"
            >
              ← Create Another Test Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
