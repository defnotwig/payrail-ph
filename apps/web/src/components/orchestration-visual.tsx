"use client";

import { useEffect, useState } from "react";
import styles from "./orchestration-visual.module.css";

const PHASES = [
  { label: "1. Client Checkout Request", status: "Initiating QR Ph payment (PHP 1.00)" },
  { label: "2. PayMongo Gateway Routing", status: "Source generated · Simulator authorized" },
  { label: "3. Signed Webhook Arrival", status: "HMAC-SHA256 verified · Event persisted" },
  { label: "4. State Mutation & Ledger", status: "SUCCEEDED · Debits == Credits verified" },
  { label: "5. Reconciliation Audit", status: "3-Way match: Internal == Provider == Ledger" },
];

export function OrchestrationVisual() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % PHASES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  const activePhase =
    (prefersReducedMotion ? PHASES[3] : PHASES[phaseIndex]) ??
    (PHASES[0] as (typeof PHASES)[number]);

  return (
    <section className={styles.container} aria-label="Live payment orchestration pipeline">
      <div className={styles.visualHeader}>
        <span className={styles.visualTitle}>Verified Payment Pipeline</span>
        <div className={styles.liveBadge}>
          <span className={styles.liveDot} aria-hidden="true" />
          <span>Real-Time State Machine</span>
        </div>
      </div>

      <svg
        className={styles.diagramSvg}
        viewBox="0 0 540 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Interactive flow diagram connecting Checkout to PayRail, PayMongo, Webhooks, Ledger, and Reconciliation"
      >
        {/* Connection Paths */}
        {/* Checkout to PayRail */}
        <line
          x1="120"
          y1="55"
          x2="200"
          y2="55"
          className={`${styles.connectionLine} ${phaseIndex === 0 ? styles.activeLine : ""}`}
        />
        {/* PayRail to PayMongo */}
        <line
          x1="340"
          y1="55"
          x2="420"
          y2="55"
          className={`${styles.connectionLine} ${phaseIndex === 1 ? styles.activeLine : ""}`}
        />
        {/* PayMongo back to PayRail (Webhook) */}
        <path
          d="M480 85 V135 H270 V90"
          className={`${styles.connectionLine} ${phaseIndex === 2 ? styles.activeLine : ""}`}
        />
        {/* PayRail to Ledger */}
        <line
          x1="270"
          y1="85"
          x2="270"
          y2="170"
          className={`${styles.connectionLine} ${phaseIndex === 3 ? styles.activeLine : ""}`}
        />
        {/* PayRail to Reconciliation */}
        <path
          d="M220 85 V150 H120 V170"
          className={`${styles.connectionLine} ${phaseIndex === 4 ? styles.activeLine : ""}`}
        />

        {/* Node 1: Checkout */}
        <g transform="translate(10, 25)">
          <rect
            width="110"
            height="60"
            className={`${styles.nodeBox} ${phaseIndex === 0 ? styles.nodeBoxActive : ""}`}
          />
          <text x="55" y="27" className={styles.nodeText}>
            Checkout
          </text>
          <text x="55" y="44" className={styles.nodeSubtext}>
            Client / Payer
          </text>
        </g>

        {/* Node 2: PayRail PH (Center Core) */}
        <g transform="translate(200, 20)">
          <rect width="140" height="70" className={styles.nodeBoxCenter} />
          <text
            x="70"
            y="30"
            className={styles.nodeText}
            style={{ fill: "#ffffff", fontSize: "12px", fontWeight: 700 }}
          >
            PayRail PH
          </text>
          <text x="70" y="48" className={styles.nodeSubtext} style={{ fill: "#bae6fd" }}>
            State & Ledger Core
          </text>
        </g>

        {/* Node 3: PayMongo Sandbox */}
        <g transform="translate(420, 25)">
          <rect
            width="110"
            height="60"
            className={`${styles.nodeBox} ${phaseIndex === 1 ? styles.nodeBoxActive : ""}`}
          />
          <text x="55" y="27" className={styles.nodeText}>
            PayMongo
          </text>
          <text x="55" y="44" className={styles.nodeSubtext}>
            QR Ph Gateway
          </text>
        </g>

        {/* Node 4: Reconciliation */}
        <g transform="translate(65, 170)">
          <rect
            width="110"
            height="50"
            className={`${styles.nodeBox} ${phaseIndex === 4 ? styles.nodeBoxActive : ""}`}
          />
          <text x="55" y="23" className={styles.nodeText}>
            Reconciliation
          </text>
          <text x="55" y="38" className={styles.nodeSubtext}>
            3-Way Audit
          </text>
        </g>

        {/* Node 5: Balanced Ledger */}
        <g transform="translate(215, 170)">
          <rect
            width="110"
            height="50"
            className={`${styles.nodeBox} ${phaseIndex === 3 ? styles.nodeBoxActive : ""}`}
          />
          <text x="55" y="23" className={styles.nodeText}>
            Double Ledger
          </text>
          <text x="55" y="38" className={styles.nodeSubtext}>
            Debits == Credits
          </text>
        </g>

        {/* Node 6: Webhook Verification */}
        <g transform="translate(365, 170)">
          <rect
            width="110"
            height="50"
            className={`${styles.nodeBox} ${phaseIndex === 2 ? styles.nodeBoxActive : ""}`}
          />
          <text x="55" y="23" className={styles.nodeText}>
            Webhook HMAC
          </text>
          <text x="55" y="38" className={styles.nodeSubtext}>
            SHA256 Verified
          </text>
        </g>
      </svg>

      <div className={styles.statusIndicator}>
        <span className={styles.statusLabel}>{activePhase.label}:</span>
        <span
          className={`${styles.statusValue} ${phaseIndex >= 3 ? styles.statusValueSuccess : ""}`}
        >
          {activePhase.status}
        </span>
      </div>
    </section>
  );
}
