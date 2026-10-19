"use client";

import { useEffect } from "react";
import styles from "./ops.module.css";

export default function OpsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error to client console for diagnostics
    console.error("Operations Console Error:", error);
  }, [error]);

  return (
    <div
      style={{
        padding: "48px 24px",
        maxWidth: "640px",
        margin: "40px auto",
        textAlign: "center",
        background: "#ffffff",
        border: "1px solid var(--border-subtle, #e2e8f0)",
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div style={{ fontSize: "32px", marginBottom: "16px" }}>⚠️</div>
      <h2
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--text-primary, #0f172a)",
          marginBottom: "8px",
        }}
      >
        We couldn&apos;t load operations data
      </h2>
      <p
        style={{
          fontSize: "14px",
          color: "var(--text-secondary, #475569)",
          lineHeight: 1.5,
          marginBottom: "24px",
        }}
      >
        Your payment pipelines and backend ledger remain safe and protected. This may be due to a
        temporary telemetry interruption or network disconnect.
      </p>

      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => reset()}
          className={styles.buttonPrimary}
          style={{ minHeight: "44px", padding: "10px 20px" }}
        >
          Retry loading
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={styles.buttonSecondary}
          style={{ minHeight: "44px", padding: "10px 20px" }}
        >
          Reload page
        </button>
      </div>

      {process.env.NODE_ENV !== "production" && error.message && (
        <details
          style={{
            marginTop: "24px",
            textAlign: "left",
            background: "#f8fafc",
            padding: "12px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
          }}
        >
          <summary style={{ cursor: "pointer", color: "#64748b", fontWeight: 600 }}>
            Diagnostic details (development only)
          </summary>
          <pre
            style={{
              marginTop: "8px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              color: "#991b1b",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {error.message}
          </pre>
        </details>
      )}
    </div>
  );
}
