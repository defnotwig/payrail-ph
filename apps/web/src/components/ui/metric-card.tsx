import type { ReactNode } from "react";
import styles from "./ui.module.css";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  metadata?: string;
  className?: string;
}

export function MetricCard({ label, value, metadata, className = "" }: MetricCardProps) {
  return (
    <article className={`${styles.metricCard} ${className}`}>
      <span className={styles.metricLabel}>{label}</span>
      <div className={styles.metricValue}>{value}</div>
      {metadata && <span className={styles.metricMeta}>{metadata}</span>}
    </article>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className={styles.metricGrid}>{children}</div>;
}
