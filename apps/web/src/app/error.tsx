"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root Application Error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "540px",
          width: "100%",
          padding: "36px 32px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "16px" }}>⚠️</div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
          Something went wrong
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#475569",
            lineHeight: 1.5,
            marginBottom: "24px",
          }}
        >
          PayRail encountered an unexpected error. Your payment records and ledger state remain
          secure.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#0f52ba",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
