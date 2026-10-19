"use client";

import { useState } from "react";
import styles from "./flow-section.module.css";

const FLOW_STEPS = [
  {
    number: "01",
    title: "Create payment",
    detail:
      "Client submits checkout request with a merchant idempotency key. State begins at CREATED.",
    tech: "POST /payments/intents -> payrail_private.payment_intents (idempotency key lock)",
  },
  {
    number: "02",
    title: "Provider authorizes",
    detail:
      "PayMongo creates a sandbox QR Ph source code. Payer authorizes via the sandbox simulator.",
    tech: "POST /v1/payment_intents/.../attach -> next_action.test_url simulator",
  },
  {
    number: "03",
    title: "Signed webhook arrives",
    detail: "PayMongo dispatches a payment.paid event signed with HMAC-SHA256 signature headers.",
    tech: "POST /webhooks/paymongo with Paymongo-Signature: t=...,te=...",
  },
  {
    number: "04",
    title: "PayRail verifies & persists",
    detail:
      "Payload signature is cryptographically verified in constant time. State transitions to SUCCEEDED.",
    tech: "crypto.timingSafeEqual() signature match -> UPDATE payment_intents state='SUCCEEDED'",
  },
  {
    number: "05",
    title: "Ledger balances",
    detail:
      "Double-entry journal records are posted synchronously. Debits equal credits across accounts.",
    tech: "INSERT INTO payrail_private.ledger_lines (SUM(debit) == SUM(credit) enforced)",
  },
  {
    number: "06",
    title: "Operator investigates",
    detail:
      "Real-time state telemetry, durable job queue, and 3-way reconciliation audit are available.",
    tech: "SELECT * FROM reconciliation_runs, dead_letter_queue, journal_entries",
  },
];

export function FlowSection() {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <section className={`page-gutter ${styles.section}`} id="flow" aria-labelledby="flow-title">
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h2 id="flow-title" className={styles.title}>
            How one payment moves through PayRail
          </h2>
          <p className={styles.subtitle}>
            From initial checkout intent to settled ledger entries and exception reconciliation.
          </p>
        </div>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setShowTechnical((prev) => !prev)}
          aria-expanded={showTechnical}
        >
          <span>{showTechnical ? "Hide technical flow" : "View technical flow"}</span>
          <span aria-hidden="true">{showTechnical ? "↑" : "↓"}</span>
        </button>
      </div>

      <ol className={styles.stepsGrid}>
        {FLOW_STEPS.map((step) => (
          <li key={step.number} className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNumber}>{step.number}</span>
            </div>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepDetail}>{step.detail}</p>
            {showTechnical && (
              <div className={styles.techDetail}>
                <code>{step.tech}</code>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
