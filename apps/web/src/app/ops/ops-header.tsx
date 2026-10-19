"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./ops.module.css";
import { GlobalSearchModal } from "../../components/global-search-modal";

interface OpsHeaderProps {
  onToggleMobileSidebar?: () => void;
}

export function OpsHeader({ onToggleMobileSidebar }: OpsHeaderProps) {
  const pathname = usePathname();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [circuitStatus, setCircuitStatus] = useState<
    "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN"
  >("UNKNOWN");

  // Global keyboard shortcut '/' or 'Cmd+K' / 'Ctrl+K'
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "/" &&
          (e.target as HTMLElement)?.tagName !== "INPUT" &&
          (e.target as HTMLElement)?.tagName !== "TEXTAREA") ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch live system health
  useEffect(() => {
    let mounted = true;
    async function checkHealth() {
      try {
        const res = await fetch("/api/ops/health");
        if (!res.ok) {
          if (mounted) setCircuitStatus("UNAVAILABLE");
          return;
        }

        const json = await res.json().catch(() => ({}));
        if (!mounted) return;

        const healthData = json.data || json;
        const paymongoComp = healthData.components?.paymongo;
        const paymongoStatus = paymongoComp?.status;
        const circuit = paymongoComp?.circuit || paymongoComp?.circuitState;

        if (paymongoStatus === "HEALTHY" || circuit === "CLOSED") {
          setCircuitStatus("HEALTHY");
        } else if (paymongoStatus === "DEGRADED" || circuit === "HALF_OPEN") {
          setCircuitStatus("DEGRADED");
        } else if (paymongoStatus === "DOWN" || circuit === "OPEN") {
          setCircuitStatus("UNAVAILABLE");
        } else {
          setCircuitStatus("UNKNOWN");
        }
      } catch {
        if (mounted) setCircuitStatus("UNAVAILABLE");
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Derive simple breadcrumb
  const getBreadcrumb = () => {
    if (pathname === "/ops") return "Overview";
    if (pathname?.startsWith("/ops/transactions")) return "Payments";
    if (pathname?.startsWith("/ops/refunds")) return "Refunds";
    if (pathname?.startsWith("/ops/ledger")) return "Double-Entry Ledger";
    if (pathname?.startsWith("/ops/reconciliation")) return "Reconciliation";
    if (pathname?.startsWith("/ops/developer")) return "Webhooks & API";
    if (pathname?.startsWith("/ops/jobs")) return "Jobs & DLQ";
    if (pathname?.startsWith("/ops/cards")) return "Cards & 3DS";
    if (pathname?.startsWith("/ops/reliability-lab")) return "Reliability Lab";
    if (pathname?.startsWith("/ops/iso8583")) return "ISO 8583 Lab";
    return "Operations";
  };

  return (
    <header className={styles.header}>
      {/* Mobile Hamburger Button */}
      <button
        type="button"
        className={styles.mobileMenuToggle}
        onClick={onToggleMobileSidebar}
        aria-label="Toggle navigation menu"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 4.5h12M3 9h12M3 13.5h12" />
        </svg>
      </button>

      {/* Breadcrumb Section */}
      <nav className={styles.headerBreadcrumb} aria-label="Breadcrumb">
        <span className={styles.breadcrumbRoot}>PayRail PH</span>
        <span className={styles.breadcrumbSeparator} aria-hidden="true">
          /
        </span>
        <span className={styles.breadcrumbCurrent}>{getBreadcrumb()}</span>
      </nav>

      {/* Global Command Search Bar */}
      <search className={styles.commandBarForm}>
        <button
          type="button"
          className={styles.commandBarInputWrapper}
          onClick={() => setIsSearchModalOpen(true)}
          aria-label="Open operations search"
          style={{
            width: "100%",
            background: "none",
            border: "none",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <svg
            className={styles.searchIcon}
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5L12.5 12.5" />
          </svg>
          <span className={styles.commandBarInput} style={{ display: "block" }}>
            Search payments (PRL-...), refunds, ledger, webhooks... (Press / to search)
          </span>
          <kbd className={styles.keyboardShortcutKbd}>/</kbd>
        </button>
      </search>

      {/* Right Header Badges and Public Switch */}
      <div className={styles.headerActions}>
        {/* Provider Circuit Health Indicator */}
        <div
          className={`${styles.circuitPill} ${
            circuitStatus === "HEALTHY"
              ? styles.circuitPillHealthy
              : circuitStatus === "DEGRADED"
                ? styles.circuitPillDegraded
                : circuitStatus === "UNAVAILABLE"
                  ? styles.circuitPillUnavailable
                  : styles.circuitPillUnknown
          }`}
          title="Live circuit breaker and provider health status"
        >
          <span className={styles.circuitDot} aria-hidden="true" />
          <span className={styles.circuitLabel}>
            {circuitStatus === "HEALTHY"
              ? "PayMongo: HEALTHY"
              : circuitStatus === "DEGRADED"
                ? "PayMongo: DEGRADED"
                : circuitStatus === "UNAVAILABLE"
                  ? "PayMongo: UNAVAILABLE"
                  : "Telemetry: UNKNOWN"}
          </span>
        </div>

        {/* Single Global Environment Indicator */}
        <span
          className={styles.badgeSandbox}
          role="status"
          title="Sandbox environment · No real funds processed"
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#d97706",
              display: "inline-block",
              marginRight: "6px",
            }}
            aria-hidden="true"
          />
          TEST · No real funds
        </span>

        {/* Return to Public Site */}
        <Link href="/" className={styles.headerReturnLink}>
          <span aria-hidden="true">←</span> Public Demo
        </Link>
      </div>

      <GlobalSearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
    </header>
  );
}
