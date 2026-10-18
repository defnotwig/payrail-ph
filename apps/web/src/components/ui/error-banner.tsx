import type { ReactNode } from "react";
import styles from "./ui.module.css";

interface ErrorBannerProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function ErrorBanner({
  title = "Action could not be completed",
  message,
  action,
}: ErrorBannerProps) {
  return (
    <div className={styles.errorBanner} role="alert">
      <span aria-hidden="true" style={{ fontSize: "16px", flexShrink: 0 }}>
        ⚠
      </span>
      <div style={{ flex: 1 }}>
        <div className={styles.errorBannerTitle}>{title}</div>
        <div>{message}</div>
        {action && <div style={{ marginTop: "8px" }}>{action}</div>}
      </div>
    </div>
  );
}
