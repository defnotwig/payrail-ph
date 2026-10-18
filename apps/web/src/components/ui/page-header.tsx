import type { ReactNode } from "react";
import styles from "./ui.module.css";
import { EnvironmentBadge } from "./environment-badge";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showEnvironment?: boolean;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, showEnvironment = false, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderTitles}>
        <h1 className={styles.pageTitle}>
          <span>{title}</span>
          {showEnvironment && <EnvironmentBadge mode="test" />}
        </h1>
        {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.pageHeaderActions}>{actions}</div>}
    </header>
  );
}
