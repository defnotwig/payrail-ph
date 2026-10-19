"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./ops.module.css";

interface NavItemDef {
  label: string;
  href: string;
  exact?: boolean;
  badge?: string;
  badgeVariant?: "neutral" | "warning" | "info";
  icon: (props: { className?: string }) => React.JSX.Element;
}

interface NavGroupDef {
  title: string;
  items: NavItemDef[];
}

// Crisp 16x16 inline SVG icons matching institutional fintech styling
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 6.5L8 2l5.5 4.5v7a1 1 0 01-1 1h-9a1 1 0 01-1-1v-7z" />
      <path d="M6 14.5v-5h4v5" />
    </svg>
  );
}

function PaymentsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 7h12" />
      <path d="M5 10.5h2" />
    </svg>
  );
}

function RefundsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 6.5A5.5 5.5 0 114 11.5" />
      <path d="M2 3.5v3h3" />
    </svg>
  );
}

function LedgerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z" />
      <path d="M2 6h12" />
      <path d="M6 6v7.5" />
      <path d="M10 6v7.5" />
    </svg>
  );
}

function ReconciliationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 5H4a2 2 0 00-2 2v0a2 2 0 002 2h1" />
      <path d="M11 2l3 3-3 3" />
      <path d="M2 11h10a2 2 0 002-2v0a2 2 0 00-2-2h-1" />
      <path d="M5 14l-3-3 3-3" />
    </svg>
  );
}

function WebhookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4.5a2.5 2.5 0 10-4.5 1.7L4 8.7a2.5 2.5 0 101.4 1.4l2.5-2.5A2.5 2.5 0 0011 4.5z" />
      <circle cx="11" cy="4.5" r="1.5" />
      <circle cx="3.5" cy="11.5" r="1.5" />
    </svg>
  );
}

function JobsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 4.5h12M2 8h12M2 11.5h12" />
      <circle cx="4.5" cy="4.5" r="0.75" fill="currentColor" />
      <circle cx="4.5" cy="8" r="0.75" fill="currentColor" />
      <circle cx="4.5" cy="11.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function CardsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M2 6.5h12" />
      <circle cx="5" cy="10" r="1" />
      <circle cx="7.5" cy="10" r="1" />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 1.5L2.5 9h5l-1 5.5 6-7.5h-5l1-5.5z" />
    </svg>
  );
}

function IsoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4.5L8 1.5l5.5 3v7l-5.5 3-5.5-3v-7z" />
      <path d="M8 1.5v13M2.5 4.5L8 8l5.5-3.5" />
    </svg>
  );
}

const navGroups: NavGroupDef[] = [
  {
    title: "OPERATIONS",
    items: [
      { label: "Overview", href: "/ops", exact: true, icon: HomeIcon },
      { label: "Payments", href: "/ops/transactions", icon: PaymentsIcon },
      { label: "Refunds", href: "/ops/refunds", icon: RefundsIcon },
    ],
  },
  {
    title: "MONEY & SETTLEMENT",
    items: [
      { label: "Ledger", href: "/ops/ledger", icon: LedgerIcon },
      { label: "Reconciliation", href: "/ops/reconciliation", icon: ReconciliationIcon },
    ],
  },
  {
    title: "DEVELOPERS",
    items: [
      { label: "Webhooks & API", href: "/ops/developer", icon: WebhookIcon },
      { label: "Jobs & DLQ", href: "/ops/jobs", icon: JobsIcon },
    ],
  },
  {
    title: "RELIABILITY & LABS",
    items: [
      { label: "Cards & 3DS", href: "/ops/cards", icon: CardsIcon },
      { label: "Reliability Lab", href: "/ops/reliability-lab", icon: ZapIcon },
      { label: "ISO 8583 Lab", href: "/ops/iso8583", icon: IsoIcon },
    ],
  },
];

interface OpsSidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function OpsSidebar({ isMobileOpen = false, onCloseMobile }: OpsSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (item: NavItemDef) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div className={styles.sidebarBackdrop} onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside
        className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ""} ${
          isMobileOpen ? styles.sidebarMobileOpen : ""
        }`}
        aria-label="PayRail Operations Navigation"
      >
        {/* Brand Header */}
        <div className={styles.sidebarHeader}>
          <Link
            href="/ops"
            className={styles.sidebarBrand}
            aria-label="PayRail PH Operations Console"
          >
            <span className={styles.sidebarBrandLogo} aria-hidden="true">
              PR
            </span>
            <div className={styles.sidebarBrandTitles}>
              <span className={styles.sidebarBrandMain}>
                PayRail <span className={styles.brandAccent}>PH</span>
              </span>
              <span className={styles.sidebarBrandSub}>Operations Console</span>
            </div>
          </Link>
          <button
            type="button"
            className={styles.sidebarCollapseBtn}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
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
              {isCollapsed ? <path d="M5 2.5l4.5 4.5L5 11.5" /> : <path d="M9 2.5L4.5 7 9 11.5" />}
            </svg>
          </button>
        </div>

        {/* Workspace / Sandbox Status Badge */}
        <div className={styles.sidebarWorkspaceCard}>
          <div className={styles.sidebarWorkspaceHeader}>
            <span className={styles.workspaceDot} aria-hidden="true" />
            <span className={styles.workspaceTitle}>SANDBOX / TEST MODE</span>
          </div>
          <p className={styles.workspaceSubtext}>PayMongo Test & Local DB</p>
        </div>

        {/* Navigation Groups */}
        <nav className={styles.sidebarNav} aria-label="Operational Domains">
          {navGroups.map((group) => (
            <div key={group.title} className={styles.navGroup}>
              <div className={styles.navGroupHeading}>{group.title}</div>
              <ul className={styles.navGroupList}>
                {group.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className={styles.navGroupItem}>
                      <Link
                        href={item.href}
                        className={`${styles.sidebarNavLink} ${
                          active ? styles.sidebarNavLinkActive : ""
                        }`}
                        aria-current={active ? "page" : undefined}
                        onClick={() => {
                          if (onCloseMobile) onCloseMobile();
                        }}
                      >
                        <span className={styles.sidebarNavIcon}>
                          <Icon />
                        </span>
                        <span className={styles.sidebarNavLabel}>{item.label}</span>
                        {item.badge && (
                          <span
                            className={`${styles.sidebarNavBadge} ${
                              item.badgeVariant === "warning"
                                ? styles.sidebarNavBadgeWarning
                                : styles.sidebarNavBadgeNeutral
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarHealthIndicator}>
            <span className={styles.healthDot} aria-hidden="true" />
            <span className={styles.healthText}>All Systems Normal</span>
          </div>
          <Link href="/" className={styles.sidebarExitLink}>
            <span aria-hidden="true">←</span>
            <span>Back to Public Site</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
