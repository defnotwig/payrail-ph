"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./ops.module.css";

interface OpsHeaderProps {
  onToggleMobileSidebar?: () => void;
}

export function OpsHeader({ onToggleMobileSidebar }: OpsHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [circuitStatus, setCircuitStatus] = useState<"HEALTHY" | "DEGRADED" | "UNKNOWN">("HEALTHY");

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
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
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
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.status === "ok" || data.providerCircuit === "CLOSED") {
            setCircuitStatus("HEALTHY");
          } else {
            setCircuitStatus("DEGRADED");
          }
        }
      } catch {
        if (mounted) setCircuitStatus("UNKNOWN");
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Simple quick navigation / identifier lookup
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    if (q.startsWith("pi_") || q.startsWith("pay_") || q.startsWith("PRL-")) {
      router.push(`/ops/transactions?search=${encodeURIComponent(q)}`);
    } else if (q.toLowerCase().includes("ledger")) {
      router.push("/ops/ledger");
    } else if (q.toLowerCase().includes("refund")) {
      router.push("/ops/refunds");
    } else if (q.toLowerCase().includes("reconcil")) {
      router.push("/ops/reconciliation");
    } else if (q.toLowerCase().includes("job") || q.toLowerCase().includes("dlq")) {
      router.push("/ops/jobs");
    } else if (q.toLowerCase().includes("webhook") || q.toLowerCase().includes("api")) {
      router.push("/ops/developer");
    } else {
      router.push(`/ops/transactions?search=${encodeURIComponent(q)}`);
    }
    setSearchQuery("");
  };

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
        <form onSubmit={handleSearchSubmit}>
          <div className={styles.commandBarInputWrapper}>
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
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payments, references, accounts... (Press / to focus)"
              className={styles.commandBarInput}
              aria-label="Search operational data"
            />
            <kbd className={styles.keyboardShortcutKbd}>/</kbd>
          </div>
        </form>
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
                : styles.circuitPillUnknown
          }`}
          title="Live circuit breaker and provider health status"
        >
          <span className={styles.circuitDot} aria-hidden="true" />
          <span className={styles.circuitLabel}>
            PayMongo:{" "}
            {circuitStatus === "HEALTHY"
              ? "HEALTHY"
              : circuitStatus === "DEGRADED"
                ? "CIRCUIT TRIPPED"
                : "CONNECTING"}
          </span>
        </div>

        {/* Sandbox Badge */}
        <span className={styles.badgeSandbox} role="status">
          TEST MODE
        </span>

        {/* Return to Public Site */}
        <Link href="/" className={styles.headerReturnLink}>
          <span aria-hidden="true">←</span> Public Demo
        </Link>
      </div>
    </header>
  );
}
