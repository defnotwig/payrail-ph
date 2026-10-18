import styles from "./ui.module.css";

interface EnvironmentBadgeProps {
  mode?: "test" | "live";
  label?: string;
}

export function EnvironmentBadge({ mode = "test", label }: EnvironmentBadgeProps) {
  const isTest = mode === "test";
  const displayLabel = label ?? (isTest ? "Sandbox Mode" : "Live Production");

  return (
    <span
      className={`${styles.badge} ${isTest ? styles.badgeSandbox : styles.badgeSucceeded}`}
      role="status"
      title={isTest ? "Test environment: no real funds are moved" : "Live production mode"}
    >
      <span className={styles.badgeDot} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
