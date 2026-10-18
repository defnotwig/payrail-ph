import Link from "next/link";
import styles from "./ops.module.css";

export const metadata = {
  title: "PayRail PH — Operations Platform",
  description:
    "Internal payment operations, double-entry ledger, reconciliation, and reliability console.",
};

const navigation = [
  { name: "Overview", href: "/ops" },
  { name: "Reliability Lab (Stress & Chaos)", href: "/ops/reliability-lab" },
  { name: "Transactions & Intents", href: "/ops/transactions" },
  { name: "Double-Entry Ledger", href: "/ops/ledger" },
  { name: "Refunds", href: "/ops/refunds" },
  { name: "Reconciliation", href: "/ops/reconciliation" },
  { name: "Durable Jobs & DLQ", href: "/ops/jobs" },
  { name: "Merchant API & Webhooks", href: "/ops/developer" },
  { name: "Cards & 3DS", href: "/ops/cards" },
  { name: "ISO 8583 Protocol Lab", href: "/ops/iso8583" },
];

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <header className={styles.topBar}>
        <div className={styles.brandGroup}>
          <Link href="/ops" className={styles.brandTitle}>
            PayRail <span>PH</span> Operations
          </Link>
          <span className={styles.badgeSandbox}>SANDBOX / TEST MODE ONLY</span>
          <span className={styles.badgePill}>ROLE: ADMIN</span>
        </div>
        <div className={styles.topNavActions}>
          <span className={styles.badgeSuccess}>● SYSTEM HEALTHY</span>
          <Link href="/" className={styles.returnLink}>
            ← Back to Public Site
          </Link>
        </div>
      </header>

      <nav className={styles.navTabs} aria-label="Operations Navigation">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href} className={styles.navTab}>
            {item.name}
          </Link>
        ))}
      </nav>

      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
