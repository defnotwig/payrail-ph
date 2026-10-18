import Link from "next/link";
import { OpsNav } from "./ops-nav";
import styles from "./ops.module.css";

export const metadata = {
  title: "PayRail PH — Operations Platform",
  description:
    "Internal payment operations, double-entry ledger, reconciliation, and reliability console.",
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <header className={styles.topBar}>
        <div className={styles.brandGroup}>
          <Link
            href="/ops"
            className={styles.brandTitle}
            aria-label="PayRail PH Operations Console"
          >
            PayRail <span>PH</span>
            <span className={styles.brandSubtitle}>Operations</span>
          </Link>
          <span className={styles.badgeSandbox} role="status">
            SANDBOX / TEST MODE ONLY
          </span>
          <span className={styles.badgePill}>OPERATOR: ADMIN</span>
        </div>
        <div className={styles.topNavActions}>
          <span className={styles.badgeSuccess} role="status">
            <span aria-hidden="true">●</span> SYSTEM OPERATIONAL
          </span>
          <Link href="/" className={styles.returnLink}>
            <span aria-hidden="true">←</span> Back to Public Site
          </Link>
        </div>
      </header>

      <OpsNav />

      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
